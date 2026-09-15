import type { ContentLibraryItem, ContentTheme } from "./content-library";

export const MOOD_STATES = ["stressed", "low", "neutral", "joyful"] as const;
export type MoodState = (typeof MOOD_STATES)[number];

export const moodLabel: Record<MoodState, string> = {
  stressed: "مضغوط",
  low: "هابط شوية",
  neutral: "هادي",
  joyful: "فرحان",
};

export const moodEmoji: Record<MoodState, string> = {
  stressed: "😣",
  low: "😔",
  neutral: "😌",
  joyful: "😊",
};

export const DEFAULT_MOOD_MAPPING: Record<MoodState, ContentTheme[]> = {
  stressed: ["spirituality", "quote"],
  low: ["spirituality", "productivity", "quote"],
  neutral: ["article", "productivity"],
  joyful: ["spirituality", "family", "quote"],
};

const WORDS: Record<MoodState, string[]> = {
  stressed: ["مضغوط", "ستريس", "قلق", "خايف", "توتر", "عصبي", "ضغط", "anxious", "stress"],
  low: ["حزين", "هابط", "تعبان", "وحيد", "ماشي بخير", "بلا طاقة", "sad", "tired"],
  neutral: ["هادي", "عادي", "مزيان", "بخير", "calm", "okay"],
  joyful: ["فرحان", "سعيد", "متحمس", "الحمد لله", "فرحة", "happy", "excited"],
};

export function detectMoodFromText(text: string): MoodState {
  const normalized = text.toLowerCase();
  let best: MoodState = "neutral";
  let bestScore = 0;
  for (const mood of MOOD_STATES) {
    const score = WORDS[mood].reduce((sum, word) => sum + (normalized.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      best = mood;
      bestScore = score;
    }
  }
  return best;
}

export function rankItemsForMood(items: ContentLibraryItem[], mood: MoodState, mapping = DEFAULT_MOOD_MAPPING) {
  const preferred = mapping[mood] || [];
  return [...items].sort((left, right) => {
    const leftScore = preferred.indexOf(left.theme);
    const rightScore = preferred.indexOf(right.theme);
    return (rightScore >= 0 ? preferred.length - rightScore : 0) - (leftScore >= 0 ? preferred.length - leftScore : 0);
  });
}
