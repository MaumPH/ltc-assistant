import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Pool, type PoolClient } from 'pg';
import type { DomainBrain } from './brain';
import { loadKnowledgeCorporaFromDisk } from './nodeKnowledge';
import { buildKnowledgeManifest } from './ragIndex';
import { buildPreciseCitationLabel, sha1, toDocumentMetadata } from './ragMetadata';
import {
  buildOntologyGraph,
  buildOntologyRows,
  loadCuratedOntologyManifest,
  loadGeneratedOntologyManifest,
  type GeneratedOntologyConcept,
  writeCuratedOntologyManifest,
  writeGeneratedOntologyManifest,
} from './ragOntology';
import {
  describeError,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MAX_CHUNKS_PER_PASS,
  EMBEDDING_MODEL,
  isQuotaExceededError,
  markEmbeddingQuotaExceeded,
  prepareEmbedding,
  shouldSkipEmbeddingWork,
} from './embeddingService';
import { buildIndexMetadataRow, ensurePostgresSchema, type RagStore, PostgresRagStore } from './ragStore';
import { buildCompiledPages, buildStructuredChunks, buildStructuredSections } from './ragStructured';
import { getRetrievalFeatureFlags, getRetrievalProfile } from './ragProfiles';
import type {
  AdminProfilesResponse,
  BenchmarkCase,
  EvalTrialReport,
  IndexManifestEntry,
  KnowledgeFile,
  RetrievalFeatureFlags,
  RetrievalProfile,
  StructuredChunk,
} from './ragTypes';
import type { AdminOntologyReviewResponse } from './nodeRagService';

function stripNullCharacters(value: string): string {
  return value.replace(/\u0000/g, '');
}

type OntologyReviewStatus = 'candidate' | 'validated' | 'promoted' | 'rejected';

function getOntologyReviewRecommendation(concept: GeneratedOntologyConcept): {
  recommendedStatus: OntologyReviewStatus;
  recommendationReason: string;
} {
  const label = concept.label.trim();
  const relationCount = concept.relations?.length ?? 0;
  const aliasCount = concept.aliases?.length ?? 0;
  const slotHintCount = concept.slot_hints?.length ?? 0;
  const confidence = concept.confidence ?? 0;
  const wordCount = label.split(/\s+/u).filter(Boolean).length;
  const hasSentenceSignal =
    label.length > 34 ||
    wordCount >= 5 ||
    /[.!?,:;'"“”‘’|<>]/u.test(label) ||
    /(?:입니다|한다|된다|있다|없다|하며|하고|대한|위한|경우|예시|적용)/u.test(label) ||
    /^(?:[0-9]+[.)]|[가-하]\.|제\d+조|[■▣○ㅇ•*-])/u.test(label);

  if (hasSentenceSignal && relationCount === 0 && aliasCount === 0 && slotHintCount === 0) {
    return {
      recommendedStatus: 'rejected',
      recommendationReason: '문장 조각이나 예시 문구처럼 보여 검색 개념으로 쓰기 어렵습니다.',
    };
  }

  if (label.length <= 18 && confidence >= 0.72 && (relationCount > 0 || aliasCount > 0 || slotHintCount > 0)) {
    return {
      recommendedStatus: 'promoted',
      recommendationReason: '짧고 연결 정보가 있는 핵심 용어 후보입니다.',
    };
  }

  if (label.length <= 24 && confidence >= 0.7 && !hasSentenceSignal) {
    return {
      recommendedStatus: 'validated',
      recommendationReason: '짧은 용어 후보라 검증 상태로 두기 적합합니다.',
    };
  }

  return {
    recommendedStatus: 'candidate',
    recommendationReason: '자동 판정만으로는 확정하기 어려워 보류가 안전합니다.',
  };
}

function sanitizePostgresValue<T>(value: T): T {
  if (typeof value === 'string') {
    return stripNullCharacters(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePostgresValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, sanitizePostgresValue(entryValue)]),
    ) as T;
  }

  return value;
}

function diffManifestEntries(previousEntries: IndexManifestEntry[], nextEntries: IndexManifestEntry[]) {
  const previousByDocumentId = new Map(previousEntries.map((entry) => [entry.documentId, entry] as const));
  const nextByDocumentId = new Map(nextEntries.map((entry) => [entry.documentId, entry] as const));

  const changedDocumentIds = nextEntries
    .filter((entry) => {
      const previous = previousByDocumentId.get(entry.documentId);
      return !previous || previous.contentHash !== entry.contentHash;
    })
    .map((entry) => entry.documentId);

  const removedDocumentIds = previousEntries
    .filter((entry) => !nextByDocumentId.has(entry.documentId))
    .map((entry) => entry.documentId);

  return {
    changedDocumentIds,
    removedDocumentIds,
  };
}

