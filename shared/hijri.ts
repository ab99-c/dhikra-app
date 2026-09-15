/**
 * Hijri date helpers for the Dhikra clock header.
 *
 * Strategy: prefer the browser/Node Intl Umm al-Qura calendar when available
 * (accurate, matches Saudi Arabia), and fall back to a pure-JS tabular
 * (Kuwaiti) approximation on runtimes with limited Intl support (Hermes).
 */

export type HijriDate = {
  year: number;
  month: number; // 1..12
  day: number;
};

export const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
] as const;

// Julian day number for a Gregorian calendar date (integer, noon-based).
function gregorianToJulianDay(year: number, month: number, day: number): number {
  return (
    Math.floor((1461 * (year + 4800 + Math.floor((month - 14) / 12))) / 4) +
    Math.floor((367 * (month - 2 - 12 * Math.floor((month - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((year + 4900 + Math.floor((month - 14) / 12)) / 100)) / 4) +
    day -
    32075
  );
}

/** Tabular (civil) Hijri conversion — deterministic, works without Intl ICU. */
export function gregorianToHijriTabular(date: Date): HijriDate {
  const jd = gregorianToJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 =
    l2 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

function readPart(parts: Intl.DateTimeFormatPart[], type: string): number | null {
  const part = parts.find((candidate) => candidate.type === type);
  if (!part) return null;
  const value = Number(part.value.replace(/[^0-9]/g, ""));
  return Number.isFinite(value) ? value : null;
}

/** Hijri date, preferring the accurate Intl Umm al-Qura calendar. */
export function hijriDate(date: Date): HijriDate {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const year = readPart(parts, "year");
    const month = readPart(parts, "month");
    const day = readPart(parts, "day");
    if (year && month && day) return { year, month, day };
  } catch {
    // Fall through to the tabular approximation.
  }
  return gregorianToHijriTabular(date);
}

export function formatHijri(date: HijriDate): string {
  const monthName = HIJRI_MONTHS[date.month - 1] ?? "";
  return `${date.day} ${monthName} ${date.year}هـ`;
}
