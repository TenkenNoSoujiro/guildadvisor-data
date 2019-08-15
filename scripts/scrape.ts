import fs = require("fs");
import path = require("path");
import coreRequest = require("request");
import yargs = require("yargs");
import handlebars = require("handlebars");
import { JSDOM } from "jsdom";
import { Readable, Writable, Stream } from "stream";
import { EventEmitter } from "events";

const dataDir = path.join(__dirname, "../data");
const resDir = path.join(__dirname, "../.res");
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134";
const request = coreRequest.defaults({
  encoding: null,
  gzip: true,
  headers: {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en",
  }
});

const nemesisRegExp = /\btowards? (?<nemesis>\w+)$/;
const adventurerTemplateFile = path.join(__dirname, "adventurerObject.handlebars");
const adventurerTemplate = handlebars.compile(fs.readFileSync(adventurerTemplateFile, "utf8"), { noEscape: true });
const assistTemplateFile = path.join(__dirname, "assistObject.handlebars");
const assistTemplate = handlebars.compile(fs.readFileSync(assistTemplateFile, "utf8"), { noEscape: true });

const args = yargs.options({
  "url": {
    type: "string",
    description: "The url of the asset page containing unit information.",
    conflicts: "id",
    requiresArg: true,
  },
  "id": {
    type: "number",
    conflicts: "url",
    description: "The ID of the notice containing unit information (from '/asset/notice/view/<id>')",
    requiresArg: true
  }
});

const { argv } = args;

interface BaseUnit {
  id: string;
  kind: "adventurer" | "assist";
  limited?: boolean;
  rarity: number;
  title: string;
  name: string;
  hp: number;
  mp: number;
  str: number;
  end: number;
  dex: number;
  agi: number;
  image?: string;
  thumbnail?: string;
  alias?: string[];
  banner?: string | string[];
  new?: boolean;
}

interface AscensionStats {
  hp: number;
  mp: number;
  str: number;
  end: number;
  dex: number;
  agi: number;
  combinationSkills?: {
    name: string;
    description: string;
    tags?: string[];
  }[];
}

interface CombatSkill {
  specialArts?: boolean;
  name: string;
  description: string;
  mp?: number;
  tags?: string[];
}

interface PassiveSkill {
  name: string;
  description: string;
  tags?: string[];
  nemesis?: string;
}

interface AdventurerUnit extends BaseUnit {
  kind: "adventurer";
  type: "p.attack" | "m.attack" | "balance" | "healer" | "defense";
  ascension?: AscensionStats,
  combatSkills: CombatSkill[];
  passiveSkills: PassiveSkill[];
}

interface AssistSkill {
  name: string;
  descriptions: string[];
  tags?: string[];
}

interface AssistUnit extends BaseUnit {
  kind: "assist";
  skill: AssistSkill;
}

type Unit = AdventurerUnit | AssistUnit;

function parseNameAndTitle(text: string) {
  const match = /^\[\s*(?<title>[^\]]+?)\s*\]\s*(?<name>.*?)\s*$/.exec(text);
  if (!match || !match.groups) return;

  const { title, name } = match.groups;
  return { title, name };
}

function parseUnitType(text: string) {
  const match = /^\s*(?:unit\s+type\s*[:：]\s*)((?:[pm]\.\s*)?\S*)(?:\s+type)?\s*$/i.exec(text.trim());
  if (!match) return failParse("Unit type regexp did not match.");

  const type = match[1].toLowerCase();
  switch (type) {
    case "p. attack": return "p.attack";
    case "m. attack": return "m.attack";
    case "p.attack":
    case "m.attack":
    case "balance":
    case "healer":
    case "defense":
      return type;
    default:
      return failParse(`Unhandled unit type: '${type}'`);
  }
}

