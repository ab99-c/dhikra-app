import AsyncStorage from "@react-native-async-storage/async-storage";

import { matchesNormalized } from "@/shared/darija";
import { contentSearchText, cosineSimilarity, createLocalEmbedding } from "@/shared/semantic-search";
import type {
  ContentLibraryItem,
  ContentStatus,
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
  let changed = false;
  itemsCache = itemsCache.map((item) => {
    if (item.embedding?.length) return item;
    changed = true;
    return { ...item, embedding: createLocalEmbedding(contentSearchText(item)) };
  });
  if (changed) await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(itemsCache));
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
  const normalized = query.trim();
  if (!normalized) return [...items].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const queryVector = createLocalEmbedding(normalized);
  return items
    .map((item) => {
      const lexical = [item.title, item.rawText, item.ocrText, item.theme, ...item.imageContextTags]
        .filter(Boolean)
        .some((value) => matchesNormalized(String(value), normalized));
      const semantic = cosineSimilarity(item.embedding || createLocalEmbedding(contentSearchText(item)), queryVector);
      return { item, score: (lexical ? 1 : 0) + semantic };
    })
    .filter(({ score }) => score >= 0.12)
    .sort((a, b) => b.score - a.score || b.item.capturedAt.localeCompare(a.item.capturedAt))
    .map(({ item }) => item);
}

export async function insertContentLibraryItem(input: NewContentLibraryItem) {
  const items = await loadItems();
  const now = new Date().toISOString();
  const id = items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const item = {
    ...input,
    id,
    embedding: input.embedding || createLocalEmbedding(contentSearchText(input)),
    revisitCount: input.revisitCount ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  itemsCache = [item, ...items];
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

export async function attachNotificationToItem(id: number, notificationId: string) {
  const items = await loadItems();
  itemsCache = items.map((item) => item.id === id ? { ...item, notificationId, updatedAt: new Date().toISOString() } : item);
  await saveItems();
}

export async function updateContentSchedule(id: number, scheduledFor: string) {
  const items = await loadItems();
  itemsCache = items.map((item) => item.id === id ? { ...item, scheduledFor, updatedAt: new Date().toISOString() } : item);
  await saveItems();
}

export async function updateContentMetadata(id: number, metadata: { theme: ContentLibraryItem["theme"]; imageContextTags: string[] }) {
  const items = await loadItems();
  itemsCache = items.map((item) => item.id === id
    ? {
        ...item,
        ...metadata,
        embedding: createLocalEmbedding(contentSearchText({ ...item, ...metadata })),
        updatedAt: new Date().toISOString(),
      }
    : item);
  await saveItems();
}

export async function countContentLibrary() {
  return (await loadItems()).length;
}
