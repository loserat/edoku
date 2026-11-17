const http = require("node:http");
const request = http.get({ hostname: "127.0.0.1", port: Number(process.env.PORT || 3000), path: "/ready", timeout: 3000 }, response => {
  let body = "";
  response.setEncoding("utf8");
  response.on("data", part => { body += part; if (body.length > 4096) request.destroy(new Error("Ungültige Bereitschaftsantwort.")); });
  response.on("end", () => {
    try { if (response.statusCode !== 200 || JSON.parse(body).status !== "ready") process.exitCode = 1; }
    catch { process.exitCode = 1; }
  });
  response.on("error", () => { process.exitCode = 1; });
});
request.on("timeout", () => request.destroy(new Error("Bereitschaftsprüfung ohne Antwort.")));
request.on("error", () => { process.exitCode = 1; });
