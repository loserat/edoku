const { failure } = require("../utils/apiResponse");

// * INFO: Zentraler API-Fehlerhandler. Bestehende HTML-Fehlerwege bleiben unberuehrt.
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  console.error("API-Fehler:", error.message);
  return failure(res, "Interner API-Fehler", "API_INTERNAL_ERROR", 500);
}

module.exports = errorHandler;
