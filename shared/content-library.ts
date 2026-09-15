export const CONTENT_THEMES = [
  "spirituality",
  "productivity",
  "article",
  "quote",
  "recipe",
  "appointment",
  "family",
  "other",
] as const;

export type ContentTheme = (typeof CONTENT_THEMES)[number];

export const CONTENT_STATUSES = ["captured", "queued", "revisited", "completed", "dismissed"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const USER_DELAY_OPTIONS = ["3_hours", "tomorrow", "3_days", "1_week", "decide_for_me"] as const;
export type UserDelayPreference = (typeof USER_DELAY_OPTIONS)[number];

export type ContentLibraryItem = {
  id: number;
  userId: string;
  sourceType: string;
  sourceUri: string | null;
  title: string | null;
  rawText: string | null;
  ocrText: string | null;
  imageContextTags: string[];
  /** Privacy-first local vector used for semantic search; never leaves the device. */
  embedding?: number[];
  theme: ContentTheme;
  capturedAt: string;
  status: ContentStatus;
  userDelayPref: UserDelayPreference;
  scheduledFor: string | null;
  /** Native notification id attached once a reminder is scheduled. */
  notificationId?: string | null;
  revisitCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NewContentLibraryItem = Omit<
  ContentLibraryItem,
  "id" | "createdAt" | "updatedAt" | "revisitCount"
> & { revisitCount?: number };

export const themeLabel: Record<ContentTheme, string> = {
  spirituality: "الروحانيات",
  productivity: "الإنتاجية",
  article: "مقال",
  quote: "اقتباس",
  recipe: "وصفة",
  appointment: "موعد",
  family: "العائلة",
  other: "أخرى",
};

export const delayLabel: Record<UserDelayPreference, string> = {
  "3_hours": "من بعد 3 سوايع",
  tomorrow: "غدا",
  "3_days": "من بعد 3 أيام",
  "1_week": "من بعد سيمانة",
  decide_for_me: "خلي التطبيق يقرر",
};
