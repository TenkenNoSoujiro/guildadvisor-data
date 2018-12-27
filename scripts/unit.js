// @ts-check
const fs = require("fs");
const path = require("path");
const prompts = require("prompts");
const handlebars = require("handlebars");
// @ts-ignore
const kleur = require("kleur");

const collator = new Intl.Collator("en-US", {
  usage: "sort",
  sensitivity: "base",
  ignorePunctuation: true,
  numeric: true
});

/**
 * @param {[string, number]} left
 * @param {[string, number]} right
 */
function descriptionCollator(left, right) {
  return -(left[1] - right[1])
      || collator.compare(left[0], right[0]);
}

const nemesisRegExp = /\btowards? (?<Nemesis>\w+)$/;
const adventurerTemplateFile = path.join(__dirname, "adventurer.handlebars");
const adventurerTemplate = handlebars.compile(fs.readFileSync(adventurerTemplateFile, "utf8"), { noEscape: true });
const assistTemplateFile = path.join(__dirname, "assist.handlebars");
const assistTemplate = handlebars.compile(fs.readFileSync(assistTemplateFile, "utf8"), { noEscape: true });

const unitNamesFile = path.join(__dirname, "unitNames.json");
const unitNames = new Set(JSON.parse(fs.readFileSync(unitNamesFile, "utf8")));

const inProgressFile = path.join(__dirname, "autosave.json");
let lastResponse;

function readAutosave() {
  try {
    return JSON.parse(fs.readFileSync(inProgressFile, "utf8"));
  }
  catch {}
}

const dataDir = path.join(__dirname, "../data");

/** @type {Record<string, Map<string, number>>} */
const knownCombatSkills = {};

/** @type {Record<string, Map<string, number>>} */
const knownPassiveSkills = {};

for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (path.extname(entry.name) !== ".json") continue;
  const unit = JSON.parse(fs.readFileSync(path.join(dataDir, entry.name), "utf8"));
  registerUnitName(unit.name);
  if (unit.kind !== "adventurer") continue;
  for (const skill of unit.combatSkills) registerCombatSkill(skill.name, skill.description);
  for (const skill of unit.passiveSkills) registerPassiveSkill(skill.name, skill.description);
}

/** @param {string} name */
function registerUnitName(name) {
  unitNames.add(name);
}

/**
 * @param {string} name
 * @param {string} description
 */
function registerCombatSkill(name, description) {
  const entries = knownCombatSkills.hasOwnProperty(name) ? knownCombatSkills[name] : knownCombatSkills[name] = new Map();
  let count = entries.get(description);
  if (!count) {
    entries.set(description, 1);
  }
  else {
    entries.set(description, count + 1);
  }
}

/**
 * @param {string} name
 * @param {string} description
 */
function registerPassiveSkill(name, description) {
  const entries = knownPassiveSkills.hasOwnProperty(name) ? knownPassiveSkills[name] : knownPassiveSkills[name] = new Map();
  let count = entries.get(description);
  if (!count) {
    entries.set(description, 1);
  }
  else {
    entries.set(description, count + 1);
  }
}

function copyLastResponse(field, options = {}) {
  return !lastResponse ? useDefault() :
    options.same ? useLastIfSame :
    useLast();
  function useLastIfSame(prev, response) {
    return lastResponse && response[options.same] === lastResponse[options.same] ? useLast() : useDefault();
  }
  function useLast() {
    const value = lastResponse && lastResponse[field];
    if (value !== undefined) return choose(value);
    return useDefault();
  }
  function useDefault() {
    return choose(options.default);
  }
  function choose(value) {
    if (options.choices) {
      const index = options.choices.findIndex(choice => (choice.value || choice.title || choice) === value);
      return index >= 0 ? index : undefined;
    }
    return value;
  }
}

function filterChoices(input, choices, custom) {
  input = input.toLowerCase();
  let suggestions = [];
  let exact = false;
  for (const choice of choices) {
    if (choice === custom) continue;
    const value = choice.value.toLowerCase();
    if (value === input) exact = true;
    if (value.includes(input)) suggestions.push(choice);
  }
  suggestions = suggestions.slice(0, 9);
  if (!exact && input) {
    suggestions.push(custom);
  }
  return suggestions;
}

/**
 * @param {object} options
 * @param {string} options.name
 * @param {string} options.message
 * @param {(val: string, values: any) => string} [options.format]
 * @param {(prev, responses) => boolean} [options.hide]
 * @param {string | ((prev, responses) => string)} [options.initial]
 * @param {prompts.Choice[] | ((prev, responses) => prompts.Choice[])} options.choices
 * @returns {PromptObject<"autocomplete">}
 */
