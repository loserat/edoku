// * INFO: Einheitliche JSON-Antworten fuer die neue API-Schicht.
function success(res, data, message = "OK", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message
  });
}

// * INFO: Einheitliches Fehlerformat. Details bleiben bewusst knapp und API-tauglich.
function failure(res, message = "Fehler", code = "API_ERROR", statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code
    }
  });
}

module.exports = {
  failure,
  success
};