function copyExistingEmbeddingsToChunkRows(
  chunkRows: Array<Record<string, unknown>>,
  existingChunks: StructuredChunk[],
): Array<Record<string, unknown>> {
  const chunksByHash = new Map(
    existingChunks
      .filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length === EMBEDDING_DIMENSIONS)
      .map((chunk) => [chunk.chunkHash, chunk.embedding] as const),
  );

  return chunkRows.map((row) => {
    if (Array.isArray(row.embedding) && (row.embedding as number[]).length === EMBEDDING_DIMENSIONS) {
      return row;
    }

    const cachedEmbedding = chunksByHash.get(String(row.chunk_hash));
    return cachedEmbedding ? { ...row, embedding: cachedEmbedding } : row;
  });
}

function filterRowsByDocumentIds(
  rows: Array<Record<string, unknown>>,
  documentIds: Set<string>,
  key: string,
): Array<Record<string, unknown>> {
  if (documentIds.size === 0) return [];
  return rows.filter((row) => documentIds.has(String(row[key])));
}

function mergeCorpora(...corpora: KnowledgeFile[][]): KnowledgeFile[] {
  const filesByPath = new Map<string, KnowledgeFile>();
  for (const file of corpora.flat()) {
    filesByPath.set(file.path, file);
  }
  return Array.from(filesByPath.values()).sort((left, right) => left.path.localeCompare(right.path, 'ko'));
}

export function buildAdminProfilesResponse(params: {
  activeProfileId: string;
  profiles: RetrievalProfile[];
  featureFlags: RetrievalFeatureFlags;
  updatedAt: string;
}): AdminProfilesResponse {
  return {
    activeProfileId: params.activeProfileId,
    profiles: params.profiles,
    featureFlags: params.featureFlags,
    updatedAt: params.updatedAt,
  };
}

export function updateAdminProfileState(params: {
  currentActiveProfileId: string;
  currentOverrides: Partial<RetrievalFeatureFlags>;
  activeProfileId?: string;
  overrides?: Partial<RetrievalFeatureFlags>;
}): { activeProfileId: string; overrides: Partial<RetrievalFeatureFlags>; updatedAt: string } {
  return {
    activeProfileId: params.activeProfileId
      ? getRetrievalProfile(params.activeProfileId).id
      : params.currentActiveProfileId,
    overrides: { ...params.currentOverrides, ...(params.overrides ?? {}) },
    updatedAt: new Date().toISOString(),
  };
}

