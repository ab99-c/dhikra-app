import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_MOOD_MAPPING, type MoodState } from "@/shared/mood";
import type { ContentTheme } from "@/shared/content-library";

const STORAGE_KEY = "dhikra-mood-settings";
export type MoodSettings = {
  mood: MoodState | null;
  updatedAt: string | null;
  cameraEmotionEnabled: boolean;
  mapping: Record<MoodState, ContentTheme[]>;
};

const defaults: MoodSettings = {
  mood: null,
  updatedAt: null,
  cameraEmotionEnabled: false,
  mapping: DEFAULT_MOOD_MAPPING,
};

export async function loadMoodSettings(): Promise<MoodSettings> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (!saved) return defaults;
  const parsed = JSON.parse(saved) as Partial<MoodSettings>;
  return { ...defaults, ...parsed, mapping: { ...DEFAULT_MOOD_MAPPING, ...(parsed.mapping || {}) } };
}

async function saveMoodSettings(settings: MoodSettings) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function setMood(mood: MoodState) {
  const settings = await loadMoodSettings();
  const next = { ...settings, mood, updatedAt: new Date().toISOString() };
  await saveMoodSettings(next);
  return next;
}

export async function setCameraEmotionEnabled(enabled: boolean) {
  const settings = await loadMoodSettings();
  const next = { ...settings, cameraEmotionEnabled: enabled };
  await saveMoodSettings(next);
  return next;
}

export async function setMoodMapping(mood: MoodState, themes: ContentTheme[]) {
  const settings = await loadMoodSettings();
  const next = { ...settings, mapping: { ...settings.mapping, [mood]: themes } };
  await saveMoodSettings(next);
  return next;
}
