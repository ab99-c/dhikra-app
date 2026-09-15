/**
 * Lightweight timing engine for Dhikra reminders.
 *
 * When the user picks "decide_for_me", the engine recommends the next review
 * moment from their own history instead of calling an external ML service:
 *  - median time between capture and first revisit across their library
 *  - most common hour-of-day they capture content
 *  - fallback: most frequent explicit delay preference, then 3 days.
 */

import type { ContentLibraryItem } from "@/shared/content-library";

export const DELAY_PRESETS_MS: Record<string, number> = {
  "3_hours": 3 * 60 * 60 * 1000,
  tomorrow: 24 * 60 * 60 * 1000,
  "3_days": 3 * 24 * 60 * 60 * 1000,
  "1_week": 7 * 24 * 60 * 60 * 1000,
};

const DEFAULT_DELAY_MS = DELAY_PRESETS_MS["3_days"];
const MIN_DELAY_MS = DELAY_PRESETS_MS["3_hours"];
const MAX_DELAY_MS = 14 * 24 * 60 * 60 * 1000;

export type ReminderPlan = {
  scheduledForIso: string;
  delayMs: number;
  preferredHour: number | null;
  reason: string;
};

export function medianGapMs(items: ContentLibraryItem[]): number | null {
  const gaps = items
    .filter((item) => item.revisitCount > 0 && item.capturedAt && item.updatedAt)
    .map((item) => new Date(item.updatedAt).getTime() - new Date(item.capturedAt).getTime())
    .filter((gap) => Number.isFinite(gap) && gap >= 0)
    .sort((a, b) => a - b);
  if (gaps.length < 3) return null;
  const middle = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 1
    ? gaps[middle]
    : Math.round((gaps[middle - 1] + gaps[middle]) / 2);
}

export function modeDelayPrefMs(items: ContentLibraryItem[]): number | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.userDelayPref === "decide_for_me") continue;
    counts.set(item.userDelayPref, (counts.get(item.userDelayPref) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [pref, count] of counts) {
    if (count > bestCount) {
      best = pref;
      bestCount = count;
    }
  }
  return best ? (DELAY_PRESETS_MS[best] ?? null) : null;
}

export function modeCaptureHour(items: ContentLibraryItem[]): number | null {
  const buckets = new Map<number, number>();
  for (const item of items) {
    if (!item.capturedAt) continue;
    const date = new Date(item.capturedAt);
    if (Number.isNaN(date.getTime())) continue;
    const hour = Math.floor(date.getHours() / 2) * 2; // 2-hour buckets
    buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [hour, count] of buckets) {
    if (count > bestCount) {
      best = hour;
      bestCount = count;
    }
  }
  return best;
}

export function planNextReminder(items: ContentLibraryItem[], now: Date): ReminderPlan {
  const medianGap = medianGapMs(items);
  if (medianGap !== null) {
    const delayMs = Math.min(Math.max(medianGap, MIN_DELAY_MS), MAX_DELAY_MS);
    return buildPlan(now, delayMs, modeCaptureHour(items), "على حساب الفترة المعتادة ديالك بين الالتقاط والمراجعة");
  }

  const modeDelay = modeDelayPrefMs(items);
  if (modeDelay !== null) {
    return buildPlan(now, modeDelay, modeCaptureHour(items), "على حساب الخيار اللي كتختارو غالبا");
  }

  return buildPlan(now, DEFAULT_DELAY_MS, modeCaptureHour(items), "افتراضي: من بعد 3 أيام");
}

function buildPlan(now: Date, delayMs: number, preferredHour: number | null, reason: string): ReminderPlan {
  const scheduled = new Date(now.getTime() + delayMs);
  if (preferredHour !== null) {
    scheduled.setHours(preferredHour, 0, 0, 0);
    if (scheduled.getTime() <= now.getTime()) {
      scheduled.setDate(scheduled.getDate() + 1);
    }
  }
  return {
    scheduledForIso: scheduled.toISOString(),
    delayMs,
    preferredHour,
    reason,
  };
}
