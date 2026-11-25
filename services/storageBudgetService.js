const fs = require("node:fs/promises");
const path = require("node:path");
const { assertSafePath, sanitizeId } = require("./pathService");

function limitFromEnvironment(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Ungültiges Speicherlimit: ${name}`);
  return value;
}

// Einschließlich Papierkorb, Ausgabeverlauf und Projektpaketen zählen. Ein Löschen in
// der Oberfläche darf das Budget nicht durch Verschieben in die Historie umgehen.
function createStorageBudget(rootDir, {
  maxBytes = limitFromEnvironment("EDOKU_MAX_USER_STORAGE_BYTES", 5 * 1024 ** 3),
  minFreeBytes = limitFromEnvironment("EDOKU_MIN_FREE_STORAGE_BYTES", 256 * 1024 ** 2),
  maxEntries = 25000
} = {}) {
  return async (userId, incomingBytes = 0) => {
    const failure = () => Object.assign(new Error("Das Speicherbudget ist erreicht oder es ist zu wenig freier Speicher verfügbar. Vorhandene Daten bleiben erhalten; bitte die Administration kontaktieren."), { status: 507 });
    if (!Number.isSafeInteger(incomingBytes) || incomingBytes < 0 || incomingBytes > maxBytes) throw failure();
    const stat = await fs.statfs(path.join(rootDir, "storage"));
    if (stat.bavail * stat.bsize < minFreeBytes + incomingBytes) throw failure();
    let bytes = incomingBytes, entries = 0;
    const user = sanitizeId(userId);
    const pending = [path.join(rootDir, "storage", "users", user), path.join(rootDir, "storage", "exports", user)];
    while (pending.length) {
      const target = pending.pop();
      await assertSafePath(rootDir, target, { allowMissing: true });
      let info;
      try { info = await fs.lstat(target); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
      if (++entries > maxEntries) throw failure();
      if (info.isDirectory()) {
        const children = await fs.readdir(target);
        if (children.length + entries + pending.length > maxEntries) throw failure();
        pending.push(...children.map(name => path.join(target, name)));
      } else { bytes += info.size; }
      if (bytes > maxBytes) throw failure();
    }
    return { bytes, entries };
  };
}

module.exports = { createStorageBudget };
