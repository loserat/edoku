const crypto = require("node:crypto");

function prepareResponse(req, res, next) {
  req.apiRequestId = crypto.randomUUID();
  res.set({ "X-Request-Id": req.apiRequestId, "Cache-Control": "no-store" });
  next();
}
function ok(req, res, data, status = 200) {
  return res.status(status).json({ success: true, data, requestId: req.apiRequestId });
}
function apiError(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  const codes = { 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 412: "PRECONDITION_FAILED", 413: "PAYLOAD_TOO_LARGE", 415: "UNSUPPORTED_MEDIA_TYPE", 428: "PRECONDITION_REQUIRED", 429: "RATE_LIMITED", 503: "UNAVAILABLE" };
  if (status >= 500) console.error("Integrations-API:", req.apiRequestId, error.apiCode || codes[status] || "INTERNAL_ERROR");
  return res.status(status).json({ success: false, error: {
    code: error.apiCode || codes[status] || "INTERNAL_ERROR",
    message: status >= 500 ? "Anfrage konnte nicht ausgeführt werden. Bitte Serverstatus prüfen." :
      error.type === "entity.parse.failed" ? "Ungültiges JSON." : error.message,
    ...(error.apiCode==='PRODUCT_DOCUMENT_UNCONFIRMED'&&error.verification?{verification:require('../../services/productDocumentVerificationService').compactVerification(error.verification)}:{})
  }, requestId: req.apiRequestId });
}
module.exports = { prepareResponse, ok, apiError };
