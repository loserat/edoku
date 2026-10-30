const fs = require("fs/promises");
const { createReadStream } = require("fs");
const path = require("path");
const crypto = require("crypto");

const table = Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

// Streaming-ZIP ohne ZIP64; keine vollständigen Uploads/Archive im Arbeitsspeicher.
async function writeZipFile(zipPath, files) {
  if (files.length > 65535) throw new Error("Zu viele Dateien für ein ZIP-Paket.");
  const temporary = `${zipPath}.${crypto.randomUUID()}.tmp`;
  const central = [];
  const names = new Set();
  let handle, offset = 0;
  const date = new Date();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  try {
    await fs.mkdir(path.dirname(zipPath), { recursive: true });
    handle = await fs.open(temporary, "wx", 0o600);
    async function write(buffer) {
      if (offset + buffer.length > 0xffffffff) throw new Error("Das Paket ist für dieses ZIP-Format zu groß.");
      await handle.writeFile(buffer); offset += buffer.length;
    }
    for (const file of files) {
      const relative = String(file.zipPath).replaceAll("\\", "/");
      if (!relative || relative.startsWith("/") || relative.split("/").some(p => !p || p === "." || p === "..") || /^[A-Za-z]:/.test(relative) || names.has(relative)) throw new Error("Ungültiger oder doppelter Pfad im ZIP-Paket.");
      names.add(relative);
      const info = await fs.lstat(file.sourcePath);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("ZIP-Pakete dürfen nur reguläre Dateien enthalten.");
      const name = Buffer.from(relative, "utf8");
      if (name.length > 65535 || info.size > 0xffffffff) throw new Error("Datei für dieses ZIP-Format zu groß.");
      const start = offset;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0808, 6);
      local.writeUInt16LE(time, 10); local.writeUInt16LE(day, 12); local.writeUInt16LE(name.length, 26);
      await write(local); await write(name);
      let crc = 0xffffffff, size = 0;
      for await (const chunk of createReadStream(file.sourcePath)) {
        for (const byte of chunk) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        size += chunk.length; await write(chunk);
      }
      if (size !== info.size) throw new Error("Eine Paketdatei wurde während des Exports verändert.");
      crc = (crc ^ 0xffffffff) >>> 0;
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc, 4); descriptor.writeUInt32LE(size, 8); descriptor.writeUInt32LE(size, 12);
      await write(descriptor);
      const record = Buffer.alloc(46);
      record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x0808, 8);
      record.writeUInt16LE(time, 12); record.writeUInt16LE(day, 14); record.writeUInt32LE(crc, 16);
      record.writeUInt32LE(size, 20); record.writeUInt32LE(size, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(start, 42);
      central.push(record, name);
    }
    const start = offset;
    for (const chunk of central) await write(chunk);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(offset - start, 12); end.writeUInt32LE(start, 16);
    await write(end); await handle.sync(); await handle.close(); handle = null;
    await fs.rename(temporary, zipPath);
  } finally {
    if (handle) await handle.close();
    await fs.unlink(temporary).catch(() => {});
  }
}

module.exports = { writeZipFile };
