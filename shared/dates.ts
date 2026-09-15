/** Moroccan calendar formatting helpers shared across screens. */

export const MOROCCAN_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو",
  "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر",
] as const;

export const WEEKDAYS = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
] as const;

/** e.g. «الثلاثاء 22 شتنبر 2026» */
export function formatMoroccanDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MOROCCAN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** e.g. «10:45:12» (24h, local time) */
export function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** e.g. «22 شتنبر 2026 · 10:00» from an ISO string. */
export function formatMoroccanDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${MOROCCAN_MONTHS[date.getMonth()]} ${date.getFullYear()} · ${hh}:${mm}`;
}

/** Africa/Casablanca is permanently UTC+1 (no DST since 2018). */
export const MOROCCO_UTC_OFFSET_MS = 60 * 60 * 1000;

export function formatMoroccoClock(localNow: Date): string {
  const shifted = new Date(localNow.getTime() + MOROCCO_UTC_OFFSET_MS);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
