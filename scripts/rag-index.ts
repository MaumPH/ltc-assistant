import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  buildChunkRows,
  buildCompiledRows,
  buildDocumentRows,
  buildDocumentVersionRows,
  buildSectionRows,
  embedIndexRows,
  loadKnowledgeFilesForIndex,
  prepareEmbedding,
  upsertRowsToPostgres,
} from '../src/lib/nodeRagService';

dotenv.config();

const EMBEDDING_CACHE_PATH = path.join(process.cwd(), '.rag-cache', 'embeddings.json');

function restoreEmbeddingCache(rows: Array<Record<string, unknown>>): number {
  if (!fs.existsSync(EMBEDDING_CACHE_PATH)) return 0;

  try {
    const parsed = JSON.parse(fs.readFileSync(EMBEDDING_CACHE_PATH, 'utf8')) as Record<string, number[]>;
    let restored = 0;

    for (const row of rows) {
      const chunkHash = typeof row.chunk_hash === 'string' ? row.chunk_hash : null;
      if (!chunkHash) continue;
      if (Array.isArray(row.embedding) && (row.embedding as number[]).length > 0) continue;

      const cached = parsed[chunkHash];
      if (!Array.isArray(cached) || cached.length === 0) continue;

      const embedding = prepareEmbedding(cached.map((value) => Number(value)));
      if (embedding.length === 0) continue;
      row.embedding = embedding;
      restored += 1;
    }

    return restored;
  } catch (error) {
    console.warn(`Failed to restore embedding cache: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

function persistEmbeddingCache(rows: Array<Record<string, unknown>>): void {
  const payload = Object.fromEntries(
    rows
      .filter((row) => typeof row.chunk_hash === 'string' && Array.isArray(row.embedding) && (row.embedding as number[]).length > 0)
      .map((row) => [row.chunk_hash as string, prepareEmbedding(row.embedding as number[])] as const)
      .filter((entry) => entry[1].length > 0),
  );

  fs.mkdirSync(path.dirname(EMBEDDING_CACHE_PATH), { recursive: true });
  fs.writeFileSync(EMBEDDING_CACHE_PATH, JSON.stringify(payload), 'utf8');
}

async function main() {
  const projectRoot = process.cwd();
  const files = await loadKnowledgeFilesForIndex(projectRoot);
  const documentRows = buildDocumentRows(files);
  const documentVersionRows = buildDocumentVersionRows(files);
  const sectionRows = buildSectionRows(files);
  const chunkRows = buildChunkRows(files);
  const compiledRows = buildCompiledRows(files);
  const restoredEmbeddings = restoreEmbeddingCache(chunkRows);
  if (restoredEmbeddings > 0) {
    console.log(`Restored ${restoredEmbeddings} cached embeddings before indexing.`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    await embedIndexRows(ai, chunkRows);
    persistEmbeddingCache(chunkRows);
  }

  const cacheDir = path.join(projectRoot, '.rag-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, 'rag-index.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        documents: documentRows,
        documentVersions: documentVersionRows,
        sections: sectionRows,
        chunks: chunkRows,
        compiledPages: compiledRows,
      },
      null,
      2,
    ),
    'utf8',
  );

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    await upsertRowsToPostgres({
      connectionString: databaseUrl,
      documentRows,
      documentVersionRows,
      sectionRows,
      chunkRows,
      compiledRows,
    });
    console.log(`Indexed ${chunkRows.length} chunks into Postgres.`);
  } else {
    console.log(`Indexed ${chunkRows.length} chunks into local cache only.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
