/**
 * Image analysis (OCR + content understanding) for Dhikra's screenshot loop.
 *
 * Sends an image to the Forge vision endpoint via invokeLLM and returns a
 * structured payload: OCR text, a short title, the detected content type,
 * tags and a suggested review delay.
 */

import { invokeLLM } from "./llm";
import { CONTENT_THEMES, USER_DELAY_OPTIONS, type ContentTheme, type UserDelayPreference } from "@/shared/content-library";

export type ImageAnalysis = {
  title: string;
  summary: string;
  ocrText: string;
  contentType: "hadith" | "dhikr" | "video" | "post" | "article" | "other";
  theme: ContentTheme;
  tags: string[];
  suggestedDelay: UserDelayPreference;
  confidence: number;
};

const imageAnalysisSchema = {
  name: "dhikra_image_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      ocrText: { type: "string" },
      contentType: { type: "string", enum: ["hadith", "dhikr", "video", "post", "article", "other"] },
      theme: { type: "string", enum: [...CONTENT_THEMES] },
      tags: { type: "array", items: { type: "string" } },
      suggestedDelay: { type: "string", enum: [...USER_DELAY_OPTIONS] },
      confidence: { type: "number" },
    },
    required: ["title", "summary", "ocrText", "contentType", "theme", "tags", "suggestedDelay", "confidence"],
    additionalProperties: false,
  },
} as const;

function responseText(content: string | { type: string; text?: string }[]): string {
  return Array.isArray(content) ? content.map((part) => part.text || "").join("\n") : content;
}

/** Pure parser — exported for unit testing. */
export function parseImageAnalysis(raw: string): ImageAnalysis {
  const fallback: ImageAnalysis = {
    title: "",
    summary: "",
    ocrText: "",
    contentType: "other",
    theme: "other",
    tags: [],
    suggestedDelay: "decide_for_me",
    confidence: 0,
  };
  try {
    const parsed = JSON.parse(raw) as Partial<ImageAnalysis>;
    const validThemes = new Set<string>(CONTENT_THEMES);
    const validDelays = new Set<string>(USER_DELAY_OPTIONS);
    return {
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 120) : fallback.title,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 300) : fallback.summary,
      ocrText: typeof parsed.ocrText === "string" ? parsed.ocrText : fallback.ocrText,
      contentType: typeof parsed.contentType === "string" ? (parsed.contentType as ImageAnalysis["contentType"]) : fallback.contentType,
      theme: validThemes.has(parsed.theme || "") ? (parsed.theme as ContentTheme) : fallback.theme,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10) : fallback.tags,
      suggestedDelay: validDelays.has(parsed.suggestedDelay || "")
        ? (parsed.suggestedDelay as UserDelayPreference)
        : fallback.suggestedDelay,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0) || 0)),
    };
  } catch {
    return { ...fallback, ocrText: raw };
  }
}

export async function analyzeImageBase64(base64: string, mimeType = "image/jpeg"): Promise<ImageAnalysis> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "نتا محلل صور multimodal ديال تطبيق «ذِكْرى». ما تكتفيش بـOCR: فهم المعنى والسياق والنية المحتملة علاش المستخدم حفظ الصورة. خرج JSON فيه: title عنوان قصير بالدارجة، summary جملة وحدة كتشرح المعنى والفائدة للمستخدم، ocrText النص الكامل المكتوب فالصورة (النقل الحرفي قدر الإمكان)، contentType نوع المحتوى (hadith حديث / dhikr ذكر / video فيديو تعليمي / post منشور سوشيال ميديا / article مقال / other)، theme التصنيف من القائمة، tags كلمات مفتاحية (3-6) بالعربية، suggestedDelay أفضل وقت باش يرجع ليه المستخدم من القائمة، confidence الثقة 0-1.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "حلل هاد الصورة:" },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
    responseFormat: { type: "json_schema", json_schema: imageAnalysisSchema },
    maxTokens: 1200,
  });

  return parseImageAnalysis(responseText(result.choices[0]?.message?.content || "{}"));
}
