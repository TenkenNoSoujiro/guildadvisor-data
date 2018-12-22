const fs = require("fs");
const path = require("path");
const prompts = require("prompts");
const handlebars = require("handlebars");
const kleur = require("kleur");

const adventurerTemplateFile = path.join(__dirname, "adventurer.handlebars");
const adventurerTemplate = handlebars.compile(fs.readFileSync(adventurerTemplateFile, "utf8"), { noEscape: true });
const assistTemplateFile = path.join(__dirname, "assist.handlebars");
const assistTemplate = handlebars.compile(fs.readFileSync(assistTemplateFile, "utf8"), { noEscape: true });

const unitNamesFile = path.join(__dirname, "unitNames.json");
const unitNames = new Set(JSON.parse(fs.readFileSync(unitNamesFile, "utf8")));

const inProgressFile = path.join(__dirname, "autosave.json");
let lastResponse = readAutosave();

function readAutosave() {
  try {
    return JSON.parse(fs.readFileSync(inProgressFile, "utf8"));
  }
  catch {}
}

const dataDir = path.join(__dirname, "../data");
const knownPassiveSkills = {};
const knownCombatSkills = {};

for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (path.extname(entry.name) !== ".json") continue;
  const unit = JSON.parse(fs.readFileSync(path.join(dataDir, entry.name), "utf8"));
  registerUnitName(unit.name);
  if (unit.kind !== "adventurer") continue;
  for (const skill of unit.combatSkills) registerCombatSkill(skill.name, skill.description);
  for (const skill of unit.passiveSkills) registerPassiveSkill(skill.name, skill.description);
}

function registerUnitName(name) {
  unitNames.add(name);
}

function registerCombatSkill(name, description) {
  const entries = knownCombatSkills.hasOwnProperty(name) ? knownCombatSkills[name] : knownCombatSkills[name] = new Set();
  entries.add(description);
}

function registerPassiveSkill(name, description) {
  const entries = knownPassiveSkills.hasOwnProperty(name) ? knownPassiveSkills[name] : knownPassiveSkills[name] = new Set();
  entries.add(description);
}

function copyLastResponse(field, options = {}) {
  return !lastResponse ? useDefault() :
    options.same ? useLastIfSame :
    useLast();
  function useLastIfSame(prev, response) {
    return response[options.same] === lastResponse[options.same] ? useLast() : useDefault();
  }
  function useLast() {
    const value = lastResponse[field];
    if (value !== undefined) return choose(value);
    return useDefault();
  }
  function useDefault() {
    return choose(options.default);
  }
  function choose(value) {
    return options.choices ? options.choices.findIndex(choice => (choice.value || choice.title || choice) === value) : value;
  }
}

function filterChoices(input, choices, custom) {
  input = input.toLowerCase();
  let exact = false;
  const suggestions = [];
  for (const choice of choices) {
    if (choice === custom) continue;
    const value = choice.value.toLowerCase();
    if (value === input) exact = true;
    if (value.includes(input)) suggestions.push(choice);
  }
  if (!exact) suggestions.push(custom);
  return suggestions;
}

const kindPrompt = (() => {
  return () => [
    { type: "select",
      name: "kind",
      message: "Unit kind",
      choices: [
        { title: "adventurer", value: "adventurer" },
        { title: "assist", value: "assist" }
      ],
      initial: copyLastResponse("kind", { choices: ["adventurer", "assist"]})
    }
  ];
})();

const titlePrompt = (() => {
  return () => [
    { type: "text", name: "title", message: "Title", initial: copyLastResponse("title") }
  ];
})();

