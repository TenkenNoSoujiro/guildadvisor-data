const fs = require("fs");
const path = require("path");
const dataDir = path.join(__dirname, "../data");
const handlebars = require("handlebars");

const adventurerTemplateFile = path.join(__dirname, "adventurerObject.handlebars");
const adventurerTemplate = handlebars.compile(fs.readFileSync(adventurerTemplateFile, "utf8"), { noEscape: true });
const assistTemplateFile = path.join(__dirname, "assistObject.handlebars");
const assistTemplate = handlebars.compile(fs.readFileSync(assistTemplateFile, "utf8"), { noEscape: true });

const pendingClear = [];
const pendingNew = [];
for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (path.extname(entry.name) !== ".json") continue;
  const name = path.basename(entry.name, ".json");
  const unitFile = path.join(dataDir, entry.name);
  const unit = JSON.parse(fs.readFileSync(unitFile, "utf8"));
  const isNew = process.argv.includes(name);
  if ((unit.new || false) !== isNew) {
    (isNew ? pendingNew : pendingClear).push(() => {
      console.log(`  ${entry.name}: ${isNew ? "setting" : "clearing"} 'new'`);
      unit.new = isNew;
      saveUnit(unitFile, unit);
    });
  }
}

if (pendingClear.length) {
  console.log("Clearing 'new' flag...");
  for (const cb of pendingClear) cb();
  pendingClear.length = 0;
}

if (pendingNew.length) {
  console.log("Setting 'new' flag...");
  for (const cb of pendingNew) cb();
  pendingNew.length = 0;
}

function saveUnit(unitFile, unit) {
  switch (unit.kind) {
    case "adventurer": return saveAdventurerUnit(unitFile, unit);
    case "assist": return saveAssistUnit(unitFile, unit);
  }
}

function saveAdventurerUnit(unitFile, unit) {
  const options = { helpers: { json(value) { return JSON.stringify(value); } } };
  const data = adventurerTemplate(unit, options);
  fs.writeFileSync(unitFile, data, "utf8");
}

function saveAssistUnit(unitFile, unit) {
  const options = { helpers: { json(value) { return JSON.stringify(value); } } };
  const data = assistTemplate(unit, options);
  fs.writeFileSync(unitFile, data, "utf8");
}