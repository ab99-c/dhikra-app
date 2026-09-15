import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Daily adhkar progress: which adhkar were completed today and tasbih counts.
 * Progress is keyed by local calendar date and resets automatically each day.
 */

const STORAGE_KEY = "dhikra-adhkar-progress";

type DayProgress = {
  date: string;
  doneIds: number[];
  tasbihCounts: Record<string, number>;
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

let progressCache: DayProgress | null = null;

async function loadProgress(): Promise<DayProgress> {
  if (progressCache) return progressCache;
  const today = localDateKey(new Date());
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as DayProgress) : null;
    progressCache =
      parsed && parsed.date === today
        ? parsed
        : { date: today, doneIds: [], tasbihCounts: {} };
  } catch {
    progressCache = { date: today, doneIds: [], tasbihCounts: {} };
  }
  return progressCache;
}

async function saveProgress() {
  if (!progressCache) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progressCache));
}

export async function getCompletedAdhkarIds(): Promise<number[]> {
  const progress = await loadProgress();
  return [...progress.doneIds];
}

export async function toggleAdhkarDone(id: number): Promise<boolean> {
  const progress = await loadProgress();
  const done = progress.doneIds.includes(id);
  progress.doneIds = done
    ? progress.doneIds.filter((doneId) => doneId !== id)
    : [...progress.doneIds, id];
  await saveProgress();
  return !done;
}

export async function getTasbihCount(key: string): Promise<number> {
  const progress = await loadProgress();
  return progress.tasbihCounts[key] ?? 0;
}

export async function incrementTasbih(key: string): Promise<number> {
  const progress = await loadProgress();
  const next = (progress.tasbihCounts[key] ?? 0) + 1;
  progress.tasbihCounts[key] = next;
  await saveProgress();
  return next;
}

export async function resetTasbih(key: string): Promise<void> {
  const progress = await loadProgress();
  delete progress.tasbihCounts[key];
  await saveProgress();
}