const namePrompt = () => {
  function updateCustom(input) {
    custom.title = `${kleur.yellow(`+`)}${input ? ` ${input}` : ""}`;
    custom.value = input;
  }

  const last = copyLastResponse("name");
  const custom = { title: kleur.yellow(`+`), value: "" };
  const choices = [...unitNames]
    .sort()
    .map(name => ({ title: name, value: name }))
    .concat(custom);
  updateCustom(last);

  return [{
    name: "name",
    message: "Name",
    type: "autocomplete",
    choices,
    suggest(input, choices) {
      if (!input && last) {
        updateCustom(last);
        this.value = last;
        this.moveSelect(choices.length - 1);
        return [];
      }
      updateCustom(input);
      return filterChoices(input, choices, custom);
    },
    fallback() {
      return last;
    },
    initial() {
      return last ? choices.length - 1 : undefined;
    },
    onRender() {
      if (this.first) {
        if (last) {
          this.value = last;
          this.moveSelect(choices.length - 1);
        }
      }
      if (!this.input) this.cursor = 0;
    }
  }];
};

const adventurerTypePrompt = (() => {
  const AdventurerType = {
    type(prev, responses) {
      return responses.kind === "adventurer" ? "select" : null;
    },
    choices: [
      { title: "P.Attack Type", value: "p.attack" },
      { title: "M.Attack Type", value: "m.attack" },
      { title: "Balance Type", value: "balance" },
      { title: "Healer", value: "healer" },
      { title: "Defense", value: "defense" }
    ]
  };
  return () => [
    { ...AdventurerType, name: "type", message: "Adventurer Type", initial: copyLastResponse("type", { same: "name", choices: [
      "p.attack",
      "m.attack",
      "balance",
      "healer",
      "defense"
    ] }) },
  ];
})();

const timeLimitedPrompt = (() => {
  return () => [
    { type: "confirm",
      name: "limited",
      message: "Time-limited",
      initial: copyLastResponse("limited", { same: "name" }) },
  ];
})();

const rarityPrompt = (() => {
  return () => [
    { type: "number",
      name: "rarity",
      message: "Rarity",
      min: 1,
      max: 4,
      initial: copyLastResponse("rarity", { same: "name", default: 4 }) },
  ];
})();

const statPrompt = (() => {
  return (name, message) => [
    { type: "number", name, message, initial: copyLastResponse(name, { same: "name" }) }
  ];
})();

const combatSkillNamePrompt = (prefix, message) => {
  let custom;
  let choices;
  let last;

  function updateCustom(input) {
    custom.title = `${kleur.yellow(`+`)}${input ? ` ${input}` : ""}`;
    custom.value = input;
  }

  return [{
    name: `${prefix}Name`,
    message: `${message} Name`,
    type(prev, responses) {
      if (responses.kind !== "adventurer") return null;
      last = copyLastResponse(`${prefix}Name`, { same: "name" });
      if (typeof last === "function") last = last(prev, responses);
      custom = { title: kleur.yellow(`+`), value: "" };
      choices = Object.keys(knownCombatSkills)
        .sort()
        .map(name => ({ title: name, value: name }))
        .concat(custom);
      updateCustom(last);
      return "autocomplete";
    },
    choices() { return choices; },
    fallback() { return last; },
    initial() { return last && choices ? choices.length - 1 : undefined },
    suggest(input, choices) {
      if (!input && last) {
        updateCustom(last);
        this.value = last;
        this.moveSelect(choices.length - 1);
        return [];
      }
      updateCustom(input);
      return filterChoices(input, choices, custom);
    },
    onRender() {
      if (this.first) {
        if (last) {
          this.value = last;
          this.moveSelect(choices.length - 1);
        }
      }
      if (!this.input) this.cursor = 0;
    }
  }];
};

const combatSkillDescriptionPrompt = (prefix, message) => {
  let custom;
  let choices;
  let last;

  function updateCustom(input) {
    custom.title = `${kleur.yellow(`+`)}${input ? ` ${input}` : ""}`;
    custom.value = input;
  }

  return [{
    name: `${prefix}Description`,
    message: `${message} Description`,
    type(prev, responses) {
      if (responses.kind !== "adventurer") return null;
      last = copyLastResponse(`${prefix}Description`, { same: `${prefix}Name` });
      if (typeof last === "function") last = last(prev, responses);
      custom = { title: kleur.yellow(`+`), value: "" };
      const descriptions = knownCombatSkills.hasOwnProperty(prev) ? [...knownCombatSkills[prev]] : [];
      choices = descriptions
        .sort()
        .map(name => ({ title: name, value: name }))
        .concat(custom);
      updateCustom(last);
      return "autocomplete";
    },
    choices() { return choices; },
    fallback() { return last; },
    initial() { return last && choices ? choices.length - 1 : undefined },
    suggest(input, choices) {
      if (!input && last) {
        updateCustom(last);
        this.value = last;
        this.moveSelect(choices.length - 1);
        return [];
      }
      updateCustom(input);
      return filterChoices(input, choices, custom);
    },
    onRender() {
      if (this.first) {
        if (last) {
          this.value = last;
          this.moveSelect(choices.length - 1);
        }
      }
      if (!this.input) this.cursor = 0;
    }
  }];
};

