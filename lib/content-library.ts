import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  ContentLibraryItem,
  ContentStatus,
  ContentTheme,
  NewContentLibraryItem,
} from "@/shared/content-library";

const WEB_STORAGE_KEY = "dhikra-content-library";
let itemsCache: ContentLibraryItem[] | null = null;

function createSeedItem(): ContentLibraryItem {
  const now = new Date().toISOString();
  return {
    id: 1,
    userId: "local-user",
    sourceType: "seed",
    sourceUri: null,
    title: "بداية ذِكرى",
    rawText: "هنا غادي تجمع الصور، الروابط، الاقتباسات والمواعيد اللي باغي ترجع ليهم فـ الوقت المناسب.",
    ocrText: null,
    imageContextTags: ["welcome", "memory"],
    theme: "productivity",
    capturedAt: now,
    status: "captured",
    userDelayPref: "decide_for_me",
    scheduledFor: null,
    revisitCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function loadItems() {
  if (itemsCache) return itemsCache;
  const saved = await AsyncStorage.getItem(WEB_STORAGE_KEY);
  itemsCache = saved ? (JSON.parse(saved) as ContentLibraryItem[]) : [createSeedItem()];
  await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(itemsCache));
  return itemsCache;
}

async function saveItems() {
  await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(itemsCache ?? []));
}

export async function initializeContentLibrary() {
  await loadItems();
}

export async function listContentLibrary(query = "") {
  const items = await loadItems();
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) =>
        [item.title, item.rawText, item.ocrText, item.theme]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
    : items;
  return [...filtered].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function insertContentLibraryItem(input: NewContentLibraryItem) {
  const items = await loadItems();
  const now = new Date().toISOString();
  const id = items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  itemsCache = [{ ...input, id, revisitCount: input.revisitCount ?? 0, createdAt: now, updatedAt: now }, ...items];
  await saveItems();
  return id;
}

export async function markContentRevisited(id: number) {
  const items = await loadItems();
  const now = new Date().toISOString();
  itemsCache = items.map((item) => item.id === id ? { ...item, status: "revisited", revisitCount: item.revisitCount + 1, updatedAt: now } : item);
  await saveItems();
}

export async function updateContentStatus(id: number, status: ContentStatus) {
  const items = await loadItems();
  itemsCache = items.map((item) => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item);
  await saveItems();
}

export async function countContentLibrary() {
  return (await loadItems()).length;
}
