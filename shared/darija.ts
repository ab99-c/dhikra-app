/**
 * Darija/Arabic text normalization for search.
 *
 * Arabic spelling varies a lot in everyday typing:
 *  - أ/إ/آ/ٱ are all written as plain ا
 *  - ة is often typed ه, ى as ي, ؤ as و
 *  - hamza (ء/ئ) is frequently dropped
 *  - tashkeel (ذِكْرى vs ذكرى) and tatweel are noise
 *
 * Normalizing both the query and the stored text before comparing makes
 * substring search forgiving across all of these variations.
 */

// Arabic diacritics (fatha .. sukun), superscript alef and tatweel.
const TASHKEEL = /[\u064B-\u0652\u0670\u0640]/g;
// Invisible bidirectional marks.
const BIDI_MARKS = /[\u200E\u200F]/g;

const LETTER_VARIANTS: [RegExp, string][] = [
  [/[أإآٱ]/g, "ا"], // alef variants
  [/[ؤ]/g, "و"], // waw with hamza
  [/[ئ]/g, "ي"], // yeh with hamza
  [/[ء]/g, ""], // standalone hamza
  [/[ة]/g, "ه"], // ta marbuta
  [/[ى]/g, "ي"], // alef maksura
  [/[\u06A9]/g, "ك"], // Persian keheh -> Arabic kaf
  [/[\u06CC]/g, "ي"], // Persian yeh -> Arabic yeh
  [/[\u06BE]/g, "ه"], // Urdu heh doachashmee -> Arabic heh
];

export function normalizeArabicText(input: string | null | undefined): string {
  let text = input ?? "";
  text = text.replace(TASHKEEL, "").replace(BIDI_MARKS, "");
  for (const [pattern, replacement] of LETTER_VARIANTS) {
    text = text.replace(pattern, replacement);
  }
  return text.trim().toLowerCase();
}

/** True when `haystack` contains `needle` after Arabic normalization. */
export function matchesNormalized(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  const normalizedNeedle = normalizeArabicText(needle);
  if (!normalizedNeedle) return true;
  return normalizeArabicText(haystack).includes(normalizedNeedle);
}
