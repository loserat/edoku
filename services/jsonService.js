const fs = require("fs/promises");
const path = require("path");

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Fehler beim Lesen von ${filePath}:`, error.message);
    return fallback;
  }
}

async function writeJson(filePath, data) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    return { ok: true };
  } catch (error) {
    console.error(`Fehler beim Schreiben von ${filePath}:`, error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  readJson,
  writeJson
};
