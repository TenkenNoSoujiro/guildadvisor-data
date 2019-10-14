const fs = require("fs");
const path = require("path");
const units = fs.readdirSync("./data")
  .filter(name => path.extname(name) === ".json")
  .map(name => fs.readFileSync(path.join("./data", name)))
  .map(text => JSON.parse(text));
fs.writeFileSync(process.argv[2], JSON.stringify(units), "utf8");
