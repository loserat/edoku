const { z } = require('zod');

const text = z.string().max(500);
const dimension = z.number().finite().positive().max(100000).nullable();
// Existing GUI names remain authoritative; physical dimensions are explicit mm values.
const fields = z.object({
  geschoss: text, raum: text, bauteil: text, abschottungssystem: text,
  hersteller: text, system: text, zulassung: text, feuerwiderstand: text,
  medium: text, anzahl_kabel: text, durchmesser: text,
  ausfuehrungsdatum: z.union([z.literal(''), z.iso.date()]), monteur: text,
  bemerkung: z.string().max(1000), wallType: text,
  wallThicknessMm: dimension, openingWidthMm: dimension,
  openingHeightMm: dimension, sealDepthMm: dimension,
  fireResistanceMinutes: z.number().int().positive().max(1440).nullable(),
  components: z.array(z.string().trim().min(1).max(200)).max(20)
}).partial().strict().refine(value => Object.keys(value).length > 0, 'Mindestens ein bestätigtes Feld angeben.');
const evidence = z.object({
  sourceLabel: z.string().trim().min(1).max(200),
  sourceQuote: z.string().trim().min(1).max(3000)
}).strict();
const input = z.object({ values: fields, evidence }).strict();
module.exports = { fields, input };
