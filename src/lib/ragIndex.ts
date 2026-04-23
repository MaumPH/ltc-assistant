import { sha1, toDocumentMetadata } from './ragMetadata';
import { buildStructuredSections } from './ragStructured';
import type {
  DocumentDiagnostics,
  EmbeddingCoverage,
  IndexManifestEntry,
  IndexStatus,
  KnowledgeDoctorIssue,
  KnowledgeFile,
  PromptMode,
  RecentRetrievalMatch,
  RetrievalReadiness,
  StructuredChunk,
} from './ragTypes';

const OVERSIZED_SECTION_CHARS = 4_800;

function toIsoTimestamp(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function emptyModeCounts(): Record<PromptMode, number> {
  return {
    integrated: 0,
    evaluation: 0,
  };
}

function parseReadyThreshold(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
}

export function buildKnowledgeManifest(files: KnowledgeFile[], chunks: StructuredChunk[]): IndexManifestEntry[] {
  const chunksByDocumentId = new Map<string, StructuredChunk[]>();
  for (const chunk of chunks) {
    const list = chunksByDocumentId.get(chunk.documentId) ?? [];
    list.push(chunk);
    chunksByDocumentId.set(chunk.documentId, list);
  }

  return files
    .map((file) => {
      const metadata = toDocumentMetadata(file);
      const documentChunks = chunksByDocumentId.get(metadata.documentId) ?? [];
      return {
        documentId: metadata.documentId,
        path: metadata.path,
        name: metadata.fileName,
        mode: metadata.mode,
        contentHash: sha1(file.content),
        size: file.size,
        updatedAt: toIsoTimestamp(file.updatedAt),
        chunkCount: documentChunks.length,
        embeddingCount: documentChunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0).length,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path, 'ko'));
}

export function buildManifestHash(entries: IndexManifestEntry[]): string {
  const serialized = entries
    .slice()
    .sort((left, right) => left.path.localeCompare(right.path, 'ko'))
    .map((entry) =>
      [
        entry.path,
        entry.mode,
        entry.contentHash,
        entry.size,
        entry.updatedAt ?? '',
        entry.chunkCount,
        entry.embeddingCount,
      ].join('|'),
    )
    .join('\n');

  return sha1(serialized);
}

export function buildEmbeddingCoverage(entries: IndexManifestEntry[]): EmbeddingCoverage {
  const embeddedChunks = entries.reduce((sum, entry) => sum + entry.embeddingCount, 0);
  const totalChunks = entries.reduce((sum, entry) => sum + entry.chunkCount, 0);
  return {
    embeddedChunks,
    totalChunks,
    ratio: totalChunks === 0 ? 0 : Number((embeddedChunks / totalChunks).toFixed(4)),
  };
}

export function buildModeCounts(entries: IndexManifestEntry[]): Record<PromptMode, number> {
  const modeCounts = emptyModeCounts();
  for (const entry of entries) {
    modeCounts[entry.mode] += 1;
  }
  return modeCounts;
}

export function inferRetrievalReadiness(embeddingCoverage: EmbeddingCoverage): RetrievalReadiness {
  const readyThreshold = parseReadyThreshold(process.env.RAG_EMBEDDING_READY_THRESHOLD, 0.9);
  if (embeddingCoverage.embeddedChunks <= 0) return 'lexical_only';
  if (embeddingCoverage.ratio >= readyThreshold) return 'hybrid_ready';
  return 'hybrid_partial';
}

export function compareIndexStatus(params: {
  diskEntries: IndexManifestEntry[];
  indexedEntries: IndexManifestEntry[];
  storageMode: string;
  generatedAt?: string;
  issues?: KnowledgeDoctorIssue[];
  nextEmbeddingRetryAt?: string;
}): IndexStatus {
  const diskManifestHash = buildManifestHash(params.diskEntries);
  const indexedManifestHash = buildManifestHash(params.indexedEntries);
  const diskByPath = new Map(params.diskEntries.map((entry) => [entry.path, entry] as const));
  const indexedByPath = new Map(params.indexedEntries.map((entry) => [entry.path, entry] as const));

  const staleDocuments: string[] = [];
  const missingDocuments: string[] = [];
  const orphanedDocuments: string[] = [];

  for (const diskEntry of params.diskEntries) {
    const indexedEntry = indexedByPath.get(diskEntry.path);
    if (!indexedEntry) {
      missingDocuments.push(diskEntry.path);
      continue;
    }
    if (
      indexedEntry.contentHash !== diskEntry.contentHash ||
      indexedEntry.mode !== diskEntry.mode ||
      indexedEntry.size !== diskEntry.size ||
      (indexedEntry.updatedAt ?? '') !== (diskEntry.updatedAt ?? '')
    ) {
      staleDocuments.push(diskEntry.path);
    }
  }

  for (const indexedEntry of params.indexedEntries) {
    if (!diskByPath.has(indexedEntry.path)) {
      orphanedDocuments.push(indexedEntry.path);
    }
  }

  const embeddingCoverage = buildEmbeddingCoverage(params.indexedEntries);
  const state =
    staleDocuments.length > 0 || missingDocuments.length > 0 || orphanedDocuments.length > 0
      ? 'stale'
      : embeddingCoverage.totalChunks > 0 && embeddingCoverage.embeddedChunks < embeddingCoverage.totalChunks
        ? 'partial_embeddings'
        : 'fresh';
  const manifestHash = state === 'stale' ? diskManifestHash : indexedManifestHash;

  return {
    state,
    storageMode: params.storageMode,
    manifestHash,
    diskManifestHash,
    indexedManifestHash,
    diskDocumentCount: params.diskEntries.length,
    indexedDocumentCount: params.indexedEntries.length,
    chunkCount: params.indexedEntries.reduce((sum, entry) => sum + entry.chunkCount, 0),
    staleDocuments,
    missingDocuments,
    orphanedDocuments,
    embeddingCoverage,
    retrievalReadiness: inferRetrievalReadiness(embeddingCoverage),
    pendingEmbeddingChunks: Math.max(embeddingCoverage.totalChunks - embeddingCoverage.embeddedChunks, 0),
    nextEmbeddingRetryAt: params.nextEmbeddingRetryAt,
    generatedAt: params.generatedAt,
    modeCounts: buildModeCounts(params.diskEntries),
    issues: params.issues ?? [],
  };
}

export function buildKnowledgeDoctorIssues(files: KnowledgeFile[], chunks: StructuredChunk[]): KnowledgeDoctorIssue[] {
  const manifest = buildKnowledgeManifest(files, chunks);
  const issues: KnowledgeDoctorIssue[] = [];

  for (const file of files) {
    if (file.nulStripped) {
      issues.push({
        code: 'nul-stripped',
        path: file.path,
        severity: 'warning',
        message: 'The source file contained NUL characters and was sanitized during ingestion.',
      });
    }
    if (!file.content.trim()) {
      issues.push({
        code: 'empty-document',
        path: file.path,
        severity: 'warning',
        message: 'The document is empty after trimming whitespace.',
      });
    }
  }

  const duplicatesByHash = new Map<string, IndexManifestEntry[]>();
  for (const entry of manifest) {
    const list = duplicatesByHash.get(entry.contentHash) ?? [];
    list.push(entry);
    duplicatesByHash.set(entry.contentHash, list);
  }

  for (const entries of duplicatesByHash.values()) {
    if (entries.length < 2) continue;
    const duplicatePaths = entries.map((entry) => entry.path).join(', ');
    for (const entry of entries) {
      issues.push({
        code: 'duplicate-content',
        path: entry.path,
        severity: 'warning',
        message: `This document shares the same content hash with another file: ${duplicatePaths}`,
      });
    }
  }

  for (const file of files) {
    const sections = buildStructuredSections(file);
    for (const section of sections) {
      if (section.content.length <= OVERSIZED_SECTION_CHARS) continue;
      issues.push({
        code: 'oversized-section',
        path: file.path,
        severity: 'warning',
        message: `A section exceeded ${OVERSIZED_SECTION_CHARS} characters before chunking.`,
      });
      break;
    }
  }

  for (const entry of manifest) {
    if (entry.chunkCount > 0) continue;
    issues.push({
      code: 'zero-chunks',
      path: entry.path,
      severity: 'warning',
      message: 'No retrievable chunks were generated for this document.',
    });
  }

  return issues.sort((left, right) => left.path.localeCompare(right.path, 'ko'));
}

export function buildDocumentDiagnostics(params: {
  path: string;
  diskEntry?: IndexManifestEntry;
  indexedEntry?: IndexManifestEntry;
  status: IndexStatus;
  issues: KnowledgeDoctorIssue[];
  recentRetrieval: RecentRetrievalMatch | null;
}): DocumentDiagnostics {
  const entry = params.diskEntry ?? params.indexedEntry;
  const chunkCount = params.indexedEntry?.chunkCount ?? params.diskEntry?.chunkCount ?? 0;
  const embeddingCount = params.indexedEntry?.embeddingCount ?? 0;

  let indexState: DocumentDiagnostics['indexState'] = 'fresh';
  if (!params.indexedEntry) {
    indexState = 'missing';
  } else if (params.status.staleDocuments.includes(params.path) || params.status.missingDocuments.includes(params.path)) {
    indexState = 'stale';
  }

  return {
    path: params.path,
    existsOnDisk: Boolean(params.diskEntry),
    indexed: Boolean(params.indexedEntry),
    mode: entry?.mode,
    contentHash: entry?.contentHash,
    size: entry?.size,
    updatedAt: entry?.updatedAt,
    chunkCount,
    embeddingCount,
    embeddingCoverage: {
      embeddedChunks: embeddingCount,
      totalChunks: chunkCount,
      ratio: chunkCount === 0 ? 0 : Number((embeddingCount / chunkCount).toFixed(4)),
    },
    indexState,
    issues: params.issues,
    recentRetrieval: params.recentRetrieval,
  };
}
