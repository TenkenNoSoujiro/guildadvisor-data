const fs = require("fs");
const path = require("path");
const prompts = require("prompts");
const handlebars = require("handlebars");

const adventurerTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, "adventurer.handlebars"), "utf8"), { noEscape: true });
const assistTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, "assist.handlebars"), "utf8"), { noEscape: true });

const commonSkills = {
  "Liaris Freese": "Fast Growth. Null Charm",
  "Sword Fighter": "Str.+10%",
  "Crush": "Str.+15%",
  "Tough": "End.+10%",
  "Saboteur": "Dex.+10%",
  "Hunter": "Agi.+10%",
  "Acceleration": "Agi.+3%",
  "Enlightenment": "Mag.+10%",
  "Swift": "Str. & Agi.+10%",
  "Climb": "End. & Agi.+10%",
  "Rigid": "End. & Agi. & Dex.+10%",
  "Luck": "All Status+10%",
  "Wisdom": "All Status+10%",
  "Protection": "P.Resist & M.Resist+10%",
  "Solid": "Guard Rate+30%",
  "Strike": "Critical Damage+20%",
  "Water Resistance": "Water Resist+35%",
  "Wind Resistance": "Wind Resist+35%",
  "Earth Resistance": "Earth Resist+35%",
  "Thunder Resistance": "Thunder Resist+35%",
  "Fire Resistance": "Fire Resist+35%",
  "Light Resistance": "Light Resist+35%",
  "Dark Resistance": "Dark Resist+35%",
  "Status Resist": "Ailment Resist+15%",
  "Spirit Healing": "1% MP Regen/turn",
  "Healing Power": "3% HP Regen/turn",
}

async function main() {
  let canceled = false;
  const forAdventurer = (type) => (_, values) => values.kind === "adventurer" ? type : null;
  const forAssist = (type) => (_, values) => values.kind === "assist" ? type : null;
  const initialSkill = (prev) => { if (commonSkills.hasOwnProperty(prev)) return commonSkills[prev]; };
  const response = await prompts([
    { type: "confirm",
      name: "new",
      message: "Is this a new unit?" },
    { type: "select",
      name: "kind",
      message: "Unit kind",
      choices: [
        { title: "adventurer", value: "adventurer" },
        { title: "assist", value: "assist" }
      ] },
    { type: "text",
      name: "title",
      message: "Title" },
    { type: "text",
      name: "name",
      message: "Name" },
    { type: forAdventurer("select"),
      name: "type",
      message: "Adventurer Type",
      choices: [
        { title: "p.attack", value: "p.attack" },
        { title: "m.attack", value: "m.attack" },
        { title: "balance", value: "balance" },
        { title: "healer", value: "healer" },
        { title: "defense", value: "defense" }
      ] },
    { type: "confirm",
      name: "limited",
      message: "Time-limited" },
    { type: "select",
      name: "rarity",
      message: "Rarity",
      choices: [
        { title: "4", value: 4 },
        { title: "3", value: 3 },
        { title: "2", value: 2 },
        { title: "1", value: 1 }
      ] },
    { type: "number",
      name: "hp",
      message: "hp" },
    { type: "number",
      name: "mp",
      message: "mp" },
    { type: "number",
      name: "str",
      message: "str" },
    { type: "number",
      name: "end",
      message: "end" },
    { type: "number",
      name: "dex",
      message: "dex" },
    { type: "number",
      name: "agi",
      message: "agi" },
    { type: "number",
      name: "mag",
      message: "mag" },
    { type: forAdventurer("text"),
      name: "specialArtsName",
      message: "Special Arts Skill Name" },
    { type: forAdventurer("text"),
      name: "specialArtsDescription",
      message: "Special Arts Skill Description" },
    { type: forAdventurer("text"),
      name: "combatSkill1Name",
      message: "Combat Skill #1 Name" },
    { type: forAdventurer("text"),
      name: "combatSkill1Description",
      message: "Combat Skill #1 Description" },
    { type: forAdventurer("text"),
      name: "combatSkill2Name",
      message: "Combat Skill #2 Name" },
    { type: forAdventurer("text"),
      name: "combatSkill2Description",
      message: "Combat Skill #2 Description" },
    { type: forAdventurer("text"),
      name: "combatSkill3Name",
      message: "Combat Skill #3 Name" },
    { type: forAdventurer("text"),
      name: "combatSkill3Description",
      message: "Combat Skill #3 Description" },
    { type: forAdventurer("text"),
      name: "passiveSkill0Name",
      message: "Passive Skill #1 Name" },
    { type: forAdventurer("text"),
      name: "passiveSkill0Description",
      message: "Passive Skill #1 Description",
      initial: initialSkill },
    { type: forAdventurer("text"),
      name: "passiveSkill1Name",
      message: "Passive Skill #2 Name" },
    { type: forAdventurer("text"),
      name: "passiveSkill1Description",
      message: "Passive Skill #2 Description",
      initial: initialSkill },
    { type: forAdventurer("text"),
      name: "passiveSkill2Name",
      message: "Passive Skill #3 Name" },
    { type: forAdventurer("text"),
      name: "passiveSkill2Description",
      message: "Passive Skill #3 Description",
      initial: initialSkill },
    { type: forAdventurer("text"),
      name: "passiveSkill3Name",
      message: "Passive Skill #4 Name" },
    { type: forAdventurer("text"),
      name: "passiveSkill3Description",
      message: "Passive Skill #4 Description",
      initial: initialSkill },
    { type: forAdventurer("text"),
      name: "passiveSkill4Name",
      message: "Passive Skill #5 Name" },
    { type: forAdventurer("text"),
      name: "passiveSkill4Description",
      message: "Passive Skill #5 Description",
      initial: initialSkill },
    { type: forAssist("text"),
      name: "assistSkillName",
      message: "Assist Skill Name" },
    { type: forAssist("text"),
      name: "assistSkill0Description",
      message: "Assist Skill Lv.60 Description" },
    { type: forAssist("text"),
      name: "assistSkill1Description",
      message: "Assist Skill Lv.80 Description",
      initial: (_, values) => values.assistSkill0Description },
  ], { onCancel: () => { canceled = true }});

  if (canceled) {
    console.log("User canceled input");
    return;
  }

  response.id = `${normalize(response.name)}-${normalize(response.title)}`;

  const content = response.kind === "adventurer"
    ? adventurerTemplate(response)
    : assistTemplate(response);

  fs.writeFileSync(path.resolve(__dirname, "../data/", response.id + ".json"), content, "utf8");
  console.log(response.id + ".json added.");
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/ig, "")
    .replace(/\s+/g, ".");
}

main();