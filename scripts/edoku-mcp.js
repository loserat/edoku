const { serveStdio } = require("@modelcontextprotocol/server/stdio");
const { createMcpServer } = require("../services/mcpServerService");

try {
  const config = {
    responseMode: process.env.EDOKU_MCP_RESPONSE_MODE || "structured",
    baseUrl: process.env.EDOKU_API_URL || "http://127.0.0.1:3000",
    token: process.env.EDOKU_API_TOKEN,
    documentRoot: process.env.EDOKU_MCP_DOCUMENT_ROOT || "",
    allowWrites: process.env.EDOKU_MCP_ALLOW_WRITES === "true"
  };
  // Konfiguration vor dem Öffnen des Transports prüfen. stdout gehört nur MCP.
  createMcpServer(config);
  serveStdio(() => createMcpServer(config), { onerror: () => console.error("MCP-Transportfehler; Verbindung prüfen.") });
} catch (error) {
  console.error("edoku MCP konnte nicht starten:", error.message);
  process.exitCode = 1;
}
