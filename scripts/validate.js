const path = require("path");
const fs = require("fs");
const ajv = require("ajv");
const schema = require("../data/schema/schema.json");
const kleur = require("kleur");
const validator = ajv();
const dataDir = process.argv.length > 2 ? path.resolve(process.argv[2]) : path.resolve(__dirname, "../data");
let errors = 0;
for (const name of fs.readdirSync(dataDir)) {
  if (path.extname(name) !== ".json") continue;
  const file = path.join(dataDir, name);
  try {
    if (!fs.statSync(file).isFile()) continue;
    const data = fs.readFileSync(file, "utf8");
    const json = JSON.parse(data);
    if (!validator.validate(schema, json)) {
      for (const error of validator.errors) {
        process.stdout.write(`validate ${kleur.red("ERR!")} ${kleur.yellow(file)}: ${validator.errorsText([error])}\n`);
        errors++;
      }
    }
    else {
      process.stdout.write(`validate ${kleur.green("OK")} ${kleur.yellow(file)}\n`);
    }
  }
  catch (error) {
    process.stdout.write(`validate ${kleur.red("ERR!")} ${kleur.yellow(file)}: ${error.message}\n`);
    errors++;
  }
}
if (errors > 0) {
  process.stdout.write(`validate ${kleur.red("ERR!")} Validation failed\n`);
  process.exit(errors);
}
else {
  process.stdout.write(`validate ${kleur.green("OK")} Validation succeeded\n`);
  process.exit(0);
}