function autocompleter(options) {
  const plus = kleur.yellow("+");

  function updateCustom(input) {
    custom.title = `${plus}${input ? ` ${input}` : ""}`;
    custom.value = input;
  }

  let initial
  let custom;
  let choices;

  return {
    name: options.name,
    message: options.message,
    format: options.format,
    type(prev, responses) {
      if (options.hide && options.hide(prev, responses)) return null;
      custom = { title: plus, value: "" };
      initial = typeof options.initial === "function"
        ? options.initial(prev, responses)
        : options.initial;
      choices = typeof options.choices === "function"
        ? options.choices(prev, responses).concat(custom)
        : options.choices.concat(custom);
      updateCustom(initial);
      return "autocomplete"
    },
    choices() { return choices },
    fallback() { return initial; },
    initial() { return initial ? choices.length - 1 : undefined; },
    suggest(input, choices) {
      if (!input && initial) {
        updateCustom(initial);
        this.value = initial;
        this.moveSelect(choices.length - 1);
        return [];
      }
      updateCustom(input);
      return filterChoices(input, choices, custom);
    },
    onRender() {
      if (this.first) {
        if (initial) {
          this.value = initial;
          this.moveSelect(choices.length - 1);
        }
      }
      if (!this.input) this.cursor = 0;
      if (this.done && this.suggestions.length === 0 && initial) {
        this.suggestions = [{ title: initial, value: initial }];
        this.select = 0;
      }
    }
  };
}

