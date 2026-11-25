const fs = require("node:fs/promises"), path = require("node:path");
const area = "Elektroinstallation / DIN VDE 0100";
async function setup({ root }) {
  const write = (name, value) => fs.writeFile(path.join(root, "data", name + ".json"), JSON.stringify(value));
  await write("leistungsbereiche", { optionen: [area], aktiv: [], systemAuswahl: {} });
  await write("systeme", { leistungsbereiche: [{ name: area, code: "TEST", hersteller: [{ name: "Beispielhersteller", systemarten: ["Testinstallation"], systeme: ["Testsystem"], dokumentarten: ["Bedienungsanleitung"], normen: [], kapitel: ["6.4"], geraetelisteKapitel: "6.4" }] }] });
  await write("geraetelisten", []);
  const doc = (id, kapitel, titel, extra = {}) => ({ id, kapitel, titel, aktiv: true, export: true, pflicht: false, ebene: kapitel.split(".").length, leistungsbereich: "Allgemein", sortierung: Number(kapitel.replaceAll(".", "")) * 100, ...extra });
  await write("dokumentenmatrix", [doc("description", "1.1", "Anlagenbeschreibung", { dokumenttyp: "Anlagenbeschreibung", pflicht: true }), doc("devices", "6.4", "Gerätelisten", { quelle: "data/geraetelisten.json", dokumenttyp: "Kapitel" }), doc("manuals", "3.2", "Bedienungsanleitungen", { dokumenttyp: "Plan", formularart: "Dateiliste" })]);
}

module.exports = { setup, area };