const combatSkillPrompt = (prefix, message) => {
  return [
    ...combatSkillNamePrompt(prefix, message),
    ...combatSkillDescriptionPrompt(prefix, message)
  ];
};

const passiveSkillNamePrompt = (prefix, message) => {
  let custom;
  let choices;
  let last;

  function updateCustom(input) {
    custom.title = `${kleur.yellow(`+`)}${input ? ` ${input}` : ""}`;
    custom.value = input;
  }

  return [{
    name: `${prefix}Name`,
    message: `${message} Name`,
    type(prev, responses) {
      if (responses.kind !== "adventurer") return null;
      last = copyLastResponse(`${prefix}Name`, { same: "name" });
      if (typeof last === "function") last = last(prev, responses);
      custom = { title: kleur.yellow(`+`), value: "" };
      choices = Object.keys(knownPassiveSkills)
        .sort()
        .map(name => ({ title: name, value: name }))
        .concat(custom);
      updateCustom(last);
      return "autocomplete";
    },
    choices() { return choices; },
    fallback() { return last; },
    initial() { return last && choices ? choices.length - 1 : undefined },
    suggest(input, choices) {
      if (!input && last) {
        updateCustom(last);
        this.value = last;
        this.moveSelect(choices.length - 1);
        return [];
      }
      updateCustom(input);
      return filterChoices(input, choices, custom);
    },
    onRender() {
      if (this.first) {
        if (last) {
          this.value = last;
          this.moveSelect(choices.length - 1);
        }
      }
      if (!this.input) this.cursor = 0;
    }
  }];
};

const passiveSkillDescriptionPrompt = (prefix, message) => {
  let custom;
  let choices;
  let last;

  function updateCustom(input) {
    custom.title = `${kleur.yellow(`+`)}${input ? ` ${input}` : ""}`;
    custom.value = input;
  }

  return [{
    name: `${prefix}Description`,
    message: `${message} Description`,
    type(prev, responses) {
      if (responses.kind !== "adventurer") return null;
      last = copyLastResponse(`${prefix}Description`, { same: `${prefix}Name` });
      if (typeof last === "function") last = last(prev, responses);
      custom = { title: kleur.yellow(`+`), value: "" };
      const descriptions = knownPassiveSkills.hasOwnProperty(prev) ? [...knownPassiveSkills[prev]] : [];
      choices = descriptions
        .sort()
        .map(name => ({ title: name, value: name }))
        .concat(custom);
      updateCustom(last);
      return "autocomplete";
    },
    choices() { return choices; },
    fallback() { return last; },
    initial() { return last && choices ? choices.length - 1 : undefined },
    suggest(input, choices) {
      if (!input && last) {
        updateCustom(last);
        this.value = last;
        this.moveSelect(choices.length - 1);
        return [];
      }
      updateCustom(input);
      return filterChoices(input, choices, custom);
    },
    onRender() {
      if (this.first) {
        if (last) {
          this.value = last;
          this.moveSelect(choices.length - 1);
        }
      }
      if (!this.input) this.cursor = 0;
    }
  }];
};


const passiveSkillPrompt = (prefix, message) => [
  ...passiveSkillNamePrompt(prefix, message),
  ...passiveSkillDescriptionPrompt(prefix, message),
];

