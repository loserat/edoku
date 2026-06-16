const http = require("http");
const https = require("https");

const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const checks = [
  ["/api/health", 200],
  ["/api/projects", 200],
  ["/api/projects/musterprojekt", 200],
  ["/api/projects/unbekannt", 404],
  ["/api/service-areas", 200],
  ["/api/service-areas/elektroinstallation", 200],
  ["/api/device-lists", 200],
  ["/api/device-lists/hv-technik", 200],
  ["/api/documents", 200],
  ["/api/documents/anlagenbeschreibung", 200],
  ["/api/exports/status", 200],
  ["/api/does-not-exist", 404]
];

function requestJson(pathname) {
  const url = new URL(pathname, baseUrl);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ statusCode: res.statusCode, json });
        } catch (error) {
          reject(new Error(`${pathname} lieferte kein JSON: ${error.message}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`${pathname} Timeout nach 5000ms`));
    });
  });
}

(async () => {
  for (const [pathname, expectedStatus] of checks) {
    const response = await requestJson(pathname);
    const hasValidEnvelope = typeof response.json.success === "boolean"
      && (response.json.success ? Object.prototype.hasOwnProperty.call(response.json, "data") : response.json.error && response.json.error.message && response.json.error.code);

    if (response.statusCode !== expectedStatus || !hasValidEnvelope) {
      throw new Error(`${pathname} fehlgeschlagen: Status ${response.statusCode}, Envelope ${hasValidEnvelope}`);
    }

    console.log(`OK ${response.statusCode} ${pathname}`);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
