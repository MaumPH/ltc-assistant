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
  upsertRowsToPostgres,
} from '../src/lib/nodeRagService';

dotenv.config();

async function main() {
  const projectRoot = process.cwd();
  const files = await loadKnowledgeFilesForIndex(projectRoot);
  const documentRows = buildDocumentRows(files);
  const documentVersionRows = buildDocumentVersionRows(files);
  const sectionRows = buildSectionRows(files);
  const chunkRows = buildChunkRows(files);
  const compiledRows = buildCompiledRows(files);

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    await embedIndexRows(ai, chunkRows);
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
