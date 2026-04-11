import { buildRagCorpusIndex, searchCorpus } from './ragEngine';
import { buildStructuredChunks } from './ragStructured';
import type { KnowledgeFile, PromptMode, StructuredChunk } from './ragTypes';

export type { KnowledgeFile, PromptMode } from './ragTypes';

export interface Chunk {
  file: string;
  text: string;
  id?: string;
  articleNo?: string;
  sectionPath?: string[];
}

export const toKnowledgeFiles = (modules: Record<string, unknown>): KnowledgeFile[] =>
  Object.entries(modules).map(([filePath, content]) => ({
    path: filePath,
    name: filePath.split('/').pop() || filePath,
    size: String(content).length,
    content: String(content),
  }));

function toLegacyChunk(chunk: StructuredChunk): Chunk {
  return {
    file: chunk.docTitle,
    text: chunk.text,
    id: chunk.id,
    articleNo: chunk.articleNo,
    sectionPath: chunk.sectionPath,
  };
}

export function getAllChunks(files: KnowledgeFile[]): Chunk[] {
  return buildStructuredChunks(files).map(toLegacyChunk);
}

export function searchKnowledge(files: KnowledgeFile[], query: string, candidateK = 30): Chunk[] {
  const structuredChunks = buildStructuredChunks(files);
  const index = buildRagCorpusIndex(structuredChunks);
  const inferredMode: PromptMode =
    files.length > 0 && files.every((file) => /\/knowledge\/(?:eval|evaluation)\//.test(file.path))
      ? 'evaluation'
      : 'integrated';
  const run = searchCorpus({
    index,
    query,
    mode: inferredMode,
    queryEmbedding: null,
  });

  return run.fusedCandidates.slice(0, candidateK).map(toLegacyChunk);
}

export function chunksToContext(chunks: Chunk[]): string {
  return chunks
    .map((chunk) => {
      const metadata = [
        `Document: ${chunk.file}`,
        chunk.articleNo ? `Article: ${chunk.articleNo}` : null,
        chunk.sectionPath && chunk.sectionPath.length > 0 ? `Path: ${chunk.sectionPath.join(' > ')}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      return `\n\n--- ${metadata} ---\n${chunk.text}`;
    })
    .join('');
}

export function buildContext(files: KnowledgeFile[], maxChars = 160_000): string {
  let context = '';
  const chunks = getAllChunks(files);
  for (const chunk of chunks) {
    const block = `\n\n--- Document: ${chunk.file} ---\n${chunk.text}\n`;
    if (context.length + block.length > maxChars) break;
    context += block;
  }
  return context;
}
