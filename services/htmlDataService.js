// JSON bleibt JSON, auch wenn es im HTML-Rohtext eines script-Elements steht.
// Insbesondere darf ein gespeicherter Titel den Datenblock nicht mit </script> beenden.
function jsonForHtml(value) {
  return JSON.stringify(value === undefined ? null : value).replace(/[<>&\u2028\u2029]/g, character => ({
    "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029"
  })[character]);
}

module.exports = { jsonForHtml };
