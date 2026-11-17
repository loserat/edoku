// Nur neue oder ausdrücklich geänderte Passwörter prüfen. Bestehende Hashes bleiben gültig.
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 256;

function validateNewPassword(value) {
  const password = String(value || "");
  if (!password.trim() || password.length < PASSWORD_MIN_LENGTH) {
    throw Object.assign(new Error(`Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen enthalten und darf nicht nur aus Leerzeichen bestehen.`), { status: 400 });
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw Object.assign(new Error(`Das Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen enthalten.`), { status: 400 });
  }
  return password;
}

module.exports = { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validateNewPassword };