/** @type {() => PromptObject<"select">[]} */
const kindPrompt = () => [
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

/** @type {() => PromptObject<"text">[]} */
const titlePrompt = () => [
  { type: "text", name: "title", message: "Title", initial: copyLastResponse("title") }
];

/** @type {() => PromptObject<"autocomplete">[]} */
const namePrompt = () => {
  return [autocompleter({
    name: "name",
    message: "Name",
    choices(prev, responses) {
      return [...unitNames]
        .sort(collator.compare)
        .map(name => ({ title: name, value: name }));
    },
    initial() {
      return copyLastResponse("name");
    },
    format(val) {
      const lastName = copyLastResponse("name");
      if (lastName && val !== lastName) {
        lastResponse = undefined;
      }
      return val;
    }
  })];
};

/** @type {() => PromptObject<"select">[]} */
const adventurerTypePrompt = (() => {
  const choices = [
    { title: "P.Attack Type", value: "p.attack" },
    { title: "M.Attack Type", value: "m.attack" },
    { title: "Balance Type", value: "balance" },
    { title: "Healer", value: "healer" },
    { title: "Defense", value: "defense" }
  ];
  const AdventurerType = {
    /** @returns {"select" | null} */
    type(prev, responses) {
      return responses.kind === "adventurer" ? "select" : null;
    },
    choices
  };
  return () => [
    { ...AdventurerType, name: "type", message: "Adventurer Type", initial: copyLastResponse("type", { same: "name", choices }) },
  ];
})();

/** @type {() => PromptObject<"confirm">[]} */
const timeLimitedPrompt = () => [
  { type: "confirm",
    name: "limited",
    message: "Time-limited",
    initial: copyLastResponse("limited", { same: "name" }) },
];

/** @type {() => PromptObject<"number">[]} */
const rarityPrompt = () => [
  { type: "number",
    name: "rarity",
    message: "Rarity",
    min: 1,
    max: 4,
    initial: copyLastResponse("rarity", { same: "name", default: 4 }) },
];

/** @type {(name: string, message: string) => PromptObject<"number">[]} */
const statPrompt = (name, message) => [
  { type: "number", name, message, initial: copyLastResponse(name, { same: "name" }) }
];

/** @type {(prefix: string, message: string) => PromptObject<"autocomplete">[]} */
const combatSkillNamePrompt = (prefix, message) => {
  return [autocompleter({
    name: `${prefix}Name`,
    message: `${message} Name`,
    hide(prev, responses) { return responses.kind !== "adventurer" },
    choices(prev, responses) {
      return Object.keys(knownCombatSkills)
        .sort(collator.compare)
        .map(name => ({ title: name, value: name }));
    },
    initial: copyLastResponse(`${prefix}Name`, { same: "name" })
  })];
};

/** @type {(prefix: string, message: string) => PromptObject<"autocomplete">[]} */
const combatSkillDescriptionPrompt = (prefix, message) => {
  return [autocompleter({
    name: `${prefix}Description`,
    message: `${message} Description`,
    hide(prev, responses) { return responses.kind !== "adventurer" },
    choices(prev, responses) {
      const descriptions = knownCombatSkills.hasOwnProperty(prev) ? [...knownCombatSkills[prev]] : [];
      return descriptions
        .sort(descriptionCollator)
        .map(([text]) => ({ title: text, value: text }));
    },
    initial: copyLastResponse(`${prefix}Description`, { same: `${prefix}Name` })
  })];
};

/** @type {(prefix: string, message: string) => PromptObject<"autocomplete">[]} */
const combatSkillPrompt = (prefix, message) => {
  return [
    ...combatSkillNamePrompt(prefix, message),
    ...combatSkillDescriptionPrompt(prefix, message)
  ];
};

/** @type {(prefix: string, message: string) => PromptObject<"autocomplete">[]} */
const passiveSkillNamePrompt = (prefix, message) => {
  return [autocompleter({
    name: `${prefix}Name`,
    message: `${message} Name`,
    hide(prev, responses) { return responses.kind !== "adventurer" },
    choices(prev, responses) {
      return Object.keys(knownPassiveSkills)
        .sort(collator.compare)
        .map(name => ({ title: name, value: name }));
    },
    initial: copyLastResponse(`${prefix}Name`, { same: "name" })
  })];
};

/** @type {(prefix: string, message: string) => PromptObject<"autocomplete">[]} */
const passiveSkillDescriptionPrompt = (prefix, message) => {
  return [autocompleter({
    name: `${prefix}Description`,
    message: `${message} Description`,
    hide(prev, responses) { return responses.kind !== "adventurer" },
    choices(prev, responses) {
      const descriptions = knownPassiveSkills.hasOwnProperty(prev) ? [...knownPassiveSkills[prev]] : [];
      return descriptions
        .sort(descriptionCollator)
        .map(([text]) => ({ title: text, value: text }));
    },
    initial: copyLastResponse(`${prefix}Description`, { same: `${prefix}Name` })
  })];
};

/** @type {(prefix: string, message: string) => PromptObject<"autocomplete">[]} */
const passiveSkillPrompt = (prefix, message) => [
  ...passiveSkillNamePrompt(prefix, message),
  ...passiveSkillDescriptionPrompt(prefix, message),
];

/** @type {() => PromptObject<"text">[]} */
const assistSkillPrompt = (() => {
  const AssistSkill = {
    /** @returns {"text" | null} */
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
  const savedResponse = readAutosave();
  if (savedResponse) {
    const { restore } = await prompts({ type: "confirm", message: "Unsaved progress found. Restore?", name: "restore", initial: true });
    if (restore) lastResponse = savedResponse;
  }

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
      if (Object.keys(response).length > 0) {
        fs.writeFileSync(inProgressFile, JSON.stringify(response, undefined, "  "));
      }
      console.log("User canceled input");
      return;
    }
    else {
      try {
        fs.unlinkSync(inProgressFile)
      } catch {}
    }

    // fill in generated values
    response.id = `${normalize(response.name)}-${normalize(response.title)}`;
    response.new = args.includes("new");

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

      let match;
      match = nemesisRegExp.exec(response.passiveSkill0Description);
      if (match) response.passiveSkill0Nemesis = match[1];
      match = nemesisRegExp.exec(response.passiveSkill1Description);
      if (match) response.passiveSkill1Nemesis = match[1];
      match = nemesisRegExp.exec(response.passiveSkill2Description);
      if (match) response.passiveSkill2Nemesis = match[1];
      match = nemesisRegExp.exec(response.passiveSkill3Description);
      if (match) response.passiveSkill3Nemesis = match[1];
      match = nemesisRegExp.exec(response.passiveSkill4Description);
      if (match) response.passiveSkill4Nemesis = match[1];
    }

    // populate template
    const content = response.kind === "adventurer"
      ? adventurerTemplate(response)
      : assistTemplate(response);

    // write result
    fs.writeFileSync(path.resolve(__dirname, "../data/", response.id + ".json"), content, "utf8");
    console.log(response.id + ".json added.");

    // check whether we should keep going
    const { keepGoing } = await prompts({ type: "confirm", name: "keepGoing", message: "Create another?", initial: true }, { onCancel: () => { canceled = true }});
    if (!keepGoing) break;

    lastResponse = response;
  }
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/ig, "")
    .replace(/\s+/g, ".");
}

main(process.argv.slice(2));

/**
 * @template {prompts.PromptType} P
 * @typedef {import("prompts").PromptObject<string, any, P>} PromptObject
 */
void 0;