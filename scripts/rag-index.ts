import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { loadDomainBrain } from '../src/lib/brain';
import { buildKnowledgeDoctorIssues } from '../src/lib/ragIndex';
import {
  buildOntologyGraph,
  buildOntologyRows,
  loadCuratedOntologyManifest,
  loadGeneratedOntologyManifest,
} from '../src/lib/ragOntology';
import { buildStructuredChunks } from '../src/lib/ragStructured';
import {
  buildChunkRows,
  buildCompiledRows,
  buildDocumentRows,
  buildDocumentVersionRows,
  buildIndexManifestEntriesFromRows,
  buildIndexMetadataRow,
  buildSectionRows,
  embedIndexRows,
  loadKnowledgeFilesForIndex,
  prepareEmbedding,
  upsertRowsToPostgres,
} from '../src/lib/nodeRagService';
import { resolveEmbeddingApiKey } from '../src/lib/ragRuntime';

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
  const databaseUrl = process.env.DATABASE_URL;
  const files = await loadKnowledgeFilesForIndex(projectRoot);
  const structuredChunks = buildStructuredChunks(files);
  const brain = loadDomainBrain(projectRoot);
  const ontologyGraph = buildOntologyGraph(
    brain,
    structuredChunks,
    loadGeneratedOntologyManifest(projectRoot),
    loadCuratedOntologyManifest(projectRoot),
  );
  const ontologyRows = buildOntologyRows(ontologyGraph);
  const documentVersionRows = buildDocumentVersionRows(files);
  const sectionRows = buildSectionRows(files);
  const chunkRows = buildChunkRows(files);
  const restoredEmbeddings = restoreEmbeddingCache(chunkRows);
  if (restoredEmbeddings > 0) {
    console.log(`Restored ${restoredEmbeddings} cached embeddings before indexing.`);
  }

  const apiKey = resolveEmbeddingApiKey();
  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    await embedIndexRows(ai, chunkRows);
    persistEmbeddingCache(chunkRows);
  }

  const manifestEntries = buildIndexManifestEntriesFromRows(files, chunkRows);
  const documentRows = buildDocumentRows(files, manifestEntries);
  const compiledRows = buildCompiledRows(files);
  const indexMetadataRow = buildIndexMetadataRow(manifestEntries, databaseUrl ? 'postgres' : 'local-cache');
  const doctorIssues = buildKnowledgeDoctorIssues(files, structuredChunks);

  const cacheDir = path.join(projectRoot, '.rag-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, 'rag-index.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        manifestEntries,
        indexMetadata: indexMetadataRow,
        doctorIssues,
        documents: documentRows,
        documentVersions: documentVersionRows,
        sections: sectionRows,
        chunks: chunkRows,
        compiledPages: compiledRows,
        ontology: ontologyRows,
      },
      null,
      2,
    ),
    'utf8',
  );

  fs.writeFileSync(path.join(cacheDir, 'knowledge-manifest.json'), JSON.stringify(manifestEntries, null, 2), 'utf8');
  fs.writeFileSync(path.join(cacheDir, 'rag-doctor.json'), JSON.stringify({ generatedAt: new Date().toISOString(), issues: doctorIssues }, null, 2), 'utf8');

  if (databaseUrl) {
    await upsertRowsToPostgres({
      connectionString: databaseUrl,
      documentRows,
      documentVersionRows,
      sectionRows,
      chunkRows,
      compiledRows,
      ontologyEntityRows: ontologyRows.entityRows,
      ontologyAliasRows: ontologyRows.aliasRows,
      ontologyEdgeRows: ontologyRows.edgeRows,
      indexMetadataRow,
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
