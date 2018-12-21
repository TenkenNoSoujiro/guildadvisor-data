const fs = require("fs");
const path = require("path");
const prompts = require("prompts");
const handlebars = require("handlebars");

const adventurerTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, "adventurer.handlebars"), "utf8"), { noEscape: true });
const assistTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, "assist.handlebars"), "utf8"), { noEscape: true });

const passiveSkills = {};
for (const entry of fs.readdirSync(path.join(__dirname, "../data"), { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (path.extname(entry.name) !== ".json") continue;
  const unit = JSON.parse(fs.readFileSync(path.join(__dirname, "../data", entry.name), "utf8"));
  if (unit.kind !== "adventurer") continue;
  for (const skill of unit.passiveSkills) {
    const entries = passiveSkills.hasOwnProperty(skill.name) ? passiveSkills[skill.name] : passiveSkills[skill.name] = [];
    entries.push(skill.description);
  }
}

const commonSkills = {
  "Liaris Freese": "Fast Growth. Null Charm",
  "Sword Fighter": {
    2: "Str.+3%",
    3: "Str.+4%",
    4: "Str.+10%",
  },
  "Crush": {
    2: "Str.+3%",
    3: "Str.+4%",
    4: "Str.+15%",
  },
  "Tough": "End.+10%",
  "Unbreakable": "End.+10%",
  "Saboteur": "Dex.+10%",
  "Hunter": {
    2: "Agi.+3%",
    3: "Agi.+4%",
    4: "Agi.+10%",
  },
  "Acceleration": {
    2: "Agi.+3%",
    3: "Agi.+4%",
    4: "Agi.+10%",
  },
  "Mind's Eye": "Mag.+8%",
  "Enlightenment": "Mag.+10%",
  "Swift": "Str. & Agi.+10%",
  "Climb": "End. & Agi.+10%",
  "Concentrate": "Agi. & Dex.+10%",
  "Rigid": "End. & Agi. & Dex.+10%",
  "Luck": "All Status+10%",
  "Wisdom": "All Status+10%",
  "Protection": "P.Resist & M.Resist+10%",
  "Solid": "Guard Rate+30%",
  "Strike": "Critical Damage+10%",
  "Water Resistance": "Water Resist+35%",
  "Wind Resistance": "Wind Resist+35%",
  "Earth Resistance": "Earth Resist+35%",
  "Thunder Resistance": "Thunder Resist+35%",
  "Fire Resistance": "Fire Resist+35%",
  "Light Resistance": "Light Resist+35%",
  "Dark Resistance": "Dark Resist+35%",
  "Defense": "P.Resist+10%",
  "Magic Resistance": "M.Resist+10%",
  "Status Resist": "Ailment Resist+15%",
  "Spirit Healing": "1% MP Regen/turn",
  "Healing Power": "3% HP Regen/turn",
}

async function main(args) {
  let canceled = false;
  let lastResponse;
  const forAdventurer = (type) => (_, values) => values.kind === "adventurer" ? type : null;
  const forAssist = (type) => (_, values) => values.kind === "assist" ? type : null;

  // TODO: interrogate passiveSkills for the skill
  //       if it exists, present an autocomplete for
  //       existing values. Also add an autocomplete entry
  //       for `<new>`
  const initialSkill = (prev, { rarity }) => {
    if (commonSkills.hasOwnProperty(prev)) {
      const skill = commonSkills[prev];
      if (typeof skill === "string") return skill;
      return skill[rarity];
    }
  };
  function copy(field, options = {}) {
    return !lastResponse ? useDefault :
      options.same ? useLastIfSame :
      useLast;
    function useLastIfSame(prev, response) {
      return response[options.same] === lastResponse[options.same] ? useLast() : useDefault();
    }
    function useLast() {
      const value = lastResponse[field];
      if (value !== undefined) return value;
      return useDefault();
    }
    function useDefault() {
      return options.default;
    }
  }
  // const lastForSkill = (field, defaultValue) => (prev) => lastResponse && lastResponse[field] === prev ?
  while (!canceled) {
    const response = await prompts([
      { type: "select",
        name: "kind",
        message: "Unit kind",
        choices: [
          { title: "adventurer", value: "adventurer" },
          { title: "assist", value: "assist" }
        ],
        initial: copy("kind") },
      { type: "text",
        name: "title",
        message: "Title" },
      { type: "autocomplete",
        name: "name",
        message: "Name",
        choices: [
          { title: "Ais Wallenstein" },
          { title: "Amid Teasanare" },
          { title: "Anakitty Autumn" },
          { title: "Anya Fromel" },
          { title: "Armin Arlert" },
          { title: "Asfi Al Andromeda" },
          { title: "Bell Cranel" },
          { title: "Bete Loga" },
          { title: "chloe Lolo" },
          { title: "Crunchyroll-Hime" },
          { title: "Demeter" },
          { title: "Diancecht" },
          { title: "Dionysus" },
          { title: "Eina Tulle" },
          { title: "Eren Jaeger" },
          { title: "Fels" },
          { title: "Filvis Challia" },
          { title: "Finn Deimne" },
          { title: "Freya" },
          { title: "Ganesha" },
          { title: "Gareth Landrock" },
          { title: "Goibniu" },
          { title: "Hephaistios" },
          { title: "Hermes & Hermes" },
          { title: "Hermes" },
          { title: "Hestia" },
          { title: "Hitachi Chigusa" },
          { title: "Kashima Ouka" },
          { title: "Kino & Hermes" },
          { title: "Kino" },
          { title: "Lefiya Viridis" },
          { title: "Levi" },
          { title: "Liliruca Arde" },
          { title: "Loki" },
          { title: "Lunor Faust" },
          { title: "Mia Grand" },
          { title: "Miach" },
          { title: "Mikasa Ackermann" },
          { title: "Misha Flot" },
          { title: "Mord Latro" },
          { title: "Naza Ersuisu" },
          { title: "Ottarl" },
          { title: "Ouranos" },
          { title: "Photo & Sou" },
          { title: "Raul Nord" },
          { title: "Riveria Ljos Alf" },
          { title: "Ryu Lion" },
          { title: "Shakti Varma" },
          { title: "Shizu & Riku" },
          { title: "Syr Flover" },
          { title: "Takemikazuchi" },
          { title: "Ti" },
          { title: "Tiona Hiryute" },
          { title: "Tione Hiryute" },
          { title: "Tsubaki Collbrande" },
          { title: "Welf Crozzo" },
          { title: "Yamato Mikoto" },
        ],
        initial: copy("title") },
      { type: forAdventurer("autocomplete"),
        name: "type",
        message: "Adventurer Type",
        choices: [
          { title: "P.Attack Type", value: "p.attack" },
          { title: "M.Attack Type", value: "m.attack" },
          { title: "Balance Type", value: "balance" },
          { title: "Healer", value: "healer" },
          { title: "Defense", value: "defense" }
        ],
        initial: copy("type") },
      { type: "confirm",
        name: "limited",
        message: "Time-limited",
        initial: copy("limited") },
      { type: "number",
        name: "rarity",
        message: "Rarity",
        min: 1,
        max: 4,
        initial: copy("rarity", { default: 4 }) },
      { type: "number",
        name: "hp",
        message: "hp",
        initial: copy("hp", { same: "name" }) },
      { type: "number",
        name: "mp",
        message: "mp",
        initial: copy("mp", { same: "name" }) },
      { type: "number",
        name: "str",
        message: "str",
        initial: copy("str", { same: "name" }) },
      { type: "number",
        name: "end",
        message: "end",
        initial: copy("end", { same: "name" }) },
      { type: "number",
        name: "dex",
        message: "dex",
        initial: copy("dex", { same: "name" }) },
      { type: "number",
        name: "agi",
        message: "agi",
        initial: copy("agi", { same: "name" }) },
      { type: "number",
        name: "mag",
        message: "mag",
        initial: copy("mag", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "specialArtsName",
        message: "Special Arts Skill Name",
        initial: copy("specialArtsName", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "specialArtsDescription",
        message: "Special Arts Skill Description",
        initial: copy("specialArtsDescription", { same: "specialArtsName" }) },
      { type: forAdventurer("text"),
        name: "combatSkill1Name",
        message: "Combat Skill #1 Name",
        initial: copy("combatSkill1Name", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "combatSkill1Description",
        message: "Combat Skill #1 Description",
        initial: copy("combatSkill1Description", { same: "combatSkill1Name" }) },
      { type: forAdventurer("text"),
        name: "combatSkill2Name",
        message: "Combat Skill #2 Name",
        initial: copy("combatSkill2Name", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "combatSkill2Description",
        message: "Combat Skill #2 Description",
        initial: copy("combatSkill2Description", { same: "combatSkill2Name" }) },
      { type: forAdventurer("text"),
        name: "combatSkill3Name",
        message: "Combat Skill #3 Name",
        initial: copy("combatSkill3Name", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "combatSkill3Description",
        message: "Combat Skill #3 Description",
        initial: copy("combatSkill3Description", { same: "combatSkill3Name" }) },

      { type: forAdventurer("text"),
        name: "passiveSkill0Name",
        message: "Passive Skill #1 Name",
        initial: copy("passiveSkill0Name", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "passiveSkill0Description",
        message: "Passive Skill #1 Description",
        initial: initialSkill },

      { type: forAdventurer("text"),
        name: "passiveSkill1Name",
        message: "Passive Skill #2 Name",
        initial: copy("passiveSkill1Name", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "passiveSkill1Description",
        message: "Passive Skill #2 Description",
        initial: initialSkill },
      { type: forAdventurer("text"),
        name: "passiveSkill2Name",
        message: "Passive Skill #3 Name",
        initial: copy("passiveSkill2Name", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "passiveSkill2Description",
        message: "Passive Skill #3 Description",
        initial: initialSkill },
      { type: forAdventurer("text"),
        name: "passiveSkill3Name",
        message: "Passive Skill #4 Name",
        initial: copy("passiveSkill3Name", { same: "name" }) },
      { type: forAdventurer("text"),
        name: "passiveSkill3Description",
        message: "Passive Skill #4 Description",
        initial: initialSkill },
      { type: forAdventurer("text"),
        name: "passiveSkill4Name",
        message: "Passive Skill #5 Name",
        initial: copy("passiveSkill4Name", { same: "name" }) },
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
        message: "Assist Skill Lv.80 Description" },
    ], { onCancel: () => { canceled = true }});

    if (canceled) {
      console.log("User canceled input", response);
      return;
    }

    response.id = `${normalize(response.name)}-${normalize(response.title)}`;
    response.new = args.includes("new");

    const content = response.kind === "adventurer"
      ? adventurerTemplate(response)
      : assistTemplate(response);

    fs.writeFileSync(path.resolve(__dirname, "../data/", response.id + ".json"), content, "utf8");
    console.log(response.id + ".json added.");

    const { keepGoing } = await prompts({ type: "confirm", name: "keepGoing", message: "Create another?", initial: true }, { onCancel: () => { canceled = true }});
    if (!canceled) canceled = !keepGoing;
  }
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/ig, "")
    .replace(/\s+/g, ".");
}

main(process.argv.slice(2));
