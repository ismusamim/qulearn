/**
 * Arabic text helpers shared by client and server.
 */

/**
 * Normalises Arabic for search and equality: strips diacritics and tatweel,
 * unifies hamza forms (أ إ آ → ا), ة → ه, ى → ي, collapses whitespace and
 * treats «عبد الله» and «عبدالله» as the same name.
 */
export function normalizeArabic(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^| )عبد /g, "$1عبد")
    .toLowerCase();
}

/**
 * Canonical spelling for a stored name: single spaces, and «عبدالله» → «عبد الله»,
 * «عبدالرحمن» → «عبد الرحمن», «عبدربه» → «عبد ربه» («عبده» is left alone).
 */
export function fixName(name: string | null | undefined): string {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)عبد(?=ال|رب)/g, "$1عبد ");
}

/** Converts Arabic-Indic and Persian digits to ASCII digits. */
export function toLatinDigits(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776));
}

/**
 * Phone numbers are stored as digits only. Restores the leading zero that
 * spreadsheets drop from Egyptian mobile numbers (10 digits starting with 1).
 */
export function normalizePhone(value: string | null | undefined): string {
  let digits = toLatinDigits(value).replace(/\D/g, "");
  if (/^1\d{9}$/.test(digits)) digits = "0" + digits;
  return digits;
}
