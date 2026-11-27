const path = require("node:path");
const { z } = require("zod");
const { readJson, writeJson } = require("./jsonService");
const { assertSafePath } = require("./pathService");

const settingsSchema = z.object({
  apiEnabled: z.boolean().default(true),
  allowWrites: z.boolean().default(true),
  remoteMcpEnabled: z.boolean().default(false),
  defaultTokenDays: z.number().int().min(1).max(365).default(90),
  maxTokenDays: z.number().int().min(1).max(365).default(365)
}).strict().refine(value => value.defaultTokenDays <= value.maxTokenDays, "Die Standardgültigkeit darf die maximale Gültigkeit nicht überschreiten.");

function createIntegrationSettingsService(root) {
  const file = path.join(root, "config", "integrationen.json");
  async function read() {
    await assertSafePath(root, file, { allowMissing: true, type: "file" });
    const result = settingsSchema.safeParse(await readJson(file, {}));
    if (!result.success) throw Object.assign(new Error("Die Integrationseinstellungen sind ungültig. Bitte die Konfiguration prüfen."), { status: 503 });
    return result.data;
  }
  async function save(value) {
    const result = settingsSchema.safeParse(value);
    if (!result.success) throw Object.assign(new Error("Bitte gültige Schalter und eine Gültigkeit zwischen 1 und 365 Tagen wählen. Die Standardgültigkeit darf die maximale Gültigkeit nicht überschreiten."), { status: 400 });
    await assertSafePath(root, file, { allowMissing: true, type: "file" });
    await writeJson(file, result.data);
    return result.data;
  }
  return { read, save };
}
module.exports = { createIntegrationSettingsService };