function parseStatsCells(cells: NodeListOf<HTMLTableCellElement> | null) {
  if (!cells || cells.length !== 7) return;

  const hp = parseInt(cells[0].textContent!, 10);
  const mp = parseInt(cells[1].textContent!, 10);
  const str = parseInt(cells[2].textContent!, 10);
  const end = parseInt(cells[3].textContent!, 10);
  const dex = parseInt(cells[4].textContent!, 10);
  const agi = parseInt(cells[5].textContent!, 10);
  const mag = parseInt(cells[6].textContent!, 10);
  if (isNaN(hp) || isNaN(mp) || isNaN(str) || isNaN(end) || isNaN(dex) || isNaN(agi) || isNaN(mag)) {
    return;
  }
  return { hp, mp, str, end, dex, agi, mag };
}

function parseSkill(row: HTMLTableRowElement) {
  const cells = row.querySelectorAll("td");
  if (cells.length !== 2) return;
  const nameWithRank = cells[0].textContent;
  const description = cells[1].textContent;
  if (!nameWithRank || !description) return;

  const match = /^(.*?)([:：]\s*[a-z?]+)?$/i.exec(nameWithRank);
  const name = match ? match[1] : nameWithRank;
  return { name: name.trim(), description: description.trim() };
}

function parseCombatSkill(row: HTMLTableRowElement, specialArts: boolean) {
  const skill = parseSkill(row) as CombatSkill | undefined;
  if (!skill) return;

  if (specialArts) {
    skill.specialArts = true;
  }
  return skill;
}

function parsePassiveSkill(row: HTMLTableRowElement): PassiveSkill | undefined {
  const skill = parseSkill(row) as PassiveSkill | undefined;
  if (!skill) return;

  const match = nemesisRegExp.exec(skill.description);
  if (match) {
    skill.nemesis = match[1];
  }
  return skill;
}

function parseAdventurer(characterTable: HTMLTableElement, nextTable: () => HTMLTableElement | undefined, unit: AdventurerUnit): AdventurerUnit | undefined {
  const unitTypeRow = characterTable.rows[2];
  const unitTypeCell = unitTypeRow && unitTypeRow.cells[0];
  if (!unitTypeCell || !unitTypeCell.textContent) return failParse("Could not find unit type <tr>");

  const type = parseUnitType(unitTypeCell.textContent);
  if (!type) return failParse(`Could not parse unit type: '${unitTypeCell.textContent}'`);

  unit.type = type;

  let specialArtsTable = nextTable();
  if (!specialArtsTable) return failParse("Could not find MHA Stats or Special Arts <table>");

  if (specialArtsTable.classList.contains("status-table")) {
    const mhaStatsTable = specialArtsTable;
    specialArtsTable = nextTable();
    if (!specialArtsTable) return failParse("Could not find Special Arts <table>");

    const stats = parseStatsCells(mhaStatsTable.querySelectorAll<HTMLTableCellElement>("tbody > tr > td"));
    if (!stats) return failParse("Could not parse MHA stats");

    unit.ascension = stats as AscensionStats;
  }

  unit.combatSkills = [];
  const specialArts = specialArtsTable.rows[1] && parseCombatSkill(specialArtsTable.rows[1], true);
  if (!specialArts) return failParse("Could not parse Special Arts skill");

  unit.combatSkills.push(specialArts);

  const combatSkillsTable = nextTable();
  if (!combatSkillsTable) return failParse("Could not find Combat Skills <table>");

  const combatSkillsRows = [...combatSkillsTable.rows].slice(1);
  for (const row of combatSkillsRows) {
    const combatSkill = parseCombatSkill(row, false);
    if (!combatSkill) return failParse("Could not parse Combat Skill");

    unit.combatSkills.push(combatSkill);
  }

  if (unit.combatSkills.length !== 4) return failParse("Incorrect number of combat skills");

  const skillsTable = nextTable();
  if (!skillsTable) return failParse("Could not find Skill/Development Abilities <table>");

  unit.passiveSkills = [];
  const skillsRows = [...skillsTable.rows].slice(1);
  for (const row of skillsRows) {
    const skill = parsePassiveSkill(row);
    if (!skill) return failParse("Could not parse Passive Skill");

    unit.passiveSkills.push(skill);
  }

  if (unit.passiveSkills.length !== 5) return failParse("Incorrect number of passive skills.");
  if (nextTable()) return failParse("Unexpected content");

  return unit;
}