export function buildAdminOntologyReview(projectRoot: string): AdminOntologyReviewResponse {
  const manifests = [
    {
      source: 'generated' as const,
      manifest: loadGeneratedOntologyManifest(projectRoot),
    },
    {
      source: 'curated' as const,
      manifest: loadCuratedOntologyManifest(projectRoot),
    },
  ];

  const concepts = manifests.flatMap(({ source, manifest }) =>
    manifest.concepts.map((concept) => {
      const recommendation = getOntologyReviewRecommendation(concept);
      return {
        source,
        label: concept.label,
        entityType: concept.entity_type,
        status: concept.status ?? 'candidate',
        confidence: concept.confidence,
        aliases: concept.aliases ?? [],
        slotHints: concept.slot_hints ?? [],
        relationCount: concept.relations?.length ?? 0,
        statusReason: concept.status_reason,
        recommendedStatus: recommendation.recommendedStatus,
        recommendationReason: recommendation.recommendationReason,
        evidence: (concept.evidence ?? []).slice(0, 3).map((evidence) => ({
          label: evidence.label,
          path: evidence.path,
          reason: evidence.reason,
        })),
      };
    }),
  );

  return {
    concepts: concepts.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status.localeCompare(right.status);
      }
      return left.label.localeCompare(right.label, 'ko');
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function updateOntologyConceptReviewManifest(params: {
  projectRoot: string;
  source: 'generated' | 'curated';
  label: string;
  status: 'candidate' | 'validated' | 'promoted' | 'rejected';
  statusReason?: string;
}): void {
  const sourceManifest =
    params.source === 'curated'
      ? loadCuratedOntologyManifest(params.projectRoot)
      : loadGeneratedOntologyManifest(params.projectRoot);

  const nextManifest = {
    ...sourceManifest,
    concepts: sourceManifest.concepts.map((concept) =>
      concept.label === params.label
        ? {
            ...concept,
            status: params.status,
            status_reason: params.statusReason ?? concept.status_reason,
          }
        : concept,
    ),
  };

  if (params.source === 'curated') {
    writeCuratedOntologyManifest(params.projectRoot, nextManifest);
  } else {
    writeGeneratedOntologyManifest(params.projectRoot, nextManifest);
  }
}

export function updateOntologyConceptReviewBatchManifest(params: {
  projectRoot: string;
  updates: Array<{
    source: 'generated' | 'curated';
    label: string;
    status: 'candidate' | 'validated' | 'promoted' | 'rejected';
    statusReason?: string;
  }>;
}): void {
  for (const source of ['generated', 'curated'] as const) {
    const sourceUpdates = params.updates.filter((update) => update.source === source);
    if (sourceUpdates.length === 0) continue;

    const updatesByLabel = new Map(sourceUpdates.map((update) => [update.label, update]));
    const sourceManifest =
      source === 'curated' ? loadCuratedOntologyManifest(params.projectRoot) : loadGeneratedOntologyManifest(params.projectRoot);
    const nextManifest = {
      ...sourceManifest,
      concepts: sourceManifest.concepts.map((concept) => {
        const update = updatesByLabel.get(concept.label);
        return update
          ? {
              ...concept,
              status: update.status,
              status_reason: update.statusReason ?? concept.status_reason,
            }
          : concept;
      }),
    };

    if (source === 'curated') {
      writeCuratedOntologyManifest(params.projectRoot, nextManifest);
    } else {
      writeGeneratedOntologyManifest(params.projectRoot, nextManifest);
    }
  }
}

export function listEvalTrialReports(params: {
  projectRoot: string;
  recentEvalTrials: EvalTrialReport[];
  onReadError?: (filePath: string, error: unknown) => void;
}): EvalTrialReport[] {
  const outputDir = path.join(params.projectRoot, 'benchmarks', 'trials');
  const diskReports = fs.existsSync(outputDir)
    ? fs
        .readdirSync(outputDir)
        .filter((fileName) => fileName.endsWith('.json'))
        .map((fileName) => {
          const filePath = path.join(outputDir, fileName);
          try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8')) as EvalTrialReport;
          } catch (error) {
            params.onReadError?.(filePath, error);
            return null;
          }
        })
        .filter((report): report is EvalTrialReport => report !== null)
    : [];

  const merged = new Map<string, EvalTrialReport>();
  for (const report of [...params.recentEvalTrials, ...diskReports]) {
    merged.set(report.id, report);
  }

  return Array.from(merged.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function rememberEvalTrialReport(recentEvalTrials: EvalTrialReport[], report: EvalTrialReport, limit = 12): void {
  recentEvalTrials.unshift(report);
  if (recentEvalTrials.length > limit) {
    recentEvalTrials.splice(limit);
  }
}

export async function buildAndPersistAdminReindex(params: {
  projectRoot: string;
  store: RagStore;
  embeddingAi: GoogleGenAI | null;
  brain: DomainBrain;
}): Promise<void> {
  const files = await loadKnowledgeFilesForIndex(params.projectRoot);
  const structuredChunks = buildStructuredChunks(files);
  const previousManifestEntries = params.store.getManifestEntries();
  const ontologyRows = buildOntologyRows(
    buildOntologyGraph(
      params.brain,
      structuredChunks,
      loadGeneratedOntologyManifest(params.projectRoot),
      loadCuratedOntologyManifest(params.projectRoot),
    ),
  );
  const documentVersionRows = buildDocumentVersionRows(files);
  const sectionRows = buildSectionRows(files);
  const chunkRows = copyExistingEmbeddingsToChunkRows(buildChunkRows(files), params.store.getChunks());
  const { changedDocumentIds, removedDocumentIds } = diffManifestEntries(
    previousManifestEntries,
    buildIndexManifestEntriesFromRows(files, chunkRows),
  );
  const changedDocumentIdSet = new Set(changedDocumentIds);
  if (params.embeddingAi && changedDocumentIdSet.size > 0) {
    await embedIndexRows(params.embeddingAi, filterRowsByDocumentIds(chunkRows, changedDocumentIdSet, 'document_id'));
  }
  const manifestEntries = buildIndexManifestEntriesFromRows(files, chunkRows);
  const documentRows = buildDocumentRows(files, manifestEntries);
  const compiledRows = buildCompiledRows(files);
  const indexMetadataRow = buildIndexMetadataRow(
    manifestEntries,
    params.store instanceof PostgresRagStore ? 'postgres' : 'memory',
  );
  const cacheDir = path.join(params.projectRoot, '.rag-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, 'rag-index.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        manifestEntries,
        indexMetadata: indexMetadataRow,
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

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && params.store instanceof PostgresRagStore) {
    await upsertRowsToPostgres({
      connectionString: databaseUrl,
      documentRows: filterRowsByDocumentIds(documentRows, changedDocumentIdSet, 'id'),
      documentVersionRows: filterRowsByDocumentIds(documentVersionRows, changedDocumentIdSet, 'document_id'),
      sectionRows: filterRowsByDocumentIds(sectionRows, changedDocumentIdSet, 'document_id'),
      chunkRows: filterRowsByDocumentIds(chunkRows, changedDocumentIdSet, 'document_id'),
      compiledRows,
      ontologyEntityRows: ontologyRows.entityRows,
      ontologyAliasRows: ontologyRows.aliasRows,
      ontologyEdgeRows: ontologyRows.edgeRows,
      indexMetadataRow,
      changedDocumentIds,
      removedDocumentIds,
      replaceCompiledRows: true,
      replaceOntologyRows: true,
    });
  }
}

export function loadBenchmarkCases(projectRoot: string): BenchmarkCase[] {
  const benchmarkPath = path.join(projectRoot, 'benchmarks', 'golden-cases.json');
  if (!fs.existsSync(benchmarkPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) as BenchmarkCase[];
  return parsed;
}

export function buildChunkRows(files: KnowledgeFile[]): Array<Record<string, unknown>> {
  return buildStructuredChunks(files).map((chunk) => ({
    id: chunk.id,
    document_id: chunk.documentId,
    chunk_index: chunk.chunkIndex,
    title: chunk.title,
    text: chunk.text,
    search_text: chunk.searchText,
    mode: chunk.mode,
    source_type: chunk.sourceType,
    source_role: chunk.sourceRole,
    document_group: chunk.documentGroup,
    doc_title: chunk.docTitle,
    file_name: chunk.fileName,
    path: chunk.path,
    effective_date: chunk.effectiveDate ?? null,
    published_date: chunk.publishedDate ?? null,
    section_path: chunk.sectionPath,
    heading_path: chunk.headingPath,
    article_no: chunk.articleNo ?? null,
    matched_labels: chunk.matchedLabels,
    linked_document_titles: chunk.linkedDocumentTitles,
    chunk_hash: chunk.chunkHash,
    parent_section_id: chunk.parentSectionId,
    parent_section_title: chunk.parentSectionTitle,
    list_group_id: chunk.listGroupId ?? null,
    contains_checklist: chunk.containsCheckList,
    embedding_input: chunk.embeddingInput,
    window_index: chunk.windowIndex,
    span_start: chunk.spanStart,
    span_end: chunk.spanEnd,
    citation_group_id: chunk.citationGroupId,
    embedding: chunk.embedding ?? null,
  }));
}

export function buildIndexManifestEntriesFromRows(
  files: KnowledgeFile[],
  chunkRows: Array<Record<string, unknown>>,
): IndexManifestEntry[] {
  const chunkCounts = new Map<string, { chunkCount: number; embeddingCount: number }>();
  for (const row of chunkRows) {
    const documentId = String(row.document_id);
    const current = chunkCounts.get(documentId) ?? { chunkCount: 0, embeddingCount: 0 };
    current.chunkCount += 1;
    if (Array.isArray(row.embedding) && (row.embedding as number[]).length > 0) {
      current.embeddingCount += 1;
    }
    chunkCounts.set(documentId, current);
  }

  return files
    .map((file) => {
      const metadata = toDocumentMetadata(file);
      const counts = chunkCounts.get(metadata.documentId) ?? { chunkCount: 0, embeddingCount: 0 };
      return {
        documentId: metadata.documentId,
        path: metadata.path,
        name: metadata.fileName,
        mode: metadata.mode,
        contentHash: sha1(file.content),
        size: file.size,
        updatedAt: file.updatedAt,
        chunkCount: counts.chunkCount,
        embeddingCount: counts.embeddingCount,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path, 'ko'));
}

export function buildDocumentRows(
  files: KnowledgeFile[],
  manifestEntries = buildKnowledgeManifest(files, buildStructuredChunks(files)),
): Array<Record<string, unknown>> {
  const manifestByPath = new Map(manifestEntries.map((entry) => [entry.path, entry] as const));

  return files.map((file) => {
    const metadata = toDocumentMetadata(file);
    const manifestEntry = manifestByPath.get(metadata.path);
    return {
      id: metadata.documentId,
      title: metadata.title,
      file_name: metadata.fileName,
      path: metadata.path,
      mode: metadata.mode,
      source_role: metadata.sourceRole,
      source_type: metadata.sourceType,
      document_group: metadata.documentGroup,
      effective_date: metadata.effectiveDate ?? null,
      published_date: metadata.publishedDate ?? null,
      content_hash: manifestEntry?.contentHash ?? sha1(file.content),
      file_size: manifestEntry?.size ?? file.size,
      source_mtime: manifestEntry?.updatedAt ?? file.updatedAt ?? null,
      chunk_count: manifestEntry?.chunkCount ?? 0,
      embedding_count: manifestEntry?.embeddingCount ?? 0,
    };
  });
}

export function buildDocumentVersionRows(files: KnowledgeFile[]): Array<Record<string, unknown>> {
  return files.map((file) => {
    const metadata = toDocumentMetadata(file);
    return {
      id: `${metadata.documentId}:v1`,
      document_id: metadata.documentId,
      version_hash: sha1(file.content),
      raw_content: file.content,
    };
  });
}

export function buildSectionRows(files: KnowledgeFile[]): Array<Record<string, unknown>> {
  return files.flatMap((file) =>
    buildStructuredSections(file).map((section) => ({
      id: section.id,
      document_id: section.documentId,
      title: section.title,
      depth: section.depth,
      section_path: section.path,
      article_no: section.articleNo ?? null,
      line_start: section.lineStart,
      line_end: section.lineEnd,
      content: section.content,
    })),
  );
}

export async function loadKnowledgeFilesForIndex(projectRoot: string): Promise<KnowledgeFile[]> {
  const corpora = loadKnowledgeCorporaFromDisk(projectRoot);
  return mergeCorpora(corpora.integrated, corpora.evaluation);
}

export async function embedIndexRows(ai: GoogleGenAI, rows: Array<Record<string, unknown>>): Promise<number> {
  const rowsById = new Map(rows.map((row) => [String(row.id), row] as const));
  const chunkLike = rows.map((row) => ({
    id: String(row.id),
    searchText: String(row.embedding_input ?? row.search_text),
    embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : undefined,
  }));

  if (shouldSkipEmbeddingWork('index embeddings')) return 0;

  let embeddedCount = 0;
  const missing = chunkLike.filter((item) => !item.embedding);
  const target = missing.slice(0, EMBEDDING_MAX_CHUNKS_PER_PASS);

  for (let index = 0; index < target.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = target.slice(index, index + EMBEDDING_BATCH_SIZE).filter((item) => !item.embedding);
    if (batch.length === 0) continue;
    try {
      const responses = await Promise.all(
        batch.map((item) =>
          ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: item.searchText,
            config: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
            },
          }),
        ),
      );
      responses.forEach((response, responseIndex) => {
        const embedding = prepareEmbedding(response.embeddings[0]?.values);
        const row = rowsById.get(batch[responseIndex].id);
        if (row && embedding.length > 0) {
          row.embedding = embedding;
          embeddedCount += 1;
        }
      });
    } catch (error) {
      if (isQuotaExceededError(error)) {
        markEmbeddingQuotaExceeded(error, `index batch ${index}~${index + batch.length}`);
        break;
      }
      console.warn(`[embedding] index batch ${index}~${index + batch.length} failed: ${describeError(error)}`);
    }
  }

  if (missing.length > target.length) {
    console.info(`[embedding] deferred ${missing.length - target.length} index chunks for later passes.`);
  }

  return embeddedCount;
}

export function buildCompiledRows(files: KnowledgeFile[]): Array<Record<string, unknown>> {
  const pages = buildCompiledPages(buildStructuredChunks(files));
  return pages.map((page) => ({
    id: page.id,
    page_type: page.pageType,
    title: page.title,
    mode: page.mode,
    source_document_ids: page.sourceDocumentIds,
    backlinks: page.backlinks,
    summary: page.summary,
    body: page.body,
    tags: page.tags,
  }));
}

async function insertRowsInBatches(params: {
  client: PoolClient;
  table: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  mapRow: (row: Record<string, unknown>) => unknown[];
  batchSize?: number;
}): Promise<void> {
  const batchSize = Math.max(1, params.batchSize ?? 25);
  for (let index = 0; index < params.rows.length; index += batchSize) {
    const batch = params.rows.slice(index, index + batchSize);
    if (batch.length === 0) continue;

    const values: unknown[] = [];
    const placeholders = batch.map((row) => {
      const rowValues = params.mapRow(row);
      const rowPlaceholders = rowValues.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${rowPlaceholders.join(',')})`;
    });

    await params.client.query(
      `insert into ${params.table} (${params.columns.join(',')}) values ${placeholders.join(',')}`,
      values,
    );
  }
}

export async function upsertRowsToPostgres(params: {
  connectionString: string;
  documentRows: Array<Record<string, unknown>>;
  documentVersionRows: Array<Record<string, unknown>>;
  sectionRows: Array<Record<string, unknown>>;
  chunkRows: Array<Record<string, unknown>>;
  compiledRows: Array<Record<string, unknown>>;
  ontologyEntityRows?: Array<Record<string, unknown>>;
  ontologyAliasRows?: Array<Record<string, unknown>>;
  ontologyEdgeRows?: Array<Record<string, unknown>>;
  indexMetadataRow: Record<string, unknown>;
  changedDocumentIds?: string[];
  removedDocumentIds?: string[];
  replaceCompiledRows?: boolean;
  replaceOntologyRows?: boolean;
}): Promise<void> {
  const pool = new Pool({ connectionString: params.connectionString });
  const client = await pool.connect();
  try {
    const pg = <T>(value: T): T => sanitizePostgresValue(value);
    const staleDocumentIds = Array.from(
      new Set([...(params.changedDocumentIds ?? []), ...(params.removedDocumentIds ?? [])]),
    );

    await ensurePostgresSchema(client);
    await client.query('begin');
    if (staleDocumentIds.length > 0) {
      await client.query('delete from documents where id = any($1::text[])', [staleDocumentIds]);
    }
    if (params.replaceCompiledRows) {
      await client.query('delete from compiled_pages');
    }
    if (params.replaceOntologyRows) {
      await client.query('delete from ontology_entities');
    }

    await insertRowsInBatches({
      client,
      table: 'documents',
      columns: [
        'id',
        'title',
        'file_name',
        'path',
        'mode',
        'source_role',
        'source_type',
        'document_group',
        'effective_date',
        'published_date',
        'content_hash',
        'file_size',
        'source_mtime',
        'chunk_count',
        'embedding_count',
      ],
      rows: params.documentRows,
      batchSize: 20,
      mapRow: (row) => [
        pg(row.id),
        pg(row.title),
        pg(row.file_name),
        pg(row.path),
        pg(row.mode),
        pg(row.source_role),
        pg(row.source_type),
        pg(row.document_group),
        row.effective_date,
        row.published_date,
        pg(row.content_hash),
        row.file_size,
        row.source_mtime,
        row.chunk_count,
        row.embedding_count,
      ],
    });

    await insertRowsInBatches({
      client,
      table: 'document_versions',
      columns: ['id', 'document_id', 'version_hash', 'raw_content'],
      rows: params.documentVersionRows,
      batchSize: 10,
      mapRow: (row) => [pg(row.id), pg(row.document_id), pg(row.version_hash), pg(row.raw_content)],
    });

    await insertRowsInBatches({
      client,
      table: 'sections',
      columns: ['id', 'document_id', 'title', 'depth', 'section_path', 'article_no', 'line_start', 'line_end', 'content'],
      rows: params.sectionRows,
      batchSize: 20,
      mapRow: (row) => [
        pg(row.id),
        pg(row.document_id),
        pg(row.title),
        row.depth,
        JSON.stringify(pg(row.section_path)),
        pg(row.article_no),
        row.line_start,
        row.line_end,
        pg(row.content),
      ],
    });

    await insertRowsInBatches({
      client,
      table: 'chunks',
      columns: [
        'id',
        'document_id',
        'chunk_index',
        'title',
        'text',
        'search_text',
        'mode',
        'source_type',
        'source_role',
        'document_group',
        'doc_title',
        'file_name',
        'path',
        'effective_date',
        'published_date',
        'section_path',
        'heading_path',
        'article_no',
        'matched_labels',
        'linked_document_titles',
        'chunk_hash',
        'parent_section_id',
        'parent_section_title',
        'list_group_id',
        'contains_checklist',
        'embedding_input',
        'window_index',
        'span_start',
        'span_end',
        'citation_group_id',
        'embedding',
      ],
      rows: params.chunkRows,
      batchSize: 10,
      mapRow: (row) => [
        pg(row.id),
        pg(row.document_id),
        row.chunk_index,
        pg(row.title),
        pg(row.text),
        pg(row.search_text),
        pg(row.mode),
        pg(row.source_type),
        pg(row.source_role),
        pg(row.document_group),
        pg(row.doc_title),
        pg(row.file_name),
        pg(row.path),
        row.effective_date,
        row.published_date,
        JSON.stringify(pg(row.section_path)),
        JSON.stringify(pg(row.heading_path ?? row.section_path)),
        pg(row.article_no),
        JSON.stringify(pg(row.matched_labels)),
        JSON.stringify(pg(row.linked_document_titles)),
        pg(row.chunk_hash),
        pg(row.parent_section_id),
        pg(row.parent_section_title),
        pg(row.list_group_id),
        Boolean(row.contains_checklist),
        pg(row.embedding_input ?? row.search_text),
        row.window_index,
        row.span_start,
        row.span_end,
        pg(row.citation_group_id),
        Array.isArray(row.embedding) && (row.embedding as number[]).length === EMBEDDING_DIMENSIONS
          ? `[${(row.embedding as number[]).join(',')}]`
          : null,
      ],
    });

    if (params.replaceCompiledRows) {
      await insertRowsInBatches({
        client,
        table: 'compiled_pages',
        columns: ['id', 'page_type', 'title', 'mode', 'source_document_ids', 'backlinks', 'summary', 'body', 'tags'],
        rows: params.compiledRows,
        batchSize: 20,
        mapRow: (row) => [
          pg(row.id),
          pg(row.page_type),
          pg(row.title),
          pg(row.mode),
          JSON.stringify(pg(row.source_document_ids)),
          JSON.stringify(pg(row.backlinks)),
          pg(row.summary),
          pg(row.body),
          JSON.stringify(pg(row.tags)),
        ],
      });
    }

    if (params.replaceOntologyRows) {
      await insertRowsInBatches({
        client,
        table: 'ontology_entities',
        columns: ['id', 'entity_type', 'label', 'metadata'],
        rows: params.ontologyEntityRows ?? [],
        batchSize: 50,
        mapRow: (row) => [pg(row.id), pg(row.entity_type), pg(row.label), JSON.stringify(pg(row.metadata ?? {}))],
      });
      await insertRowsInBatches({
        client,
        table: 'ontology_aliases',
        columns: ['id', 'entity_id', 'alias', 'alias_type', 'weight'],
        rows: params.ontologyAliasRows ?? [],
        batchSize: 50,
        mapRow: (row) => [pg(row.id), pg(row.entity_id), pg(row.alias), pg(row.alias_type), row.weight],
      });
      await insertRowsInBatches({
        client,
        table: 'ontology_edges',
        columns: ['id', 'from_entity_id', 'to_entity_id', 'relation', 'weight', 'metadata'],
        rows: params.ontologyEdgeRows ?? [],
        batchSize: 50,
        mapRow: (row) => [
          pg(row.id),
          pg(row.from_entity_id),
          pg(row.to_entity_id),
          pg(row.relation),
          row.weight,
          JSON.stringify(pg(row.metadata ?? {})),
        ],
      });
    }

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
        pg(params.indexMetadataRow.id),
        params.indexMetadataRow.generated_at,
        pg(params.indexMetadataRow.storage_mode),
        pg(params.indexMetadataRow.manifest_hash),
        params.indexMetadataRow.document_count,
        params.indexMetadataRow.chunk_count,
        params.indexMetadataRow.embedding_count,
        JSON.stringify(pg(params.indexMetadataRow.mode_counts)),
      ],
    );
    await client.query('commit');
  } finally {
    client.release();
    await pool.end();
  }
}
