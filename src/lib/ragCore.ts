export type PromptMode = 'integrated' | 'evaluation';

export interface KnowledgeFile {
  path: string;
  name: string;
  size: number;
  content: string;
}

export interface Chunk {
  file: string;
  text: string;
}

export const toKnowledgeFiles = (modules: Record<string, unknown>): KnowledgeFile[] =>
  Object.entries(modules).map(([p, content]) => ({
    path: p,
    name: p.split('/').pop() || p,
    size: (content as string).length,
    content: content as string,
  }));

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

function buildChunks(files: KnowledgeFile[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const file of files) {
    const paragraphs = file.content.split(/\n\s*\n/);
    let buffer = '';
    for (const para of paragraphs) {
      const combined = buffer ? buffer + '\n\n' + para : para;
      if (buffer.length > 0 && combined.length > CHUNK_SIZE) {
        chunks.push({ file: file.name, text: buffer.trim() });
        buffer = buffer.slice(-CHUNK_OVERLAP) + '\n\n' + para;
      } else {
        buffer = combined;
      }
    }
    if (buffer.trim()) chunks.push({ file: file.name, text: buffer.trim() });
  }
  return chunks;
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s\u3000.,!?;:'"()\[\]{}<>\/\\|@#$%^&*+=~`\-_]+/)
    .map(t => t.replace(/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\w]/g, ''))
    .filter(t => t.length >= 2);
}

export function searchKnowledge(
  files: KnowledgeFile[],
  query: string,
  candidateK = 30,
): Chunk[] {
  const chunks = buildChunks(files);
  if (!chunks.length || !query.trim()) return [];

  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const dfMap = new Map<string, number>();
  for (const chunk of chunks) {
    const seen = new Set(tokenize(chunk.text));
    for (const token of seen) dfMap.set(token, (dfMap.get(token) ?? 0) + 1);
  }

  const scored = chunks.map(chunk => {
    const tokens = tokenize(chunk.text);
    const tfMap = new Map<string, number>();
    for (const token of tokens) tfMap.set(token, (tfMap.get(token) ?? 0) + 1);
    const total = tokens.length || 1;

    let score = 0;
    for (const qt of queryTokens) {
      const tf = (tfMap.get(qt) ?? 0) / total;
      const df = dfMap.get(qt) ?? 0;
      if (df > 0) score += tf * (Math.log((chunks.length + 1) / (df + 1)) + 1);
    }
    return { file: chunk.file, text: chunk.text, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, candidateK)
    .filter(c => c.score > 0)
    .map(({ file, text }) => ({ file, text }));
}

export function chunksToContext(chunks: Chunk[]): string {
  return chunks
    .map(c => `\n\n--- Document: ${c.file} ---\n${c.text}`)
    .join('');
}

export function getAllChunks(files: KnowledgeFile[]): Chunk[] {
  return buildChunks(files);
}

export function buildContext(files: KnowledgeFile[], maxChars = 160_000): string {
  let context = '';
  for (const file of files) {
    const chunk = `\n\n--- Document: ${file.name} ---\n${file.content}\n`;
    if (context.length + chunk.length > maxChars) break;
    context += chunk;
  }
  return context;
}
