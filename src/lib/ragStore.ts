import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Pool, type PoolClient } from 'pg';
import {
  buildRagCorpusIndex,
  searchCorpus,
  type RagCorpusIndex,
  type SearchOptions,
} from './ragEngine';
import { buildKnowledgeManifest, compareIndexStatus } from './ragIndex';
import { extractLinkedDocumentTitles, inferSourceRole, sha1 } from './ragMetadata';
import { loadKnowledgeCorporaFromDisk } from './nodeKnowledge';
import { buildCompiledPages, buildStructuredChunks } from './ragStructured';
import {
  describeError,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_REFRESH_INTERVAL_MS,
  embedChunks,
  prepareEmbedding,
} from './embeddingService';
import { safeTrim } from './textGuards';
import type {
  CompiledPage,
  IndexManifestEntry,
  KnowledgeDoctorIssue,
  KnowledgeFile,
  KnowledgeListEntry,
  PromptMode,
  SearchRun,
  SearchCandidate,
  SourceRole,
  StructuredChunk,
} from './ragTypes';

export interface RagStore {
  initialize(ai: GoogleGenAI | null): Promise<void>;
  ensureEmbeddings(ai: GoogleGenAI): Promise<void>;
  search(
    query: string,
    mode: PromptMode,
    queryEmbedding: number[] | null,
    queryAliases?: string[],
    options?: SearchOptions,
  ): Promise<SearchRun>;
  getCompiledPages(mode: PromptMode, documentIds: string[]): CompiledPage[];
  listKnowledgeFiles(): KnowledgeListEntry[];
  getStats(): { chunks: number; compiledPages: number; storageMode: string };
  getChunks(): StructuredChunk[];
  getManifestEntries(): IndexManifestEntry[];
  getIndexGeneratedAt(): string | undefined;
}

export interface StoredChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  title: string;
  text: string;
  search_text: string;
  mode: PromptMode;
  source_type: StructuredChunk['sourceType'];
  source_role?: StructuredChunk['sourceRole'] | null;
  document_group: string;
  doc_title: string;
  file_name: string;
  path: string;
  effective_date?: string | null;
  published_date?: string | null;
  section_path: string[] | string;
  heading_path?: string[] | string | null;
  article_no?: string | null;
  matched_labels?: string[] | string | null;
  chunk_hash: string;
  parent_section_id?: string | null;
  parent_section_title?: string | null;
  list_group_id?: string | null;
  contains_checklist?: boolean | string | null;
  embedding_input?: string | null;
  window_index?: number | string | null;
  span_start?: number | string | null;
  span_end?: number | string | null;
  citation_group_id?: string | null;
  linked_document_titles?: string[] | string | null;
  embedding?: number[] | string | null;
}

export interface StoredDocumentRow {
  id: string;
  title: string;
  file_name: string;
  path: string;
  mode: PromptMode;
  source_role?: SourceRole | null;
  content_hash?: string | null;
  file_size?: number | string | null;
  source_mtime?: string | Date | null;
  chunk_count?: number | string | null;
  embedding_count?: number | string | null;
}

export interface StoredIndexMetadataRow {
  id: string;
  generated_at: string | Date;
  storage_mode: string;
  manifest_hash: string;
}

export interface StoredLawFallbackRow {
  id: string;
  cache_key: string;
  title: string;
  query: string;
  text: string;
  source: string;
  path: string;
  article_no?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

export interface DiskKnowledgeState {
  fingerprint: string;
  files: KnowledgeFile[];
  chunks: StructuredChunk[];
  manifestEntries: IndexManifestEntry[];
  issues: KnowledgeDoctorIssue[];
}

export function parseStringArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch (error) {
    console.debug('[ragStore] failed to parse string array JSON:', error);
    return value
      .split('>')
      .map((item) => safeTrim(item))
      .filter(Boolean);
  }
}

export function parseEmbedding(value: number[] | string | null | undefined): number[] | undefined {
  if (Array.isArray(value)) return value;
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)) : undefined;
  } catch (error) {
    console.debug('[ragStore] failed to parse embedding JSON:', error);
    return undefined;
  }
}

