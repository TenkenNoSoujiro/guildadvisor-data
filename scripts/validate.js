const path = require("path");
const fs = require("fs");
const ajv = require("ajv");
const schema = (() => {
  try {
    try {
      // try built version from the bot first
      return require("../../guildAdvisor/lib/api/schema/unit.json");
    }
    catch {
      // try dev version from the bot second
      return require("../../guildAdvisor/src/api/schema/unit.json");
    }
  }
  catch {
    // try local version last
    return require("../data/schema/schema.json");
  }
})();
const kleur = require("kleur");
const validator = ajv();
const dataDir = process.argv.length > 2 ? path.resolve(process.argv[2]) : path.resolve(__dirname, "../data");
let errors = [];
for (const name of fs.readdirSync(dataDir)) {
  if (path.extname(name) !== ".json") continue;
  const file = path.join(dataDir, name);
  try {
    if (!fs.statSync(file).isFile()) continue;
    const data = fs.readFileSync(file, "utf8");
    const json = JSON.parse(data);
    if (!validator.validate(schema, json)) {
      for (const error of validator.errors) {
        const text = `validate ${kleur.red("ERR!")} ${kleur.yellow(file)}: ${validator.errorsText([error])}\n`;
        process.stdout.write(text);
        errors.push(text);
      }
    }
    else {
      process.stdout.write(`validate ${kleur.green("OK")} ${kleur.yellow(file)}\n`);
    }
  }
  catch (error) {
    const text = `validate ${kleur.red("ERR!")} ${kleur.yellow(file)}: ${error.message}\n`;
    process.stdout.write(text);
    errors.push(text);
  }
}
if (errors.length > 0) {
  process.stdout.write(`validate ${kleur.red("ERR!")} Validation failed\n`);
  for (const text of errors) {
    process.stdout.write(text);
  }
  process.exit(errors.leng);
}
else {
  process.stdout.write(`validate ${kleur.green("OK")} Validation succeeded\n`);
  process.exit(0);
}