function parseAssist(nextTable: () => HTMLTableElement | undefined, unit: AssistUnit): AssistUnit | undefined {
  unit.skill = {} as AssistSkill;

  const skillTable = nextTable();
  if (!skillTable) return failParse("Could not find Assist Skill <table>");

  const skillRows = [...skillTable.rows].slice(1);
  const firstSkillRow = skillRows.shift();
  const firstSkill = firstSkillRow && parseSkill(firstSkillRow);
  if (!firstSkill) return failParse("Could not parse Assist Skill");

  unit.skill.name = firstSkill.name;
  unit.skill.descriptions = [];
  for (const row of skillRows) {
    const skill = parseSkill(row);
    if (!skill) return failParse("Could not parse Assist Skill");

    unit.skill.descriptions.push(skill.description);
  }

  if (unit.skill.descriptions.length !== 2) return failParse("Incorrect number of assist skill descriptions");
  if (nextTable()) return failParse("Unexpected content");

  return unit;
}

function parseUnit(div: HTMLDivElement, limited: boolean, banner: string | undefined): Unit | undefined {
  let i = 0;

  const unit = {} as Unit;
  unit.limited = limited;

  if (banner) {
    unit.banner = banner;
  }

  const tables = div.querySelectorAll<HTMLTableElement>("table.argo-table.heading");

  function nextTable(): HTMLTableElement | undefined {
    return tables[i++];
  }

  const characterTable = nextTable();
  if (!characterTable) return failParse("Could not find character <table>");

  const kindSpan = characterTable.querySelector<HTMLSpanElement>("span.basicRed, span.basicBlue");
  if (!kindSpan) return failParse("Could not find unit kind <span>");

  unit.kind = kindSpan.className === "basicRed" ? "adventurer" : "assist";

  if (!kindSpan.nextSibling || !kindSpan.nextSibling.textContent) return failParse("Could not determine unit rarity");
  unit.rarity = kindSpan.nextSibling.textContent.length;

  const characterNameSpan = characterTable.querySelector<HTMLSpanElement>("span.character-name");
  if (!characterNameSpan || !characterNameSpan.textContent) return failParse("Could not find character name <span>");

  const characterName = parseNameAndTitle(characterNameSpan.textContent);
  if (!characterName) return failParse("Could not parse character name");

  unit.id = `${normalize(characterName.name)}-${normalize(characterName.title)}`;
  unit.title = characterName.title;
  unit.name = characterName.name;

  const unitImage = characterTable.querySelector<HTMLImageElement>("img");
  if (unitImage && unitImage.src) {
    unit.image = unitImage.src;
  }

  const mlbStatsTable = nextTable();
  if (!mlbStatsTable) return failParse("Could not find MLB stats <table>");

  const stats = parseStatsCells(mlbStatsTable.querySelectorAll<HTMLTableCellElement>("tbody > tr > td"));
  if (!stats) return failParse("Could not parse MLB stats");

  Object.assign(unit, stats);

  return unit.kind === "adventurer"
    ? parseAdventurer(characterTable, nextTable, unit)
    : parseAssist(nextTable, unit);

  function normalize(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z\s]/ig, "")
      .replace(/\s+/g, ".");
  }
}

function failParse(...args: any[]) {
  console.error(...args);
  return undefined;
}

async function saveUnit(unitFile: string, unit: Unit) {
  await saveImage(unit);
  switch (unit.kind) {
    case "adventurer": return saveAdventurerUnit(unitFile, unit);
    case "assist": return saveAssistUnit(unitFile, unit);
  }
}

function responded(request: coreRequest.Request) {
  return new Promise<coreRequest.Response>((resolve, reject) => {
      request.on("response", resolve);
      request.on("error", reject);
  });
}