export function parseNumberValue(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function rowToChunk(row: StoredChunkRow): StructuredChunk {
  const sectionPath = parseStringArray(row.section_path);
  const parentSectionId = row.parent_section_id ?? sha1(`${row.document_id}:${sectionPath.join('>')}`);
  const parentSectionTitle = row.parent_section_title ?? row.title;
  const sourceRole =
    row.source_role ??
    inferSourceRole({
      path: row.path,
      fileName: row.file_name,
      mode: row.mode,
      sourceType: row.source_type,
    });
  const linkedDocumentTitles =
    parseStringArray(row.linked_document_titles).length > 0
      ? parseStringArray(row.linked_document_titles)
      : extractLinkedDocumentTitles(row.text);
  return {
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    title: row.title,
    text: row.text,
    textPreview: row.text.slice(0, 220),
    searchText: row.search_text,
    mode: row.mode,
    sourceType: row.source_type,
    sourceRole,
    documentGroup: row.document_group,
    docTitle: row.doc_title,
    fileName: row.file_name,
    path: row.path,
    effectiveDate: row.effective_date ?? undefined,
    publishedDate: row.published_date ?? undefined,
    sectionPath,
    headingPath: parseStringArray(row.heading_path).length > 0 ? parseStringArray(row.heading_path) : sectionPath,
    articleNo: row.article_no ?? undefined,
    matchedLabels: parseStringArray(row.matched_labels),
    chunkHash: row.chunk_hash,
    parentSectionId,
    parentSectionTitle,
    listGroupId: row.list_group_id ?? undefined,
    containsCheckList: row.contains_checklist === true || row.contains_checklist === 'true',
    embeddingInput: row.embedding_input ?? row.search_text,
    windowIndex: parseNumberValue(row.window_index),
    spanStart: parseNumberValue(row.span_start),
    spanEnd: parseNumberValue(row.span_end),
    citationGroupId: row.citation_group_id ?? sha1(`${row.document_id}:${parentSectionId}`),
    linkedDocumentTitles,
    embedding: parseEmbedding(row.embedding),
  };
}

export function rowToManifestEntry(row: StoredDocumentRow): IndexManifestEntry {
  return {
    documentId: row.id,
    path: row.path,
    name: row.file_name,
    mode: row.mode,
    contentHash: row.content_hash ?? sha1(`${row.path}:${row.title}`),
    size: parseNumberValue(row.file_size),
    updatedAt: row.source_mtime ? new Date(row.source_mtime).toISOString() : undefined,
    chunkCount: parseNumberValue(row.chunk_count),
    embeddingCount: parseNumberValue(row.embedding_count),
  };
}

export function updateManifestEntriesFromChunks(
  entries: IndexManifestEntry[],
  chunks: StructuredChunk[],
): IndexManifestEntry[] {
  const countsByDocument = new Map<string, { chunkCount: number; embeddingCount: number }>();
  for (const chunk of chunks) {
    const current = countsByDocument.get(chunk.documentId) ?? { chunkCount: 0, embeddingCount: 0 };
    current.chunkCount += 1;
    if (Array.isArray(chunk.embedding) && chunk.embedding.length > 0) {
      current.embeddingCount += 1;
    }
    countsByDocument.set(chunk.documentId, current);
  }

  return entries.map((entry) => {
    const counts = countsByDocument.get(entry.documentId);
    if (!counts) return entry;
    return {
      ...entry,
      chunkCount: counts.chunkCount,
      embeddingCount: counts.embeddingCount,
    };
  });
}

export function manifestEntriesToKnowledgeStats(entries: IndexManifestEntry[]): KnowledgeListEntry[] {
  return entries
    .map((entry) => ({
      path: entry.path,
      name: entry.path.replace(/^\/knowledge\//, ''),
      size: entry.size,
      updatedAt: entry.updatedAt,
      mode: entry.mode,
      chunkCount: entry.chunkCount,
      embeddingCount: entry.embeddingCount,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
}

const POSTGRES_VECTOR_TOP_K = 48;
const EMBEDDING_CACHE_FILE = 'embeddings.json';

function mergeCorpora(...corpora: KnowledgeFile[][]): KnowledgeFile[] {
  const filesByPath = new Map<string, KnowledgeFile>();
  for (const corpus of corpora) {
    for (const file of corpus) {
      filesByPath.set(file.path, file);
    }
  }
  return Array.from(filesByPath.values());
}

export function buildIndexMetadataRow(manifestEntries: IndexManifestEntry[], storageMode = 'postgres'): Record<string, unknown> {
  const modeCounts = manifestEntries.reduce<Record<PromptMode, number>>(
    (counts, entry) => ({
      ...counts,
      [entry.mode]: counts[entry.mode] + 1,
    }),
    { integrated: 0, evaluation: 0 },
  );

  return {
    id: 'current',
    generated_at: new Date().toISOString(),
    storage_mode: storageMode,
    manifest_hash: compareIndexStatus({
      diskEntries: manifestEntries,
      indexedEntries: manifestEntries,
      storageMode,
    }).manifestHash,
    document_count: manifestEntries.length,
    chunk_count: manifestEntries.reduce((sum, entry) => sum + entry.chunkCount, 0),
    embedding_count: manifestEntries.reduce((sum, entry) => sum + entry.embeddingCount, 0),
    mode_counts: modeCounts,
  };
}

const POSTGRES_SCHEMA_STATEMENTS = [
  'create extension if not exists vector',
  `
    create table if not exists documents (
      id text primary key,
      title text not null,
      file_name text not null,
      path text not null unique,
      mode text not null,
      source_role text not null default 'general',
      source_type text not null,
      document_group text not null,
      effective_date date,
      published_date date,
      content_hash text,
      file_size bigint,
      source_mtime timestamptz,
      chunk_count integer not null default 0,
      embedding_count integer not null default 0,
      created_at timestamptz not null default now()
    )
  `,
  'alter table documents add column if not exists content_hash text',
  'alter table documents add column if not exists file_size bigint',
  'alter table documents add column if not exists source_mtime timestamptz',
  'alter table documents add column if not exists chunk_count integer not null default 0',
  'alter table documents add column if not exists embedding_count integer not null default 0',
  'alter table documents add column if not exists source_role text not null default \'general\'',
  `
    create table if not exists document_versions (
      id text primary key,
      document_id text not null references documents(id) on delete cascade,
      version_hash text not null,
      raw_content text not null,
      created_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists sections (
      id text primary key,
      document_id text not null references documents(id) on delete cascade,
      title text not null,
      depth integer not null,
      section_path jsonb not null,
      article_no text,
      line_start integer,
      line_end integer,
      content text not null
    )
  `,
  `
    create table if not exists chunks (
      id text primary key,
      document_id text not null references documents(id) on delete cascade,
      chunk_index integer not null,
      title text not null,
      text text not null,
      search_text text not null,
      mode text not null,
      source_type text not null,
      source_role text not null default 'general',
      document_group text not null,
      doc_title text not null,
      file_name text not null,
      path text not null,
      effective_date date,
      published_date date,
      section_path jsonb not null,
      heading_path jsonb not null default '[]'::jsonb,
      article_no text,
      matched_labels jsonb not null default '[]'::jsonb,
      linked_document_titles jsonb not null default '[]'::jsonb,
      chunk_hash text not null,
      parent_section_id text not null,
      parent_section_title text not null,
      list_group_id text,
      contains_checklist boolean not null default false,
      embedding_input text,
      window_index integer not null default 0,
      span_start integer not null default 0,
      span_end integer not null default 0,
      citation_group_id text not null,
      embedding vector(768),
      created_at timestamptz not null default now()
    )
  `,
  'create index if not exists chunks_mode_idx on chunks(mode)',
  'create index if not exists chunks_doc_title_idx on chunks(doc_title)',
  'create index if not exists chunks_article_idx on chunks(article_no)',
  'alter table chunks add column if not exists parent_section_id text',
  'alter table chunks add column if not exists parent_section_title text',
  'alter table chunks add column if not exists window_index integer not null default 0',
  'alter table chunks add column if not exists span_start integer not null default 0',
  'alter table chunks add column if not exists span_end integer not null default 0',
  'alter table chunks add column if not exists citation_group_id text',
  'alter table chunks add column if not exists source_role text not null default \'general\'',
  'alter table chunks add column if not exists linked_document_titles jsonb not null default \'[]\'::jsonb',
  'alter table chunks add column if not exists heading_path jsonb not null default \'[]\'::jsonb',
  'alter table chunks add column if not exists list_group_id text',
  'alter table chunks add column if not exists contains_checklist boolean not null default false',
  'alter table chunks add column if not exists embedding_input text',
  'create index if not exists chunks_effective_date_idx on chunks(effective_date desc)',
  'create index if not exists chunks_embedding_ivfflat_idx on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100)',
  `
    create table if not exists compiled_pages (
      id text primary key,
      page_type text not null,
      title text not null,
      mode text not null,
      source_document_ids jsonb not null,
      backlinks jsonb not null,
      summary text not null,
      body text not null,
      tags jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists benchmark_cases (
      id text primary key,
      mode text not null,
      question text not null,
      expected_doc text not null,
      expected_section text,
      acceptable_abstain boolean not null default false,
      notes text,
      created_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists rag_index_metadata (
      id text primary key,
      generated_at timestamptz not null,
      storage_mode text not null,
      manifest_hash text not null,
      document_count integer not null,
      chunk_count integer not null,
      embedding_count integer not null,
      mode_counts jsonb not null default '{}'::jsonb
    )
  `,
  `
    create table if not exists ontology_entities (
      id text primary key,
      entity_type text not null,
      label text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists ontology_aliases (
      id text primary key,
      entity_id text not null references ontology_entities(id) on delete cascade,
      alias text not null,
      alias_type text not null,
      weight double precision not null default 1,
      created_at timestamptz not null default now()
    )
  `,
  'create index if not exists ontology_aliases_entity_id_idx on ontology_aliases(entity_id)',
  'create index if not exists ontology_aliases_alias_idx on ontology_aliases(alias)',
  `
    create table if not exists ontology_edges (
      id text primary key,
      from_entity_id text not null references ontology_entities(id) on delete cascade,
      to_entity_id text not null references ontology_entities(id) on delete cascade,
      relation text not null,
      weight double precision not null default 1,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `,
  'create index if not exists ontology_edges_from_idx on ontology_edges(from_entity_id)',
  'create index if not exists ontology_edges_to_idx on ontology_edges(to_entity_id)',
  `
    create table if not exists law_fallback_cache (
      id text primary key,
      cache_key text not null unique,
      title text not null,
      query text not null,
      text text not null,
      source text not null,
      path text not null,
      article_no text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  'create index if not exists law_fallback_cache_key_idx on law_fallback_cache(cache_key)',
];

export async function ensurePostgresSchema(client: PoolClient): Promise<void> {
  for (const statement of POSTGRES_SCHEMA_STATEMENTS) {
    await client.query(statement);
  }
}

export class MemoryRagStore implements RagStore {
  private readonly projectRoot: string;
  private readonly embeddingCachePath: string;
  private knowledgeStats: KnowledgeListEntry[] = [];
  private files: KnowledgeFile[] = [];
  private chunks: StructuredChunk[] = [];
  private index: RagCorpusIndex = buildRagCorpusIndex([]);
  private compiledPages: CompiledPage[] = [];
  private manifestEntries: IndexManifestEntry[] = [];
  private indexGeneratedAt: string | undefined;
  private lastEmbeddingAttemptAt = 0;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.embeddingCachePath = path.join(projectRoot, '.rag-cache', EMBEDDING_CACHE_FILE);
  }

  private restoreEmbeddingsFromCache(): number {
    if (!fs.existsSync(this.embeddingCachePath)) return 0;

    try {
      const parsed = JSON.parse(fs.readFileSync(this.embeddingCachePath, 'utf8')) as Record<string, number[]>;
      let restored = 0;

      for (const chunk of this.chunks) {
        const cached = parsed[chunk.chunkHash];
        if (!Array.isArray(cached) || cached.length === 0) continue;
        const embedding = prepareEmbedding(cached.map((value) => Number(value)));
        if (embedding.length === 0) continue;
        chunk.embedding = embedding;
        restored += 1;
      }

      return restored;
    } catch (error) {
      console.warn(`[embedding] failed to restore cache: ${describeError(error)}`);
      return 0;
    }
  }

  private persistEmbeddingCache(): void {
    const cachedEntries = this.chunks
      .filter((chunk) => chunk.embedding && chunk.embedding.length > 0)
      .map((chunk) => [chunk.chunkHash, prepareEmbedding(chunk.embedding)] as const)
      .filter((entry) => entry[1].length === EMBEDDING_DIMENSIONS);

    try {
      fs.mkdirSync(path.dirname(this.embeddingCachePath), { recursive: true });
      fs.writeFileSync(this.embeddingCachePath, JSON.stringify(Object.fromEntries(cachedEntries)));
    } catch (error) {
      console.warn(`[embedding] failed to persist cache: ${describeError(error)}`);
    }
  }

  async initialize(): Promise<void> {
    const corpora = loadKnowledgeCorporaFromDisk(this.projectRoot);
    this.files = mergeCorpora(corpora.integrated, corpora.evaluation);
    this.chunks = buildStructuredChunks(this.files);
    const restored = this.restoreEmbeddingsFromCache();
    if (restored > 0) {
      console.info(`[embedding] restored ${restored} cached chunk embeddings from disk.`);
    }
    this.index = buildRagCorpusIndex(this.chunks);
    this.compiledPages = buildCompiledPages(this.chunks);
    this.manifestEntries = buildKnowledgeManifest(this.files, this.chunks);
    this.knowledgeStats = manifestEntriesToKnowledgeStats(this.manifestEntries);
    this.indexGeneratedAt = new Date().toISOString();
  }

  async ensureEmbeddings(ai: GoogleGenAI): Promise<void> {
    if (Date.now() - this.lastEmbeddingAttemptAt < EMBEDDING_REFRESH_INTERVAL_MS) return;
    this.lastEmbeddingAttemptAt = Date.now();

    const embeddedCount = await embedChunks(ai, this.chunks);
    if (embeddedCount > 0) {
      this.persistEmbeddingCache();
      console.info(`[embedding] cached ${embeddedCount} additional chunk embeddings to disk.`);
    }
    this.index = buildRagCorpusIndex(this.chunks);
    this.manifestEntries = buildKnowledgeManifest(this.files, this.chunks);
    this.indexGeneratedAt = new Date().toISOString();
  }

  async search(
    query: string,
    mode: PromptMode,
    queryEmbedding: number[] | null,
    queryAliases: string[] = [],
    options?: SearchOptions,
  ): Promise<SearchRun> {
    return searchCorpus({ index: this.index, query, mode, queryEmbedding, queryAliases, options });
  }

  getCompiledPages(mode: PromptMode, documentIds: string[]): CompiledPage[] {
    const documentIdSet = new Set(documentIds);
    return this.compiledPages.filter((page) => page.mode === mode && page.sourceDocumentIds.some((id) => documentIdSet.has(id))).slice(0, 4);
  }

  listKnowledgeFiles() {
    return this.knowledgeStats;
  }

  getStats() {
    return {
      chunks: this.chunks.length,
      compiledPages: this.compiledPages.length,
      storageMode: 'memory',
    };
  }

  getChunks() {
    return this.chunks;
  }

  getManifestEntries() {
    return this.manifestEntries;
  }

  getIndexGeneratedAt() {
    return this.indexGeneratedAt;
  }
}

export class PostgresRagStore implements RagStore {
  private readonly pool: Pool;
  private chunks: StructuredChunk[] = [];
  private index: RagCorpusIndex = buildRagCorpusIndex([]);
  private compiledPages: CompiledPage[] = [];
  private manifestEntries: IndexManifestEntry[] = [];
  private knowledgeStats: KnowledgeListEntry[] = [];
  private indexGeneratedAt: string | undefined;
  private lastEmbeddingAttemptAt = 0;
  private chunkById = new Map<string, StructuredChunk>();

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  private async queryPgvectorCandidates(
    queryEmbedding: number[] | null,
    mode: PromptMode,
    options?: SearchOptions,
  ): Promise<SearchCandidate[] | null> {
    if (!queryEmbedding || queryEmbedding.length !== EMBEDDING_DIMENSIONS) return null;
    if (options?.allowedDocumentIds && options.allowedDocumentIds.size === 0) return [];

    const conditions = ['embedding is not null'];
    const values: unknown[] = [`[${queryEmbedding.join(',')}]`];

    if (mode === 'evaluation') {
      values.push(mode);
      conditions.push(`mode = $${values.length}`);
    }

    if (options?.allowedDocumentIds && options.allowedDocumentIds.size > 0) {
      values.push(Array.from(options.allowedDocumentIds));
      conditions.push(`document_id = any($${values.length}::text[])`);
    }

    if (options?.excludedEvidenceRoles && options.excludedEvidenceRoles.size > 0) {
      values.push(Array.from(options.excludedEvidenceRoles));
      conditions.push(`(source_role is null or not (source_role = any($${values.length}::text[])))`);
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query<{ id: string; similarity: number | string }>(
        `
          select
            id,
            1 - (embedding <=> $1::vector) as similarity
          from chunks
          where ${conditions.join(' and ')}
          order by embedding <=> $1::vector
          limit ${POSTGRES_VECTOR_TOP_K}
        `,
        values,
      );

      return result.rows
        .map((row) => {
          const chunk = this.chunkById.get(row.id);
          if (!chunk) return null;
          return {
            ...chunk,
            exactScore: 0,
            lexicalScore: 0,
            vectorScore: Math.max(0, Number(row.similarity) || 0),
            fusedScore: 0,
            rerankScore: 0,
            headingScore: 0,
            ontologyScore: 0,
            matchedTerms: [],
          } satisfies SearchCandidate;
        })
        .filter((candidate): candidate is SearchCandidate => candidate !== null);
    } catch (error) {
      console.warn(`[pgvector] similarity query failed: ${describeError(error)}`);
      return null;
    } finally {
      client.release();
    }
  }

  private async persistEmbeddingUpdates(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      for (let index = 0; index < this.chunks.length; index += 50) {
        const batch = this.chunks.slice(index, index + 50);
        const values: unknown[] = [];
        const tuples = batch.map((chunk) => {
          values.push(
            chunk.id,
            Array.isArray(chunk.embedding) && chunk.embedding.length === EMBEDDING_DIMENSIONS
              ? `[${chunk.embedding.join(',')}]`
              : null,
          );
          return `($${values.length - 1}, $${values.length})`;
        });
        if (tuples.length === 0) continue;
        await client.query(
          `
            update chunks as target
            set embedding = case when source.embedding is null then null else source.embedding::vector end
            from (values ${tuples.join(',')}) as source(id, embedding)
            where target.id = source.id
          `,
          values,
        );
      }

      for (let index = 0; index < this.manifestEntries.length; index += 100) {
        const batch = this.manifestEntries.slice(index, index + 100);
        const values: unknown[] = [];
        const tuples = batch.map((entry) => {
          values.push(entry.documentId, entry.chunkCount, entry.embeddingCount);
          return `($${values.length - 2}, $${values.length - 1}, $${values.length})`;
        });
        if (tuples.length === 0) continue;
        await client.query(
          `
            update documents as target
            set chunk_count = source.chunk_count,
                embedding_count = source.embedding_count
            from (values ${tuples.join(',')}) as source(id, chunk_count, embedding_count)
            where target.id = source.id
          `,
          values,
        );
      }

      const metadataRow = buildIndexMetadataRow(this.manifestEntries, 'postgres');
      await client.query(
        `
        insert into rag_index_metadata (
          id,
          generated_at,
          storage_mode,
          manifest_hash,
          document_count,
          chunk_count,
          embedding_count,
          mode_counts
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (id) do update set
          generated_at = excluded.generated_at,
          storage_mode = excluded.storage_mode,
          manifest_hash = excluded.manifest_hash,
          document_count = excluded.document_count,
          chunk_count = excluded.chunk_count,
          embedding_count = excluded.embedding_count,
          mode_counts = excluded.mode_counts
        `,
        [
          metadataRow.id,
          metadataRow.generated_at,
          metadataRow.storage_mode,
          metadataRow.manifest_hash,
          metadataRow.document_count,
          metadataRow.chunk_count,
          metadataRow.embedding_count,
          JSON.stringify(metadataRow.mode_counts),
        ],
      );

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await ensurePostgresSchema(client);

      const chunkResult = await client.query<StoredChunkRow>(`
      select
        id,
        document_id,
        chunk_index,
        title,
        text,
        search_text,
        mode,
        source_type,
        source_role,
        document_group,
        doc_title,
        file_name,
        path,
        effective_date,
        published_date,
        section_path,
        heading_path,
        article_no,
        matched_labels,
        linked_document_titles,
        chunk_hash,
        parent_section_id,
        parent_section_title,
        list_group_id,
        contains_checklist,
        embedding_input,
        window_index,
        span_start,
        span_end,
        citation_group_id,
        embedding
      from chunks
      order by doc_title asc, parent_section_id asc, window_index asc, chunk_index asc
    `);

      if (chunkResult.rows.length === 0) {
        throw new Error('Postgres RAG storage is empty.');
      }

      this.chunks = chunkResult.rows.map(rowToChunk);
      this.chunkById = new Map(this.chunks.map((chunk) => [chunk.id, chunk] as const));
      this.index = buildRagCorpusIndex(this.chunks);

      const compiledResult = await client.query<{
        id: string;
        page_type: CompiledPage['pageType'];
        title: string;
        mode: PromptMode;
        source_document_ids: string[] | string;
        backlinks: string[] | string;
        summary: string;
        body: string;
        tags: string[] | string;
      }>(`
      select
        id,
        page_type,
        title,
        mode,
        source_document_ids,
        backlinks,
        summary,
        body,
        tags
      from compiled_pages
    `);

      this.compiledPages = compiledResult.rows.map((row) => ({
        id: row.id,
        pageType: row.page_type,
        title: row.title,
        mode: row.mode,
        sourceDocumentIds: parseStringArray(row.source_document_ids),
        backlinks: parseStringArray(row.backlinks),
        summary: row.summary,
        body: row.body,
        tags: parseStringArray(row.tags),
      }));

      const documentResult = await client.query<StoredDocumentRow>(`
        select
          id,
          title,
          file_name,
          path,
          mode,
          source_role,
          content_hash,
          file_size,
          source_mtime,
          chunk_count,
          embedding_count
        from documents
        order by path asc
      `);
      this.manifestEntries = documentResult.rows.map(rowToManifestEntry);
      this.knowledgeStats = manifestEntriesToKnowledgeStats(this.manifestEntries);

      const metadataResult = await client.query<StoredIndexMetadataRow>(`
        select
          id,
          generated_at,
          storage_mode,
          manifest_hash
        from rag_index_metadata
        where id = 'current'
      `);
      this.indexGeneratedAt =
        metadataResult.rows.length > 0 ? new Date(metadataResult.rows[0].generated_at).toISOString() : undefined;
    } finally {
      client.release();
    }
  }

  async ensureEmbeddings(ai: GoogleGenAI): Promise<void> {
    if (Date.now() - this.lastEmbeddingAttemptAt < EMBEDDING_REFRESH_INTERVAL_MS) return;
    this.lastEmbeddingAttemptAt = Date.now();

    const missing = this.chunks.filter((chunk) => !chunk.embedding || chunk.embedding.length === 0);
    if (missing.length === 0) return;
    const before = missing.length;
    await embedChunks(ai, missing);
    const after = this.chunks.filter((chunk) => !chunk.embedding || chunk.embedding.length === 0).length;
    this.index = buildRagCorpusIndex(this.chunks);
    this.manifestEntries = updateManifestEntriesFromChunks(this.manifestEntries, this.chunks);
    this.knowledgeStats = manifestEntriesToKnowledgeStats(this.manifestEntries);
    this.indexGeneratedAt = new Date().toISOString();
    if (after < before) {
      await this.persistEmbeddingUpdates();
    }
  }

  async search(
    query: string,
    mode: PromptMode,
    queryEmbedding: number[] | null,
    queryAliases: string[] = [],
    options?: SearchOptions,
  ): Promise<SearchRun> {
    const precomputedVectorCandidates = await this.queryPgvectorCandidates(queryEmbedding, mode, options);
    return searchCorpus({
      index: this.index,
      query,
      mode,
      queryEmbedding,
      queryAliases,
      options: precomputedVectorCandidates
        ? {
            ...options,
            precomputedVectorCandidates,
          }
        : options,
    });
  }

  getCompiledPages(mode: PromptMode, documentIds: string[]): CompiledPage[] {
    const documentIdSet = new Set(documentIds);
    return this.compiledPages.filter((page) => page.mode === mode && page.sourceDocumentIds.some((id) => documentIdSet.has(id))).slice(0, 4);
  }

  listKnowledgeFiles() {
    return this.knowledgeStats;
  }

  getStats() {
    return {
      chunks: this.chunks.length,
      compiledPages: this.compiledPages.length,
      storageMode: 'postgres',
    };
  }

  getChunks() {
    return this.chunks;
  }

  getManifestEntries() {
    return this.manifestEntries;
  }

  getIndexGeneratedAt() {
    return this.indexGeneratedAt;
  }
}
