const { failure } = require("../utils/apiResponse");

// * INFO: API-404 fuer unbekannte Endpunkte innerhalb von /api.
function notFoundHandler(req, res) {
  return failure(res, "API-Endpunkt nicht gefunden", "API_NOT_FOUND", 404);
}

module.exports = notFoundHandler;
