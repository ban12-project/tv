export const EMBEDDING_MODEL_ID = "@cf/qwen/qwen3-embedding-0.6b";
export const EMBEDDING_DIMENSIONS = 1024;

export const embeddingProviderOptions = {
  "workers-ai": {
    dimensions: EMBEDDING_DIMENSIONS,
  },
} as const;

export const generateChunks = (input: string): string[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // 1. Priority: Keep Integrity
  if (trimmed.length < 4000) {
    return [trimmed];
  }

  // 2. Fallback: Split by lines/paragraphs
  const chunks: string[] = [];
  const lines = trimmed.split(/\n+/);
  let currentChunk = "";

  for (const line of lines) {
    if (`${currentChunk}\n${line}`.length > 2000) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};