const assistSkillPrompt = (() => {
  const AssistSkill = {
    type(prev, responses) {
      return responses.kind === "assist" ? "text" : null;
    }
  };
  return () => [
    { ...AssistSkill, name: "assistSkillName", message: "Assist Skill Name", initial: copyLastResponse("assistSkillName", { same: "name" }) },
    { ...AssistSkill, name: "assistSkill0Description", message: "Assist Skill Lv.60 Description", initial: copyLastResponse("assistSkill0Description", { same: "assistSkillName" }) },
    { ...AssistSkill, name: "assistSkill1Description", message: "Assist Skill Lv.80 Description", initial: copyLastResponse("assistSkill1Description", { same: "assistSkillName" }) },
  ];
})();

async function main(args) {
  while (true) {
    let canceled = false;
    const response = await prompts([
      ...kindPrompt(),
      ...titlePrompt(),
      ...namePrompt(),
      ...adventurerTypePrompt(),
      ...timeLimitedPrompt(),
      ...rarityPrompt(),

      ...statPrompt("hp", "HP"),
      ...statPrompt("mp", "MP"),
      ...statPrompt("str", "Str."),
      ...statPrompt("end", "End."),
      ...statPrompt("dex", "Dex."),
      ...statPrompt("agi", "Agi."),
      ...statPrompt("mag", "Mag."),

      ...combatSkillPrompt("specialArts", "Special Arts Skill"),
      ...combatSkillPrompt("combatSkill1", "Combat Skill #1"),
      ...combatSkillPrompt("combatSkill2", "Combat Skill #2"),
      ...combatSkillPrompt("combatSkill3", "Combat Skill #3"),

      ...passiveSkillPrompt("passiveSkill0", "Passive Skill #1"),
      ...passiveSkillPrompt("passiveSkill1", "Passive Skill #2"),
      ...passiveSkillPrompt("passiveSkill2", "Passive Skill #3"),
      ...passiveSkillPrompt("passiveSkill3", "Passive Skill #4"),
      ...passiveSkillPrompt("passiveSkill4", "Passive Skill #5"),

      ...assistSkillPrompt(),
    ], { onCancel: () => { canceled = true }});

    if (canceled) {
      const autoSave = readAutosave() || {};
      for (const p in response) if (response[p] !== undefined) autoSave[p] = response[p];
      fs.writeFileSync(inProgressFile, JSON.stringify(autoSave, undefined, "  "));
      console.log("User canceled input");
      return;
    }

    // fill in generated values
    response.id = `${normalize(response.name)}-${normalize(response.title)}`;
    response.new = args.includes("new");

    // populate template
    const content = response.kind === "adventurer"
      ? adventurerTemplate(response)
      : assistTemplate(response);

    // write result
    fs.writeFileSync(path.resolve(__dirname, "../data/", response.id + ".json"), content, "utf8");
    console.log(response.id + ".json added.");

    // update unit names
    unitNames.add(response.name);

    // update combat and passive skills
    if (response.kind === "adventurer") {
      registerCombatSkill(response.specialArtsName, response.specialArtsDescription);
      registerCombatSkill(response.combatSkill1Name, response.combatSkill1Description);
      registerCombatSkill(response.combatSkill2Name, response.combatSkill2Description);
      registerCombatSkill(response.combatSkill3Name, response.combatSkill3Description);
      registerPassiveSkill(response.passiveSkill0Name, response.passiveSkill0Description);
      registerPassiveSkill(response.passiveSkill1Name, response.passiveSkill1Description);
      registerPassiveSkill(response.passiveSkill2Name, response.passiveSkill2Description);
      registerPassiveSkill(response.passiveSkill3Name, response.passiveSkill3Description);
      registerPassiveSkill(response.passiveSkill4Name, response.passiveSkill4Description);
    }

    // check whether we should keep going
    const { keepGoing } = await prompts({ type: "confirm", name: "keepGoing", message: "Create another?", initial: true }, { onCancel: () => { canceled = true }});
    if (!keepGoing) break;
  }
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/ig, "")
    .replace(/\s+/g, ".");
}

main(process.argv.slice(2));
