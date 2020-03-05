// @ts-check
const path = require("path");
const fs = require("fs");
const ajv = require("ajv");
const ts = require("typescript");
const kleur = require("kleur");
const rl = require("readline");
const { argv } = require("yargs")
  .option("summary", { type: "boolean" })
  .option("watch", { type: "boolean" });

const schema =
  tryRequire("../../guildAdvisor/lib/api/schema/unit.json") ||
  tryRequire("../../guildAdvisor/src/api/schema/unit.json") ||
  // @ts-ignore
  require("../data/schema/schema.json");

const validator = ajv({
  allErrors: true,

});
const dataDir = argv._.length > 0 ? path.resolve(argv._[0]) : path.resolve(__dirname, "../data");
const summaryOnly = argv.summary || argv.watch;

if (argv.watch) {
  watch();
} else {
  printSummary(doValidation(), process.exit);
}

function watch() {
  const dtf = new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  });
  let timer;
  fs.watch(dataDir, onChange);
  handleChanges(true);

  function onChange() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    timer = setTimeout(handleChanges, 500);
  }

  function handleChanges(first) {
    clearTimeout(timer);
    timer = undefined;
    if (!first) {
      rl.cursorTo(process.stdout, 0, 0);
      rl.clearScreenDown(process.stdout);
      process.stdout.write("\n");
      process.stdout.write(`validate ${kleur.green("INFO")} [${dtf.format()}] File change detected.\n`);
    }
    printSummary(doValidation());
    process.stdout.write(`validate ${kleur.green("INFO")} [${dtf.format()}] Validation complete, watching for changes.\n`);
  }
}

function doValidation() {
  let errors = [];
  for (const name of fs.readdirSync(dataDir)) {
    if (path.extname(name) !== ".json") continue;
    const file = path.join(dataDir, name);
    const localFile = path.relative(process.cwd(), file);
    try {
      if (!fs.statSync(file).isFile()) continue;
      const data = fs.readFileSync(file, "utf8");
      const json = JSON.parse(data);
      if (!validator.validate(schema, json)) {
        const jsonFile = ts.parseJsonText(file, data);
        const filteredErrors = validator.errors.filter(error => !/^data |^data\.kind/.test(validator.errorsText([error])));
        for (const error of (filteredErrors.length ? filteredErrors : validator.errors)) {
          const text = `validate ${kleur.red("ERR!")} ${kleur.yellow(localFile + getLocation(jsonFile, error.dataPath))}: ${validator.errorsText([error])}\n`;
          errors.push(text);
          if (!summaryOnly) process.stdout.write(text);
        }
      }
      else if (!summaryOnly) {
        process.stdout.write(`validate ${kleur.green("OK")} ${kleur.yellow(localFile)}\n`);
      }
    }
    catch (error) {
      const text = `validate ${kleur.red("ERR!")} ${kleur.yellow(localFile)}: ${error.message}\n`;
      errors.push(text);
      if (!summaryOnly) process.stdout.write(text);
    }
  }
  return errors;
}

/**
 * @param {string[]} errors
 * @param {(errorCode: number) => void} [done]
 */
function printSummary(errors, done) {
  if (errors.length > 0) {
    if (!summaryOnly) process.stdout.write(`validate ${kleur.red("ERR!")} Validation failed:\n`);
    for (const text of errors) {
      process.stdout.write(text);
    }
    process.stdout.write(`validate ${kleur.red("ERR!")} Validation failed with ${kleur.red(errors.length)} errors\n`);
    done && done(errors.length);
  }
  else {
    process.stdout.write(`validate ${kleur.green("OK")} Validation succeeded\n`);
    done && done(0);
  }
}

function tryRequire(id) {
  try {
    return require(id);
  } catch {
    return undefined;
  }
}

/**
 * @param {ts.JsonSourceFile} jsonFile
 * @param {string} dataPath
 */
function getLocation(jsonFile, dataPath) {
  if (!dataPath) {
    return ":1:1";
  }
  try {
    const statement = ts.createSourceFile("", dataPath, ts.ScriptTarget.ESNext, true).statements[0];
    if (ts.isExpressionStatement(statement)) {
      const expressionPath = statement.expression;
      const expression = getLocationFromExpression(jsonFile, jsonFile.statements[0].expression, expressionPath);
      if (expression) {
        const start = ts.getLineAndCharacterOfPosition(
          jsonFile,
          expression.getStart(jsonFile));
        const end = ts.getLineAndCharacterOfPosition(
          jsonFile,
          expression.getEnd());
        return `:${start.line + 1}:${start.character + 1}-${end.line + 1}:${end.character + 1}`;
      }
    }
  } catch {}
  return "";
}

/**
 * @param {ts.JsonSourceFile} jsonFile
 * @param {ts.Expression} object
 * @param {string} key
 * @returns {ts.Expression | ts.PropertyAssignment}
 */
function getProperty(jsonFile, object, key) {
  if (ts.isObjectLiteralExpression(object)) {
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) {
        continue;
      }
      const propertyName =
        ts.isIdentifier(property.name) ? ts.idText(property.name) :
        ts.isStringLiteral(property.name) ? property.name.text :
        ts.isNumericLiteral(property.name) ? property.name.text :
        undefined;
      if (propertyName === key) {
        return property;
      }
    }
  } else if (ts.isArrayLiteralExpression(object)) {
    const index = parseInt(key, 10);
    return object.elements[index];
  }
}

/**
 *
 * @param {ts.Expression | ts.PropertyAssignment} value
 */
function getExpression(value) {
  return value ? ts.isPropertyAssignment(value) ? value.initializer : value : undefined;
}

/**
 * @param {ts.JsonSourceFile} jsonFile
 * @param {ts.Expression} object
 * @param {ts.Expression} path
 * @returns {ts.Expression | ts.PropertyAssignment | undefined}
 */
function getLocationFromExpression(jsonFile, object, path) {
  if (object) {
    if (ts.isPropertyAccessExpression(path)) {
      const left = getLocationFromExpression(jsonFile, getExpression(object), path.expression);
      return left && getLocationFromExpression(jsonFile, getExpression(left), path.name);
    } else if (ts.isElementAccessExpression(path)) {
      const left = getLocationFromExpression(jsonFile, getExpression(object), path.expression);
      return left && getLocationFromExpression(jsonFile, getExpression(left), path.argumentExpression);
    } else if (ts.isIdentifier(path)) {
      return getProperty(jsonFile, getExpression(object), ts.idText(path));
    } else if (ts.isStringLiteral(path)) {
      return getProperty(jsonFile, getExpression(object), path.text);
    } else if (ts.isNumericLiteral(path)) {
      return getProperty(jsonFile, getExpression(object), path.text);
    }
  }
}