const fault = (message, status, code) => Object.assign(new Error(message), { status, apiCode: code });
function parse(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw fault("Ungültige Eingabe. Bitte das API-Schema prüfen.", 400, "VALIDATION_ERROR");
  return parsed.data;
}
module.exports = { parse, fault };
