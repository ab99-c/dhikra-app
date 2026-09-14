import type { ContentLibraryItem } from "@/shared/content-library";

export const ASSISTANT_INTENTS = ["search_memory", "create_reminder", "general_chat", "unknown"] as const;
export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export type AssistantMemoryContext = Pick<
  ContentLibraryItem,
  "id" | "title" | "rawText" | "ocrText" | "theme" | "capturedAt" | "status" | "scheduledFor"
>;

export type AssistantResponse = {
  reply: string;
  intent: AssistantIntent;
  dateIso: string | null;
  dateText: string | null;
  reminderTitle: string | null;
  confidence: number;
  memoryIds: number[];
};