function finished(stream: Readable | Writable | Stream, { readable = (<Readable>stream).readable, writable = (<Writable>stream).writable } = {}) {
  return new Promise((resolve, reject) => {
      let countdown = 0;
      const cleanup = () => {
          if (readable) (<Readable>stream).removeListener("end", signal);
          if (writable) (<Writable>stream).removeListener("finish", signal);
          (<EventEmitter>stream).removeListener("error", fail);
      };
      const fail = (e: any) => {
          cleanup();
          reject(e);
      };
      const signal = () => {
          countdown--;
          if (countdown === 0) {
              cleanup();
              resolve();
          }
      };
      if (readable) (<Readable>stream).on("end", signal), countdown++;
      if (writable) (<Writable>stream).on("finish", signal), countdown++;
      (<EventEmitter>stream).on("error", reject);
  });
}

async function saveImage(unit: Unit) {
  const image = unit.image;
  unit.image = `${unit.id}-full.png`;
  unit.thumbnail = `${unit.id}-thumb.png`;

  if (image) {
    const imagePath = path.resolve(resDir, unit.id + "-full.png");
    if (fs.existsSync(imagePath)) {
      console.log(`'${unit.image}' already exists, skipping.`);
      return;
    }

    const tmp = imagePath + '.downloading';
    try { fs.unlinkSync(tmp); } catch {}

    let req = request(image);
    req.pause();

    let response = await responded(req);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.error(`Failed to download video: ${response.statusCode} ${response.statusMessage}`);
      return;
    }

    const stream = fs.createWriteStream(tmp, { autoClose: true });
    try {
      response.pipe(stream, { end: true });
      if (response.isPaused()) response.resume();
      await finished(stream);
    }
    catch {
      stream.close();
    }

    fs.renameSync(tmp, imagePath);
    console.log(`'${unit.image}' saved.`);
  }
}

function saveAdventurerUnit(unitFile: string, unit: Unit) {
  const options = { helpers: { json(value: any) { return JSON.stringify(value); } } };
  const data = adventurerTemplate(unit, options);
  fs.writeFileSync(unitFile, data, "utf8");
}

function saveAssistUnit(unitFile: string, unit: Unit) {
  const options = { helpers: { json(value: any) { return JSON.stringify(value); } } };
  const data = assistTemplate(unit, options);
  fs.writeFileSync(unitFile, data, "utf8");
}

async function main() {
  const url = argv.url || (argv.id && `https://api-danmemo-us.wrightflyer.net/asset/notice/view/${argv.id}?`);
  if (!url) {
    args.help();
    return process.exit(-1);
  }

  console.log(`Fetching ${url}...`);

  const dom = await JSDOM.fromURL(url, {
    userAgent,
    runScripts: "outside-only"
  });

  const document = dom.window.document;
  const main = document.querySelector<HTMLDivElement>("div.mainBlcok");
  if (!main) {
    console.error("Could not find article content");
    return process.exit(1);
  }

  const mainContent = main.textContent;
  if (!mainContent) {
    console.error("Could not find article content");
    return process.exit(1);
  }

  const descriptionHeading = [...main.querySelectorAll<HTMLHeadingElement>("h3")].find(h3 => /description/i.test(h3.textContent || ""));
  const bannerNode = descriptionHeading && descriptionHeading.nextSibling;
  let banner: string | undefined;
  if (bannerNode && bannerNode.textContent) {
    const match = /^(.*?)\s*gacha/i.exec(bannerNode.textContent.trim());
    if (match) banner = match[1];
  }

  const limited = !/these are not time-limited units/i.test(mainContent);

  const units = [...main.querySelectorAll<HTMLDivElement>("div.algo-Grid > div.grid-cell:not(:empty)")]
    .map(div => parseUnit(div, limited, banner));

  for (const unit of units) {
    if (!unit) continue;
    const unitPath = path.resolve(dataDir, unit.id + ".json");
    // if (fs.existsSync(unitPath)) {
    //   console.log(`${unit.id} exists, skipping.`);
    //   continue;
    // }

    await saveUnit(unitPath, unit);
    console.log(`${unit.id} added`);
  }
}

main().catch(console.error);