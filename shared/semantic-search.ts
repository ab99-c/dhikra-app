const VECTOR_SIZE = 128;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % VECTOR_SIZE;
}

export function createLocalEmbedding(text: string): number[] {
  const vector = Array.from({ length: VECTOR_SIZE }, () => 0);
  const tokens = normalize(text).split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    vector[hashToken(token)] += 1;
    if (token.length > 3) vector[hashToken(token.slice(0, 3))] += 0.35;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map((value) => value / magnitude) : vector;
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
  return left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);
}

export function contentSearchText(input: {
  title?: string | null;
  rawText?: string | null;
  ocrText?: string | null;
  imageContextTags?: string[];
  theme?: string;
}) {
  return [input.title, input.rawText, input.ocrText, ...(input.imageContextTags || []), input.theme]
    .filter(Boolean)
    .join(" ");
}
