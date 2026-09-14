import { invokeLLM } from "./_core/llm";
import type { AssistantMemoryContext, AssistantResponse } from "@/shared/assistant";

const assistantSchema = {
  name: "dhikra_assistant_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      intent: { type: "string", enum: ["search_memory", "create_reminder", "general_chat", "unknown"] },
      dateIso: { type: ["string", "null"] },
      dateText: { type: ["string", "null"] },
      reminderTitle: { type: ["string", "null"] },
      confidence: { type: "number" },
      memoryIds: { type: "array", items: { type: "integer" } },
    },
    required: ["reply", "intent", "dateIso", "dateText", "reminderTitle", "confidence", "memoryIds"],
    additionalProperties: false,
  },
} as const;

function responseText(content: string | Array<{ type: string; text?: string }>) {
  return Array.isArray(content) ? content.map((part) => part.text || "").join("\n") : content;
}

export async function answerWithDhikra(query: string, memories: AssistantMemoryContext[]): Promise<AssistantResponse> {
  const today = new Date().toISOString().slice(0, 10);
  const context = memories.slice(0, 12).map((memory) => ({
    id: memory.id,
    title: memory.title,
    text: memory.rawText || memory.ocrText,
    theme: memory.theme,
    capturedAt: memory.capturedAt,
    status: memory.status,
    scheduledFor: memory.scheduledFor,
  }));

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `نتا «ذِكْرى»، chatbot ديال الذاكرة بالدارجة المغربية. جاوب باختصار وبوضوح وبنفس لغة المستخدم. اليوم هو ${today}. استعمل غير الذكريات اللي فالسياق، وما تخترعش معلومات. إلا سول المستخدم على نهار/وقت، استخرج التاريخ فـ dateIso بصيغة ISO 8601 أو null إلا ما كانش واضح. إلا طلب تذكير، intent=create_reminder وخرج reminderTitle. إلا كان السؤال على ذكرى، رجّع memoryIds المطابقة. reply خاصها تكون دارجة مغربية مفهومة.`,
      },
      {
        role: "user",
        content: `السؤال ديال المستخدم:\n${query}\n\nسياق الذكريات المحلي المختار:\n${JSON.stringify(context)}`,
      },
    ],
    responseFormat: { type: "json_schema", json_schema: assistantSchema },
    maxTokens: 900,
  });

  const raw = responseText(result.choices[0]?.message?.content || "{}");
  try {
    const parsed = JSON.parse(raw) as AssistantResponse;
    return {
      reply: parsed.reply || "ما فهمتش مزيان، عاود صيغ السؤال بطريقة أخرى.",
      intent: parsed.intent || "unknown",
      dateIso: parsed.dateIso || null,
      dateText: parsed.dateText || null,
      reminderTitle: parsed.reminderTitle || null,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
      memoryIds: Array.isArray(parsed.memoryIds) ? parsed.memoryIds.map(Number).filter(Number.isFinite) : [],
    };
  } catch {
    return {
      reply: raw || "وقع مشكل صغير فالفهم، عاود المحاولة.",
      intent: "unknown",
      dateIso: null,
      dateText: null,
      reminderTitle: null,
      confidence: 0,
      memoryIds: [],
    };
  }
}
