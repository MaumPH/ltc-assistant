export type PromptMode = 'integrated' | 'evaluation';

export interface KnowledgeFile {
  path: string;
  name: string;
  size: number;
  content: string;
}

interface Chunk {
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

function buildChunks(files: KnowledgeFile[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const file of files) {
    const paragraphs = file.content.split(/\n\s*\n/);
    let currentChunk = '';
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > 1500) {
        if (currentChunk.trim()) chunks.push({ file: file.name, text: currentChunk.trim() });
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    if (currentChunk.trim()) chunks.push({ file: file.name, text: currentChunk.trim() });
  }
  return chunks;
}

export function searchKnowledge(files: KnowledgeFile[], query: string, topK = 40): string {
  const chunks = buildChunks(files);
  const ngrams = new Set<string>();
  for (let i = 0; i < query.length - 1; i++) {
    const gram = query.substring(i, i + 2).trim();
    if (gram.length === 2) ngrams.add(gram);
  }
  if (ngrams.size === 0) return '';

  const scored = chunks.map(chunk => {
    let score = 0;
    for (const gram of ngrams) {
      if (chunk.text.includes(gram)) score++;
    }
    return { ...chunk, score };
  });
  scored.sort((a, b) => b.score - a.score);

  return scored
    .slice(0, topK)
    .filter(chunk => chunk.score > 0)
    .map(chunk => `\n\n--- Document: ${chunk.file} ---\n${chunk.text}`)
    .join('');
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
