const fs = require("fs/promises");
const path = require("path");

const PROJECT_ROOTS = [
  "00_Projektdatei",
  "01_Eingang",
  "02_Config_Projekt",
  "03_Manuell_einfuegen",
  "04_Generiert",
  "05_PDF_Merge",
  "06_Final"
];

const CONFIG_CHAPTER_FOLDERS = [
  "01_Betriebskarteien",
  "02_Konformitaet_CE",
  "03_Anlagenbeschreibung_Bedienung",
  "04_Bedienung_Betrieb_Instandhaltung",
  "05_Unfallverhuetungsvorschriften",
  "06_Geraeteliste",
  "07_Produkt_Datenblaetter",
  "08_Abnahme_Maengelbeseitigung",
  "09_Einweisungsprotokolle",
  "10_Messprotokolle",
  "11_Sonstige_Bescheinigungen",
  "12_Bestandsplaene",
  "13_Sonstiges"
];

function sanitizePart(value, fallback) {
  const cleaned = String(value || "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function projectFolderName(projekt) {
  const nummer = sanitizePart(projekt.projektnummer, "ohne_nummer");
  const name = sanitizePart(projekt.projektname, "Projekt");
  return `${nummer}_${name}`;
}

function getProjectPaths(rootDir, projekt) {
  const projectPath = path.join(rootDir, "output", "projekte", projectFolderName(projekt));
  return {
    projectPath,
    configPath: path.join(projectPath, "02_Config_Projekt"),
    generatedPath: path.join(projectPath, "04_Generiert"),
    mergePath: path.join(projectPath, "05_PDF_Merge"),
    finalPath: path.join(projectPath, "06_Final")
  };
}

async function createProjectFolder(rootDir, projekt) {
  const paths = getProjectPaths(rootDir, projekt);
  await fs.mkdir(path.join(rootDir, "output", "projekte"), { recursive: true });

  for (const folder of PROJECT_ROOTS) {
    await fs.mkdir(path.join(paths.projectPath, folder), { recursive: true });
  }

  for (const folder of CONFIG_CHAPTER_FOLDERS) {
    await fs.mkdir(path.join(paths.configPath, folder), { recursive: true });
  }

  return paths;
}

function chapterFolderForKapitel(kapitel) {
  const hauptkapitel = String(kapitel || "").split(".")[0].padStart(2, "0");
  return CONFIG_CHAPTER_FOLDERS.find((folder) => folder.startsWith(`${hauptkapitel}_`)) || "";
}

function fileSafeName(value, fallback = "Dokument") {
  return sanitizePart(value, fallback).slice(0, 120);
}

module.exports = {
  CONFIG_CHAPTER_FOLDERS,
  chapterFolderForKapitel,
  createProjectFolder,
  fileSafeName,
  getProjectPaths,
  projectFolderName
};
