const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

// * INFO: Robustes JSON-Lesen mit Fallback. Fehler werden protokolliert, damit eine
// * INFO: fehlende oder defekte Projektdatei nicht sofort die ganze Anwendung stoppt.
async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    console.error(`Fehler beim Lesen von ${filePath}:`, error.message);
    throw Object.assign(new Error("Eine gespeicherte Datei ist nicht lesbar. Der vorhandene Stand wurde nicht ersetzt.", { cause: error }), { code: "READ_FAILED" });
  }
}

// * INFO: Schreibt JSON formatiert auf die Platte und legt den Zielordner bei Bedarf an.
async function writeJson(filePath, data) {
  let temporary;
  try {
    const content = `${JSON.stringify(data, null, 2)}\n`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    let mode = 0o600;
    try {
      const previous = await fs.lstat(filePath);
      if (!previous.isFile() || previous.isSymbolicLink()) throw new Error("Ungültiges Speicherziel.");
      mode = previous.mode & 0o777;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
    const handle = await fs.open(temporary, "wx", mode);
    try { await handle.writeFile(content, "utf8"); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temporary, filePath);
    return { ok: true };
  } catch (error) {
    console.error(`Fehler beim Schreiben von ${filePath}:`, error.message);
    throw Object.assign(new Error("Speichern fehlgeschlagen. Der vorherige Dateistand bleibt erhalten. Bitte erneut versuchen.", { cause: error }), { code: "WRITE_FAILED" });
  } finally {
    if (temporary) await fs.unlink(temporary).catch(() => {});
  }
}

module.exports = {
  readJson,
  writeJson
};
