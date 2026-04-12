import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Pool, type PoolClient } from 'pg';
import {
  buildRagCorpusIndex,
  deriveFocusTerms,
  getCandidateFocusMatches,
  isGenericQueryTerm,
  searchCorpus,
  type RagCorpusIndex,
  type SearchOptions,
} from './ragEngine';
import {
  buildDocumentDiagnostics,
  buildKnowledgeDoctorIssues,
  buildKnowledgeManifest,
  compareIndexStatus,
} from './ragIndex';
import {
  buildBrainDocumentBoosts,
  buildBrainQueryProfile,
  buildDriftSubquestions,
  buildWorkflowBriefs,
  detectServiceScopeClarification,
  loadDomainBrain,
  selectWorkflowBriefs,
  summarizeWorkflowEvents,
  type DomainBrain,
  type WorkflowBrief,
} from './brain';
import {
  buildBasisCoverage,
  buildExpertKnowledgeContext,
  createExpertAbstainAnswer,
  createExpertClarificationAnswer,
  detectClarificationNeed,
  generateAnswerPlan,
  renderExpertAnswerMarkdown,
  synthesizeExpertAnswer,
} from './expertAnswering';
import {
  buildPreciseCitationLabel,
  compareIsoDateDesc,
  extractLinkedDocumentTitles,
  formatEvidenceStateLabel,
  inferSourceRole,
  normalizeDocumentTitle,
  sha1,
  toDocumentMetadata,
} from './ragMetadata';
import { loadKnowledgeCorporaFromDisk } from './nodeKnowledge';
import { loadPromptSourceSet } from './nodePrompts';
import type { PromptVariant } from './promptAssembly';
import { resolveEmbeddingApiKey, resolveGenerationMode, resolveServerGenerationApiKey } from './ragRuntime';
import { buildCompiledPages, buildStructuredChunks, buildStructuredSections, chunksToEvidenceContext } from './ragStructured';
import type {
  BenchmarkCase,
  CandidateDiagnostic,
  ExpertAnswerEnvelope,
  ChatCapabilities,
  ChatMessage,
  ChunkWindowRef,
  CompiledPage,
  ConfidenceLevel,
  DocumentDiagnostics,
  GenerationMode,
  GroundedAnswer,
  IndexManifestEntry,
  IndexStatus,
  KnowledgeFile,
  KnowledgeDoctorIssue,
  PromptMode,
  QueryIntent,
  RetrievalMode,
  RetrievalDiagnostics,
  RetrievalReadiness,
  RecentRetrievalMatch,
  SearchCandidate,
  SearchRun,
  SourceRole,
  StructuredChunk,
} from './ragTypes';
import { CHAT_MODELS } from './chatModels';

interface StoredChunkRow {
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
  article_no?: string | null;
  matched_labels?: string[] | string | null;
  chunk_hash: string;
  parent_section_id?: string | null;
  parent_section_title?: string | null;
  window_index?: number | string | null;
  span_start?: number | string | null;
  span_end?: number | string | null;
  citation_group_id?: string | null;
  linked_document_titles?: string[] | string | null;
  embedding?: number[] | string | null;
}

interface StoredDocumentRow {
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

interface StoredIndexMetadataRow {
  id: string;
  generated_at: string | Date;
  storage_mode: string;
  manifest_hash: string;
}

interface GroundedChatRequest {
  messages: ChatMessage[];
  mode: PromptMode;
  model: string;
  promptVariant: PromptVariant;
  apiKey?: string;
}

export interface GroundedChatResponse {
  answer: ExpertAnswerEnvelope;
  text: string;
  search: SearchRun;
  citations: StructuredChunk[];
  retrieval: RetrievalDiagnostics;
}

export interface RetrievalInspectionResponse {
  query: string;
  normalizedQuery: string;
  querySources: string[];
  search: SearchRun;
  compiledPages: CompiledPage[];
  indexStatus: IndexStatus;
  candidateDiagnostics: CandidateDiagnostic[];
  matchedDocumentPaths: string[];
  retrievalReadiness: RetrievalReadiness;
  stageTrace: SearchRun['stageTrace'];
  neighborWindows: ChunkWindowRef[];
  rejectionReasons: RetrievalDiagnostics['rejectionReasons'];
  routingDocuments: string[];
  primaryExpansionDocuments: string[];
  finalEvidenceDocuments: string[];
  selectedRetrievalMode: RetrievalDiagnostics['selectedRetrievalMode'];
  workflowEventsHit: RetrievalDiagnostics['workflowEventsHit'];
  subquestions: RetrievalDiagnostics['subquestions'];
  basisCoverage: RetrievalDiagnostics['basisCoverage'];
  plannerTrace: RetrievalDiagnostics['plannerTrace'];
}

interface RagStore {
  initialize(ai: GoogleGenAI | null): Promise<void>;
  ensureEmbeddings(ai: GoogleGenAI): Promise<void>;
  search(
    query: string,
    mode: PromptMode,
    queryEmbedding: number[] | null,
    queryAliases?: string[],
    options?: SearchOptions,
  ): SearchRun;
  getCompiledPages(mode: PromptMode, documentIds: string[]): CompiledPage[];
  listKnowledgeFiles(): { name: string; size: number; updatedAt: Date }[];
  getStats(): { chunks: number; compiledPages: number; storageMode: string };
  getChunks(): StructuredChunk[];
  getManifestEntries(): IndexManifestEntry[];
  getIndexGeneratedAt(): string | undefined;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_BATCH_SIZE = parsePositiveInteger(process.env.RAG_EMBEDDING_BATCH_SIZE, 20);
const EMBEDDING_MAX_CHUNKS_PER_PASS = parsePositiveInteger(process.env.RAG_EMBEDDING_MAX_CHUNKS_PER_PASS, 400);
const EMBEDDING_REFRESH_INTERVAL_MS = parsePositiveInteger(process.env.RAG_EMBEDDING_REFRESH_INTERVAL_MS, 15 * 60 * 1000);
const EMBEDDING_QUOTA_COOLDOWN_MS = parsePositiveInteger(process.env.RAG_EMBEDDING_QUOTA_COOLDOWN_MS, 6 * 60 * 60 * 1000);
const MAX_CONTEXT_CHARS_BY_MODE: Record<PromptMode, number> = {
  integrated: 16_000,
  evaluation: 12_000,
};
const EMBEDDING_CACHE_FILE = 'embeddings.json';

let embeddingQuotaBlockedUntil = 0;
let embeddingQuotaBlockLogShown = false;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stripNullCharacters(value: string): string {
  return value.replace(/\u0000/g, '');
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

export function prepareEmbedding(values: number[] | undefined | null): number[] {
  if (!values || values.length === 0) return [];
  const clipped = values.length > EMBEDDING_DIMENSIONS ? values.slice(0, EMBEDDING_DIMENSIONS) : values;
  if (clipped.length !== EMBEDDING_DIMENSIONS) return [];

  const norm = Math.sqrt(clipped.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    return clipped;
  }
  return clipped.map((value) => value / norm);
}

function isQuotaExceededError(error: unknown): boolean {
  const message = describeError(error);
  return (
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('"code":429') ||
    message.includes('code 429') ||
    message.includes('quota')
  );
}

function shouldSkipEmbeddingWork(context: string): boolean {
  if (Date.now() < embeddingQuotaBlockedUntil) {
    if (!embeddingQuotaBlockLogShown) {
      console.warn(
        `[embedding] skipping ${context} until ${new Date(embeddingQuotaBlockedUntil).toISOString()} because quota is exhausted.`,
      );
      embeddingQuotaBlockLogShown = true;
    }
    return true;
  }

  embeddingQuotaBlockLogShown = false;
  return false;
}

function markEmbeddingQuotaExceeded(error: unknown, context: string): void {
  embeddingQuotaBlockedUntil = Date.now() + EMBEDDING_QUOTA_COOLDOWN_MS;
  embeddingQuotaBlockLogShown = false;
  console.warn(
    `[embedding] ${context} hit quota exhaustion. Pausing embedding attempts until ${new Date(embeddingQuotaBlockedUntil).toISOString()}: ${describeError(error)}`,
  );
}

function getNextEmbeddingRetryAt(): string | undefined {
  return Date.now() < embeddingQuotaBlockedUntil ? new Date(embeddingQuotaBlockedUntil).toISOString() : undefined;
}

function parseStringArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return value
      .split('>')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function parseEmbedding(value: number[] | string | null | undefined): number[] | undefined {
  if (Array.isArray(value)) return value;
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)) : undefined;
  } catch {
    return undefined;
  }
}

function parseNumberValue(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function rowToChunk(row: StoredChunkRow): StructuredChunk {
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
    articleNo: row.article_no ?? undefined,
    matchedLabels: parseStringArray(row.matched_labels),
    chunkHash: row.chunk_hash,
    parentSectionId,
    parentSectionTitle,
    windowIndex: parseNumberValue(row.window_index),
    spanStart: parseNumberValue(row.span_start),
    spanEnd: parseNumberValue(row.span_end),
    citationGroupId: row.citation_group_id ?? sha1(`${row.document_id}:${parentSectionId}`),
    linkedDocumentTitles,
    embedding: parseEmbedding(row.embedding),
  };
}

function rowToManifestEntry(row: StoredDocumentRow): IndexManifestEntry {
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

function updateManifestEntriesFromChunks(
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

function manifestEntriesToKnowledgeStats(entries: IndexManifestEntry[]): Array<{ name: string; size: number; updatedAt: Date }> {
  return entries
    .map((entry) => ({
      name: entry.path.replace(/^\/knowledge\//, ''),
      size: entry.size,
      updatedAt: new Date(entry.updatedAt ?? 0),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
}

function chunkToCitationLine(chunk: StructuredChunk): string {
  return buildPreciseCitationLabel(chunk);
}

function dedupeCitations(chunks: StructuredChunk[]): StructuredChunk[] {
  const seen = new Set<string>();
  const result: StructuredChunk[] = [];
  for (const chunk of chunks) {
    const key = chunk.citationGroupId;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(chunk);
  }
  return result.sort((left, right) => compareIsoDateDesc(left.effectiveDate, right.effectiveDate));
}

const FOLLOW_UP_QUERY_RE = /^(그럼|그러면|이 경우|위 내용|위에|그 내용|그거|이거|그건|이건|같은 경우|이 상황|그 상황)/;

function isFollowUpQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  return trimmed.length <= 18 || FOLLOW_UP_QUERY_RE.test(trimmed);
}

function buildRetrievalAliases(query: string): string[] {
  const compact = query.replace(/\s+/g, '');
  const aliases: string[] = [];
  const recipientOnboardingContextTerms = ['입소', '신규', '초기', '계약초기', '시작일', '오면', '왔을때', '처음'];
  const recipientOnboardingChecklistTerms = ['해야할', '해야하는', '해야되는', '할일', '무엇', '뭐', '업무', '절차'];
  const employeeEducation = compact.includes('직원') && compact.includes('교육');
  const employeeRights = compact.includes('직원') && compact.includes('인권');
  const employeeAbuse = compact.includes('직원') && compact.includes('침해');
  const employeeRightsAbuse = employeeRights && employeeAbuse;
  const recipientContext = compact.includes('수급자') || compact.includes('보호자');
  const onboardingContext =
    recipientOnboardingContextTerms.some((term) => compact.includes(term));
  const recipientEducation =
    recipientContext &&
    onboardingContext &&
    (compact.includes('교육') || compact.includes('설명') || compact.includes('안내'));
  const recipientChecklist =
    recipientContext &&
    onboardingContext &&
    recipientOnboardingChecklistTerms.some((term) => compact.includes(term));

  const add = (...items: string[]) => {
    for (const item of items) {
      const compactItem = item.replace(/\s+/g, '');
      if (!compactItem || compact.includes(compactItem) || aliases.includes(item)) continue;
      aliases.push(item);
    }
  };

  if (employeeEducation && !employeeRightsAbuse) {
    add('직원교육');
  }

  if (employeeRights) {
    add('직원인권보호');
  }

  if (employeeRightsAbuse) {
    add('직원인권침해대응지침');
    add('급여제공지침');
  }

  if (compact.includes('인권') && compact.includes('교육') && !employeeRightsAbuse) {
    add('인권보호지침');
  }

  if (compact.includes('지표') || compact.includes('판단기준') || compact.includes('확인방법') || compact.includes('충족')) {
    add('평가 지표', '판단 기준', '확인 방법', '충족 미충족 기준');
  }

  if (recipientEducation || recipientChecklist) {
    add(
      '신규수급자',
      '수급자 입소 초기 해야 할 일',
      '신규 수급자 초기 업무',
      '급여제공 시작일부터 14일 이내',
      '수급자(보호자) 8가지 지침 설명',
      '모든 수급자(보호자)에게 8가지 지침',
      '욕창예방 낙상예방 탈수예방 배변도움 관절구축예방 치매예방 감염예방 노인인권보호',
    );
  }

  if (recipientChecklist) {
    add(
      '기피식품 파악',
      '급여제공 시작일까지 기피식품 파악',
      '급여제공계획 설명 확인서명 공단통보',
      '신규 급여제공계획 설명 확인서명 공단통보',
    );
  }

  return aliases;
}

function buildNormalizedRetrievalQuery(messages: ChatMessage[]): {
  normalizedQuery: string;
  querySources: string[];
  aliases: string[];
} {
  const userMessages = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.text.trim())
    .filter(Boolean);
  const latest = userMessages[userMessages.length - 1] ?? '';
  const previous = userMessages[userMessages.length - 2];

  if (previous && isFollowUpQuery(latest)) {
    const aliases = buildRetrievalAliases(`${previous}\n${latest}`);
    return {
      normalizedQuery: `${previous}\n후속질문: ${latest}`,
      querySources: [previous, latest, ...aliases],
      aliases,
    };
  }

  const aliases = buildRetrievalAliases(latest);
  return {
    normalizedQuery: latest,
    querySources: latest ? [latest, ...aliases] : [],
    aliases,
  };
}

function buildChunkWindowRef(
  chunk: StructuredChunk,
  relation: ChunkWindowRef['relation'],
  selectedAsEvidence: boolean,
): ChunkWindowRef {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    path: chunk.path,
    docTitle: chunk.docTitle,
    articleNo: chunk.articleNo,
    sectionPath: chunk.sectionPath,
    parentSectionId: chunk.parentSectionId,
    parentSectionTitle: chunk.parentSectionTitle,
    windowIndex: chunk.windowIndex,
    spanStart: chunk.spanStart,
    spanEnd: chunk.spanEnd,
    relation,
    selectedAsEvidence,
  };
}

interface RetrievalScopeContext {
  routeOnlyDocumentIds: Set<string>;
  primaryExpansionDocumentIds: Set<string>;
  routingDocuments: string[];
  primaryExpansionDocuments: string[];
}

interface SearchExecutionResult {
  search: SearchRun;
  scope: RetrievalScopeContext;
}

interface SearchPlanningOptions {
  additionalDocumentScoreBoosts?: Map<string, number>;
  extraAliases?: string[];
}

interface RetrievalPlanResult {
  normalizedQuery: string;
  querySources: string[];
  aliases: string[];
  questionArchetype: string;
  recommendedAnswerType: ExpertAnswerEnvelope['answerType'];
  selectedRetrievalMode: RetrievalMode;
  workflowEventIds: string[];
  workflowEventsHit: string[];
  subquestions: string[];
  plannerTrace: Array<{ step: string; detail: string }>;
  search: SearchRun;
  scope: RetrievalScopeContext;
  evidence: SearchRun['evidence'];
  workflowBriefs: WorkflowBrief[];
  knowledgeContext: string;
  basisCoverage: Record<'legal' | 'evaluation' | 'practical', number>;
}

function uniqueDocumentPaths(chunks: Array<Pick<StructuredChunk, 'documentId' | 'path'>>): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.documentId)) continue;
    seen.add(chunk.documentId);
    paths.push(chunk.path);
  }
  return paths;
}

function documentPathsFromIds(documentIds: Iterable<string>, representatives: Map<string, StructuredChunk>): string[] {
  const paths: string[] = [];
  for (const documentId of documentIds) {
    const chunk = representatives.get(documentId);
    if (!chunk) continue;
    paths.push(chunk.path);
  }
  return paths;
}

function uniqueNonEmptyLines(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function mergeDocumentScoreBoostMaps(...maps: Array<Map<string, number>>): Map<string, number> {
  const merged = new Map<string, number>();
  for (const map of maps) {
    for (const [documentId, score] of map.entries()) {
      merged.set(documentId, (merged.get(documentId) ?? 0) + score);
    }
  }
  return merged;
}

function buildDocumentRepresentativeMap(chunks: StructuredChunk[]): Map<string, StructuredChunk> {
  const representatives = new Map<string, StructuredChunk>();
  for (const chunk of chunks) {
    if (!representatives.has(chunk.documentId)) {
      representatives.set(chunk.documentId, chunk);
    }
  }
  return representatives;
}

function buildTitleToDocumentIdsMap(chunks: StructuredChunk[]): Map<string, Set<string>> {
  const representatives = buildDocumentRepresentativeMap(chunks);
  const lookup = new Map<string, Set<string>>();

  const add = (title: string, documentId: string) => {
    const key = normalizeDocumentTitle(title);
    if (!key) return;
    const ids = lookup.get(key) ?? new Set<string>();
    ids.add(documentId);
    lookup.set(key, ids);
  };

  for (const chunk of representatives.values()) {
    add(chunk.docTitle, chunk.documentId);
    add(chunk.fileName, chunk.documentId);
    add(chunk.path, chunk.documentId);
  }

  return lookup;
}

function uniqueDocumentCandidates(candidates: SearchCandidate[], limit = 4): SearchCandidate[] {
  const seen = new Set<string>();
  const documents: SearchCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.documentId)) continue;
    seen.add(candidate.documentId);
    documents.push(candidate);
    if (documents.length >= limit) break;
  }

  return documents;
}

function isRecipientOnboardingQuery(query: string): boolean {
  const compact = query.replace(/\s+/g, '');
  const recipientOnboardingContextTerms = ['입소', '신규', '초기', '계약초기', '시작일', '오면', '왔을때', '처음'];
  const recipientOnboardingChecklistTerms = ['해야할', '해야하는', '해야되는', '할일', '무엇', '뭐', '교육', '설명', '안내', '업무', '절차'];
  const recipientContext = compact.includes('수급자') || compact.includes('보호자');
  const onboardingContext = recipientOnboardingContextTerms.some((term) => compact.includes(term));
  const checklistContext = recipientOnboardingChecklistTerms.some((term) => compact.includes(term));

  return recipientContext && onboardingContext && checklistContext;
}

function buildOperationalDocumentBoosts(chunks: StructuredChunk[], query: string): Map<string, number> {
  if (!isRecipientOnboardingQuery(query)) {
    return new Map<string, number>();
  }

  const signals: Array<{ term: string; weight: number }> = [
    { term: '신규수급자', weight: 18 },
    { term: '급여제공시작일부터14일이내', weight: 18 },
    { term: '8가지지침', weight: 18 },
    { term: '욕창예방', weight: 6 },
    { term: '낙상예방', weight: 6 },
    { term: '탈수예방', weight: 6 },
    { term: '배변도움', weight: 6 },
    { term: '관절구축예방', weight: 6 },
    { term: '치매예방', weight: 6 },
    { term: '감염예방', weight: 6 },
    { term: '노인인권보호', weight: 6 },
    { term: '기피식품', weight: 8 },
    { term: '급여제공계획', weight: 8 },
    { term: '공단통보', weight: 8 },
  ];
  const scoreByDocument = new Map<string, number>();
  const matchedSignalsByDocument = new Map<string, Set<string>>();

  for (const chunk of chunks) {
    if (chunk.sourceRole === 'routing_summary') continue;

    const compactSearchText = chunk.searchText.replace(/\s+/g, '');
    const compactTitle = chunk.docTitle.replace(/\s+/g, '');
    const titleBonus =
      compactTitle.includes('평가매뉴얼') || compactTitle.includes('업무의이해')
        ? 8
        : 0;
    const matchedSignals = matchedSignalsByDocument.get(chunk.documentId) ?? new Set<string>();

    for (const signal of signals) {
      if (compactSearchText.includes(signal.term) || compactTitle.includes(signal.term)) {
        matchedSignals.add(signal.term);
      }
    }

    matchedSignalsByDocument.set(chunk.documentId, matchedSignals);
    if (titleBonus > 0) {
      scoreByDocument.set(chunk.documentId, Math.max(scoreByDocument.get(chunk.documentId) ?? 0, titleBonus));
    }
  }

  const rankedDocuments = Array.from(matchedSignalsByDocument.entries())
    .map(([documentId, matchedSignals]) => ({
      documentId,
      score:
        (scoreByDocument.get(documentId) ?? 0) +
        Array.from(matchedSignals).reduce((sum, signal) => sum + (signals.find((item) => item.term === signal)?.weight ?? 0), 0),
    }))
    .filter((entry) => entry.score >= 18)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  return new Map(rankedDocuments.map((entry) => [entry.documentId, entry.score]));
}

function resolveRoutingExpansionDocumentIds(
  routingCandidates: SearchCandidate[],
  allChunks: StructuredChunk[],
): Set<string> {
  const titleMap = buildTitleToDocumentIdsMap(allChunks);
  const representatives = buildDocumentRepresentativeMap(allChunks);
  const expandedIds = new Set<string>();

  for (const candidate of routingCandidates) {
    for (const linkedTitle of candidate.linkedDocumentTitles) {
      const ids = titleMap.get(normalizeDocumentTitle(linkedTitle));
      if (!ids) continue;

      for (const documentId of ids) {
        const doc = representatives.get(documentId);
        if (!doc || doc.sourceRole === 'routing_summary') continue;
        expandedIds.add(documentId);
      }
    }
  }

  return expandedIds;
}

const RECIPIENT_ONBOARDING_SUPPORT_ANCHORS = [
  '신규수급자',
  '8가지',
  '욕창예방',
  '낙상예방',
  '탈수예방',
  '배변도움',
  '관절구축예방',
  '치매예방',
  '감염예방',
  '노인인권보호',
  '기피식품',
  '급여제공계획',
  '확인서명',
  '공단통보',
] as const;

function hasRecipientOnboardingSupportAnchor(candidate: SearchCandidate): boolean {
  const compactText = [candidate.docTitle, candidate.parentSectionTitle, candidate.searchText]
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, '');
  return RECIPIENT_ONBOARDING_SUPPORT_ANCHORS.some((anchor) => compactText.includes(anchor));
}

function selectDirectSupportReferenceIds(search: SearchRun): Set<string> {
  const selected = new Set<string>();
  const focusTerms = search.focusTerms ?? deriveFocusTerms(search.query);
  const recipientOnboardingQuery = isRecipientOnboardingQuery(search.query);

  for (const candidate of search.fusedCandidates) {
    if (candidate.sourceRole !== 'support_reference' || candidate.mode !== 'integrated') continue;

    const focusMatches = getCandidateFocusMatches(candidate, focusTerms);
    if (recipientOnboardingQuery && !hasRecipientOnboardingSupportAnchor(candidate)) continue;

    const hasConcreteSignal = focusMatches.length > 0 || candidate.exactScore >= 18 || candidate.lexicalScore > 0.12;
    const strongEnough = candidate.rerankScore >= 22 || focusMatches.length > 0;
    if (!hasConcreteSignal || !strongEnough) continue;

    selected.add(candidate.documentId);
    if (selected.size >= 4) break;
  }

  return selected;
}

function pruneIrrelevantSupportEvidence(search: SearchRun): SearchRun {
  const focusTerms = search.focusTerms ?? deriveFocusTerms(search.query);
  if (focusTerms.length === 0) return search;
  const queryRequestsEvaluationReference = /(q\s*&\s*a|q&a|qa|질문|답변|문의|사례|비교|후기)/i.test(search.query);
  const recipientOnboardingQuery = isRecipientOnboardingQuery(search.query);

  const hasPriorityEvidence = search.evidence.some(
    (candidate) =>
      candidate.sourceRole === 'primary_evaluation' ||
      ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType),
  );
  if (!hasPriorityEvidence) return search;

  const filteredEvidence = search.evidence.filter((candidate) => {
    if (candidate.sourceRole !== 'support_reference') return true;
    if (candidate.mode === 'evaluation' && !queryRequestsEvaluationReference) return false;

    const focusMatches = getCandidateFocusMatches(candidate, focusTerms);
    if (recipientOnboardingQuery && !hasRecipientOnboardingSupportAnchor(candidate)) {
      return false;
    }

    const hasNonGenericFocusMatch = focusMatches.some((term) => !isGenericQueryTerm(term));
    return hasNonGenericFocusMatch;
  });

  return filteredEvidence.length > 0 ? { ...search, evidence: filteredEvidence } : search;
}

function injectEvidenceCandidate(search: SearchRun, candidate: SearchCandidate | null): SearchRun {
  if (!candidate || search.evidence.some((item) => item.documentId === candidate.documentId)) {
    return search;
  }

  return applyGroundingGate({
    ...search,
    fusedCandidates: [candidate, ...search.fusedCandidates.filter((item) => item.id !== candidate.id)]
      .sort((left, right) => right.rerankScore - left.rerankScore)
      .slice(0, Math.max(search.fusedCandidates.length, 24)),
    evidence: [candidate, ...search.evidence.filter((item) => item.id !== candidate.id)]
      .sort((left, right) => right.rerankScore - left.rerankScore)
      .slice(0, Math.max(search.evidence.length, 12)),
  });
}

function collectNeighborWindows(allChunks: StructuredChunk[], evidence: StructuredChunk[]): ChunkWindowRef[] {
  const byParentSection = new Map<string, StructuredChunk[]>();
  for (const chunk of allChunks) {
    const key = `${chunk.documentId}:${chunk.parentSectionId}`;
    const list = byParentSection.get(key) ?? [];
    list.push(chunk);
    byParentSection.set(key, list);
  }

  const refs = new Map<string, ChunkWindowRef>();
  for (const chunk of evidence) {
    const key = `${chunk.documentId}:${chunk.parentSectionId}`;
    const sectionChunks = (byParentSection.get(key) ?? []).slice().sort((left, right) => left.windowIndex - right.windowIndex);
    const currentIndex = sectionChunks.findIndex((item) => item.id === chunk.id);
    if (currentIndex < 0) continue;

    const current = sectionChunks[currentIndex];
    refs.set(`${current.id}:current`, buildChunkWindowRef(current, 'current', true));

    const previous = sectionChunks[currentIndex - 1];
    if (previous) {
      refs.set(`${previous.id}:previous`, buildChunkWindowRef(previous, 'previous', false));
    }

    const next = sectionChunks[currentIndex + 1];
    if (next) {
      refs.set(`${next.id}:next`, buildChunkWindowRef(next, 'next', false));
    }
  }

  return Array.from(refs.values()).sort((left, right) => {
    const pathDiff = left.path.localeCompare(right.path, 'ko');
    if (pathDiff !== 0) return pathDiff;
    if (left.parentSectionId !== right.parentSectionId) return left.parentSectionId.localeCompare(right.parentSectionId);
    return left.windowIndex - right.windowIndex;
  });
}

function buildCandidateDiagnostics(
  search: SearchRun,
  neighborWindows: ChunkWindowRef[],
  scope: RetrievalScopeContext,
): CandidateDiagnostic[] {
  const focusTerms = search.focusTerms ?? deriveFocusTerms(search.query);
  const evidenceIds = new Set(search.evidence.map((item) => item.id));
  const selectedClusters = new Set(search.evidence.map((item) => item.citationGroupId));
  const selectedDocuments = new Set(search.evidence.map((item) => item.documentId));
  const neighborWindowIds = new Set(neighborWindows.map((item) => item.id));

  return search.fusedCandidates.map((candidate) => {
    const focusTermMatches = getCandidateFocusMatches(candidate, focusTerms);
    const concreteMatchedTerms = candidate.matchedTerms.filter((term) => !term.includes('-'));
    const matchedOnlyGenericTerms =
      focusTermMatches.length === 0 &&
      (concreteMatchedTerms.length === 0 || concreteMatchedTerms.every((term) => isGenericQueryTerm(term)));
    const rejectionReasons: string[] = [];
    const selectedAsEvidence = evidenceIds.has(candidate.id);
    const routeOnly = scope.routeOnlyDocumentIds.has(candidate.documentId);
    const expandedFromRouting = scope.primaryExpansionDocumentIds.has(candidate.documentId);
    const primaryExpansionHit = expandedFromRouting && selectedAsEvidence;

    if (!selectedAsEvidence) {
      if (routeOnly) {
        rejectionReasons.push('route-only-document');
      }
      if (matchedOnlyGenericTerms) {
        rejectionReasons.push('generic-only-match');
      }
      if (selectedDocuments.has(candidate.documentId) && !selectedClusters.has(candidate.citationGroupId)) {
        rejectionReasons.push('document-cluster-limit');
      }
      if (selectedClusters.has(candidate.citationGroupId) && !neighborWindowIds.has(candidate.id)) {
        rejectionReasons.push('non-adjacent-window-in-selected-cluster');
      }
      if (candidate.rerankScore < (search.evidence.at(-1)?.rerankScore ?? Infinity)) {
        rejectionReasons.push('lower-rerank-score-than-selected-evidence');
      }
      if (candidate.vectorScore <= 0) {
        rejectionReasons.push('no-vector-signal');
      }
    }

    return {
      id: candidate.id,
      path: candidate.path,
      docTitle: candidate.docTitle,
      sourceRole: candidate.sourceRole,
      rerankScore: candidate.rerankScore,
      matchedTerms: candidate.matchedTerms,
      focusTermMatches,
      selectedAsEvidence,
      routeOnly,
      expandedFromRouting,
      primaryExpansionHit,
      matchedOnlyGenericTerms,
      rejectionReasons,
      citationGroupId: candidate.citationGroupId,
      parentSectionId: candidate.parentSectionId,
      windowIndex: candidate.windowIndex,
    };
  });
}

function hasExactArticleGrounding(evidence: SearchRun['evidence']): boolean {
  return evidence.some(
    (candidate) =>
      candidate.exactScore >= 40 ||
      Boolean(candidate.articleNo && candidate.matchedTerms.includes(candidate.articleNo)),
  );
}

function hasSequentialDocumentGrounding(evidence: SearchRun['evidence']): boolean {
  const chunkIndexesByDocument = new Map<string, number[]>();
  for (const candidate of evidence) {
    const key = `${candidate.documentId}:${candidate.parentSectionId}`;
    const list = chunkIndexesByDocument.get(key) ?? [];
    list.push(candidate.windowIndex);
    chunkIndexesByDocument.set(key, list);
  }

  for (const indexes of chunkIndexesByDocument.values()) {
    const sorted = indexes.slice().sort((left, right) => left - right);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index] - sorted[index - 1] === 1) {
        return true;
      }
    }
  }

  return false;
}

function hasCrossDocumentGrounding(evidence: SearchRun['evidence'], focusTerms: string[]): boolean {
  const supportedDocuments = new Set(
    evidence
      .filter((candidate) => {
        const focusMatches = getCandidateFocusMatches(candidate, focusTerms);
        if (focusMatches.length > 0) return true;
        if (candidate.exactScore >= 25) return true;
        return candidate.lexicalScore > 0;
      })
      .map((candidate) => candidate.documentId),
  );
  return supportedDocuments.size >= 2;
}

function applyGroundingGate(search: SearchRun): SearchRun {
  const focusTerms = search.focusTerms ?? deriveFocusTerms(search.query);
  const hasGrounding =
    hasExactArticleGrounding(search.evidence) ||
    hasSequentialDocumentGrounding(search.evidence) ||
    hasCrossDocumentGrounding(search.evidence, focusTerms);

  const mismatchSignals = [...(search.mismatchSignals ?? [])];
  if (!hasGrounding) {
    mismatchSignals.push('grounding-gate-failed');
  }

  return {
    ...search,
    confidence: mismatchSignals.length > 0 ? 'low' : search.confidence,
    mismatchSignals,
    groundingGatePassed: hasGrounding,
  };
}

function buildRetrievalStageTrace(
  search: SearchRun,
  normalizedQuery: string,
  querySources: string[],
  scope: RetrievalScopeContext,
): SearchRun['stageTrace'] {
  return [
    {
      stage: 'query_normalization',
      inputCount: querySources.length > 0 ? querySources.length : 1,
      outputCount: normalizedQuery.trim() ? 1 : 0,
      notes: querySources.length > 1 ? ['follow-up-query-combined'] : ['latest-user-query'],
    },
    {
      stage: 'lexical_candidates',
      inputCount: 1,
      outputCount: search.lexicalCandidates.length,
      notes: search.lexicalCandidates.length > 0 ? [`top=${search.lexicalCandidates[0].docTitle}`] : ['no-lexical-match'],
    },
    {
      stage: 'vector_candidates',
      inputCount: 1,
      outputCount: search.vectorCandidates.length,
      notes: search.vectorCandidates.length > 0 ? [`top=${search.vectorCandidates[0].docTitle}`] : ['vector-unavailable-or-empty'],
    },
    {
      stage: 'fusion',
      inputCount: search.exactCandidates.length + search.lexicalCandidates.length + search.vectorCandidates.length,
      outputCount: search.fusedCandidates.length,
      notes: [
        `exact=${search.exactCandidates.length}`,
        `lexical=${search.lexicalCandidates.length}`,
        `vector=${search.vectorCandidates.length}`,
        ...(scope.routingDocuments.length > 0 ? [`routing=${scope.routingDocuments.length}`] : []),
        ...(scope.primaryExpansionDocuments.length > 0 ? [`expanded=${scope.primaryExpansionDocuments.length}`] : []),
      ],
    },
    {
      stage: 'document_diversification',
      inputCount: search.fusedCandidates.length,
      outputCount: search.evidence.length,
      notes: [
        `documents=${new Set(search.evidence.map((item) => item.documentId)).size}`,
        `clusters=${new Set(search.evidence.map((item) => item.citationGroupId)).size}`,
      ],
    },
    {
      stage: 'answer_evidence_gate',
      inputCount: search.evidence.length,
      outputCount: search.groundingGatePassed ? search.evidence.length : 0,
      notes: search.mismatchSignals && search.mismatchSignals.length > 0 ? search.mismatchSignals : [search.groundingGatePassed ? 'grounding-passed' : 'grounding-failed'],
    },
  ];
}

function buildRetrievalDiagnostics(
  search: SearchRun,
  normalizedQuery: string,
  querySources: string[],
  allChunks: StructuredChunk[],
  retrievalReadiness: RetrievalReadiness,
  scope: RetrievalScopeContext,
  extras?: {
    selectedRetrievalMode?: RetrievalMode;
    workflowEventsHit?: string[];
    subquestions?: string[];
    basisCoverage?: Record<'legal' | 'evaluation' | 'practical', number>;
    plannerTrace?: Array<{ step: string; detail: string }>;
  },
): RetrievalDiagnostics {
  const neighborWindows = collectNeighborWindows(allChunks, search.evidence);
  const candidateDiagnostics = buildCandidateDiagnostics(search, neighborWindows, scope);
  return {
    normalizedQuery,
    querySources,
    matchedDocumentPaths: Array.from(new Set(search.evidence.map((item) => item.path))),
    candidateDiagnostics,
    focusTerms: search.focusTerms ?? deriveFocusTerms(search.query),
    mismatchSignals: search.mismatchSignals ?? [],
    groundingGatePassed: search.groundingGatePassed ?? false,
    stageTrace: buildRetrievalStageTrace(search, normalizedQuery, querySources, scope),
    retrievalReadiness,
    neighborWindows,
    rejectionReasons: candidateDiagnostics
      .filter((candidate) => candidate.rejectionReasons.length > 0)
      .map((candidate) => ({
        candidateId: candidate.id,
        reasons: candidate.rejectionReasons,
      })),
    routingDocuments: scope.routingDocuments,
    primaryExpansionDocuments: scope.primaryExpansionDocuments,
    finalEvidenceDocuments: uniqueDocumentPaths(search.evidence),
    selectedRetrievalMode: extras?.selectedRetrievalMode ?? 'local',
    workflowEventsHit: extras?.workflowEventsHit ?? [],
    subquestions: extras?.subquestions ?? [],
    basisCoverage: extras?.basisCoverage ?? { legal: 0, evaluation: 0, practical: 0 },
    plannerTrace: extras?.plannerTrace ?? [],
  };
}

function deriveKeyIssueDate(answer: GroundedAnswer, citations: StructuredChunk[]): string {
  const provided = answer.keyIssueDate?.replace(/\s+/g, ' ').trim();
  if (provided && /20\d{2}(?:[-./]\d{1,2}|년\s*\d{1,2}\s*월?)/.test(provided) && !/^확인 필요/.test(provided)) {
    return provided;
  }

  const collectCitationDateLabels = (items: StructuredChunk[]): string[] =>
    Array.from(
      new Set(
        items
          .flatMap((citation) => {
            const compactDate = citation.fileName.match(/\((20\d{2})(\d{2})(\d{2})\)/);
            if (compactDate) {
              return [`${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`];
            }

            const yearMonthDate = citation.fileName.match(/\((20\d{2})\.(\d{1,2})\.?\)/);
            if (yearMonthDate) {
              return [`${yearMonthDate[1]}년 ${Number(yearMonthDate[2])}월`];
            }

            return [citation.effectiveDate, citation.publishedDate].filter(
              (value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)),
            );
          })
          .filter(Boolean),
      ),
    ).sort(compareIsoDateDesc);

  const primaryCitationDates = collectCitationDateLabels(citations.filter((citation) => citation.sourceRole === 'primary_evaluation'));
  if (primaryCitationDates.length === 1) {
    return primaryCitationDates[0];
  }
  if (primaryCitationDates.length > 1) {
    return `확인 필요 (${primaryCitationDates.join(', ')})`;
  }

  const citationDates = collectCitationDateLabels(citations);
  if (citationDates.length === 1) {
    return citationDates[0];
  }
  if (citationDates.length > 1) {
    return `확인 필요 (${citationDates.join(', ')})`;
  }

  return provided && !/^확인 필요/.test(provided) ? provided : '확인 필요';
}

function stripInternalCitationArtifacts(text: string | undefined): string {
  if (!text) return '';

  return text
    .replace(/\((?:\s*(?:Evidence|evidence)\s*[\d,\s]+)\)/g, '')
    .replace(/\b(?:Evidence|evidence)\s*[\d,\s]+\b/g, '')
    .replace(/\bwindow\s+\d+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .trim();
}

function sanitizeAnswerList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((item) => stripInternalCitationArtifacts(item))
    .filter(Boolean);
}

function buildEvidenceSnippet(chunk: StructuredChunk): string {
  const cleanedLines = chunk.text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 8);

  const uniqueLines = Array.from(new Set(cleanedLines));
  const prioritized =
    uniqueLines.find((line) => /(연\s*1회|7일 이내|급여제공지침|인권침해 대응지침|성희롱|성폭력|폭언|폭행|대응방법|예방|실시)/.test(line)) ??
    uniqueLines[0] ??
    '';

  return prioritized.length > 180 ? `${prioritized.slice(0, 177).trim()}…` : prioritized;
}

function needsEvidenceFallback(values: string[]): boolean {
  if (values.length < 2) return true;
  return values.every(
    (value) =>
      value.length < 90 &&
      !/(제\d+조|연\s*1회|7일|급여제공지침|성희롱|성폭력|폭언|폭행|대응|예방|의무)/.test(value),
  );
}

function mergeEvidenceLines(answerLines: string[], citations: StructuredChunk[]): string[] {
  const fallbackLines = dedupeCitations(citations)
    .slice(0, 3)
    .map((chunk) => `${buildPreciseCitationLabel(chunk)}: ${buildEvidenceSnippet(chunk)}`)
    .filter((line) => !line.endsWith(':'));

  const preferred = needsEvidenceFallback(answerLines) ? [...fallbackLines, ...answerLines] : [...answerLines, ...fallbackLines];
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const line of preferred) {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
    if (merged.length >= 4) break;
  }

  return merged.length > 0 ? merged : ['직접 근거를 확인할 수 없어 결론을 제한했습니다.'];
}

function mapConfidence(value: string | undefined): ConfidenceLevel {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function mapEvidenceState(value: string | undefined): GroundedAnswer['evidenceState'] {
  return value === 'confirmed' || value === 'partial' || value === 'conflict' || value === 'not_enough'
    ? value
    : 'not_enough';
}

function normalizeAnswerShape(candidate: Partial<GroundedAnswer>): GroundedAnswer {
  return {
    evidenceState: mapEvidenceState(candidate.evidenceState),
    confidence: mapConfidence(candidate.confidence),
    keyIssueDate: candidate.keyIssueDate,
    conclusion: stripInternalCitationArtifacts(candidate.conclusion?.trim()) || '검색된 근거만으로 결론을 확정하기 어렵습니다.',
    directEvidence: sanitizeAnswerList(candidate.directEvidence),
    practicalGuidance: sanitizeAnswerList(candidate.practicalGuidance),
    caveats: sanitizeAnswerList(candidate.caveats),
    citationEvidenceIds: Array.isArray(candidate.citationEvidenceIds) ? candidate.citationEvidenceIds.map((item) => item.trim()).filter(Boolean) : [],
    followUpQuestion: stripInternalCitationArtifacts(candidate.followUpQuestion?.trim()) || undefined,
  };
}

function createAbstainAnswer(search: SearchRun): GroundedAnswer {
  const leading = search.evidence.slice(0, 2);
  return {
    evidenceState: search.confidence === 'low' ? 'not_enough' : 'partial',
    confidence: 'low',
    keyIssueDate: leading.find((item) => item.effectiveDate)?.effectiveDate,
    conclusion: '검색된 근거만으로 질문에 직접 대응하는 조문이나 문답을 확정할 수 없습니다.',
    directEvidence: leading.length > 0 ? leading.map((item) => `${item.docTitle}${item.articleNo ? ` ${item.articleNo}` : ''}에서 관련 단서를 확인했습니다.`) : [],
    practicalGuidance: ['질문의 기관 유형, 급여 유형, 적용 시점을 더 구체화한 뒤 다시 확인하는 편이 안전합니다.'],
    caveats: ['현재 근거만으로는 단정 답변을 제공하지 않습니다.'],
    citationEvidenceIds: leading.map((item) => item.id),
    followUpQuestion: '적용 기관 유형이나 확인하려는 기준 시점을 알려주시면 근거를 다시 좁혀보겠습니다.',
  };
}

function formatSection(title: string, body: string | string[]): string {
  const content = Array.isArray(body) ? body.filter(Boolean).map((line) => `- ${line}`).join('\n') : body;
  return `[${title}]\n${content || '- 없음'}`;
}

function formatMarkdownAnswer(answer: GroundedAnswer, citations: StructuredChunk[]): string {
  const keyIssueDate = deriveKeyIssueDate(answer, citations);
  const evidenceState = formatEvidenceStateLabel(answer.evidenceState);
  const directEvidence = mergeEvidenceLines(answer.directEvidence, citations);
  const sourceLines = dedupeCitations(citations).map(chunkToCitationLine);

  return [
    formatSection('답변 가능 상태', evidenceState),
    formatSection('기준 시점', keyIssueDate),
    formatSection('결론', answer.conclusion),
    formatSection('확정 근거', directEvidence),
    formatSection('실무 해석/운영 참고', answer.practicalGuidance.length > 0 ? answer.practicalGuidance : ['실무 참고 사항이 없으면 출처 확인을 우선합니다.']),
    formatSection(
      '예외·주의 및 추가 확인사항',
      [
        ...(answer.caveats.length > 0 ? answer.caveats : ['적용 기관 유형, 시점, 문서 버전에 따라 판단이 달라질 수 있습니다.']),
        ...(answer.followUpQuestion ? [answer.followUpQuestion] : []),
      ],
    ),
    formatSection('출처', sourceLines.length > 0 ? sourceLines : ['근거 청크를 특정하지 못했습니다.']),
  ].join('\n\n');
}

async function embedQuery(ai: GoogleGenAI, query: string): Promise<number[] | null> {
  if (!query.trim()) return null;
  if (shouldSkipEmbeddingWork('query embedding')) return null;
  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: query,
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });
    const values = prepareEmbedding(response.embeddings[0]?.values);
    return values.length > 0 ? values : null;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markEmbeddingQuotaExceeded(error, 'query embedding');
      return null;
    }
    console.warn(`[embedding] query embedding failed: ${describeError(error)}`);
    return null;
  }
}

async function embedChunks(ai: GoogleGenAI, chunks: StructuredChunk[]): Promise<number> {
  const missing = chunks.filter((chunk) => !chunk.embedding || chunk.embedding.length === 0);
  if (missing.length === 0) return 0;
  if (shouldSkipEmbeddingWork('chunk embeddings')) return 0;

  const target = missing.slice(0, EMBEDDING_MAX_CHUNKS_PER_PASS);
  let embeddedCount = 0;

  for (let index = 0; index < target.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = target.slice(index, index + EMBEDDING_BATCH_SIZE);
    try {
      const responses = await Promise.all(
        batch.map((chunk) =>
          ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: chunk.searchText,
            config: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
            },
          }),
        ),
      );
      responses.forEach((response, batchIndex) => {
        batch[batchIndex].embedding = prepareEmbedding(response.embeddings[0]?.values);
      });
      embeddedCount += batch.length;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        markEmbeddingQuotaExceeded(error, `batch ${index}~${index + batch.length}`);
        break;
      }
      console.warn(`[embedding] batch ${index}~${index + batch.length} failed: ${describeError(error)}`);
    }
  }

  if (missing.length > target.length) {
    console.info(`[embedding] deferred ${missing.length - target.length} remaining chunks for later passes.`);
  }

  return embeddedCount;
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
      article_no text,
      matched_labels jsonb not null default '[]'::jsonb,
      linked_document_titles jsonb not null default '[]'::jsonb,
      chunk_hash text not null,
      parent_section_id text not null,
      parent_section_title text not null,
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
];

async function ensurePostgresSchema(client: PoolClient): Promise<void> {
  for (const statement of POSTGRES_SCHEMA_STATEMENTS) {
    await client.query(statement);
  }
}

class MemoryRagStore implements RagStore {
  private readonly projectRoot: string;
  private readonly embeddingCachePath: string;
  private knowledgeStats: { name: string; size: number; updatedAt: Date }[] = [];
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

  search(
    query: string,
    mode: PromptMode,
    queryEmbedding: number[] | null,
    queryAliases: string[] = [],
    options?: SearchOptions,
  ): SearchRun {
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

class PostgresRagStore implements RagStore {
  private readonly pool: Pool;
  private chunks: StructuredChunk[] = [];
  private index: RagCorpusIndex = buildRagCorpusIndex([]);
  private compiledPages: CompiledPage[] = [];
  private manifestEntries: IndexManifestEntry[] = [];
  private knowledgeStats: { name: string; size: number; updatedAt: Date }[] = [];
  private indexGeneratedAt: string | undefined;
  private lastEmbeddingAttemptAt = 0;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  private async persistEmbeddingUpdates(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      for (const chunk of this.chunks) {
        await client.query(
          'update chunks set embedding = $2 where id = $1',
          [
            chunk.id,
            Array.isArray(chunk.embedding) && chunk.embedding.length === EMBEDDING_DIMENSIONS
              ? `[${chunk.embedding.join(',')}]`
              : null,
          ],
        );
      }

      for (const entry of this.manifestEntries) {
        await client.query(
          'update documents set chunk_count = $2, embedding_count = $3 where id = $1',
          [entry.documentId, entry.chunkCount, entry.embeddingCount],
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
        article_no,
        matched_labels,
        linked_document_titles,
        chunk_hash,
        parent_section_id,
        parent_section_title,
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

  search(
    query: string,
    mode: PromptMode,
    queryEmbedding: number[] | null,
    queryAliases: string[] = [],
    options?: SearchOptions,
  ): SearchRun {
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

function mergeCorpora(...corpora: KnowledgeFile[][]): KnowledgeFile[] {
  const filesByPath = new Map<string, KnowledgeFile>();
  for (const corpus of corpora) {
    for (const file of corpus) {
      filesByPath.set(file.path, file);
    }
  }
  return Array.from(filesByPath.values());
}

function collectKnowledgeStats(projectRoot: string): Array<{ name: string; size: number; updatedAt: Date }> {
  const knowledgeRoot = path.join(projectRoot, 'knowledge');
  if (!fs.existsSync(knowledgeRoot)) return [];

  const results: Array<{ name: string; size: number; updatedAt: Date }> = [];

  const visit = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      if (!entry.isFile() || !/\.(md|txt)$/i.test(entry.name)) continue;
      const stat = fs.statSync(fullPath);
      results.push({
        name: path.relative(knowledgeRoot, fullPath).replace(/\\/g, '/'),
        size: stat.size,
        updatedAt: stat.mtime,
      });
    }
  };

  visit(knowledgeRoot);
  return results.sort((left, right) => left.name.localeCompare(right.name, 'ko'));
}

function buildGroundedAnswerSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['evidenceState', 'confidence', 'conclusion', 'directEvidence', 'practicalGuidance', 'caveats', 'citationEvidenceIds'],
    properties: {
      evidenceState: {
        type: 'string',
        enum: ['confirmed', 'partial', 'conflict', 'not_enough'],
        description: '검색 근거 기준 최종 상태. confirmed=확정, partial=부분확정, conflict=충돌, not_enough=확인 불가.',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: '근거 밀도에 대한 내부 자신감.',
      },
      keyIssueDate: {
        type: 'string',
        description: '확인 가능한 기준 시점. 예: "2026년 1월 (평가매뉴얼 신규 기준 적용 시점)", "2026-01-20 시행". 정말 불가할 때만 "확인 필요".',
      },
      conclusion: {
        type: 'string',
        description: '2~4문장 요약. 질문이 의무/존재 여부를 묻는 경우 첫 문장에서 있다, 없다, 없지만 별도로 필요하다를 분명히 쓴다.',
      },
      directEvidence: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '각 항목은 문서명/항목 + 핵심 문구 + 그 문구가 결론에 주는 의미를 한 문장으로 설명한다. 문서명만 나열하지 않는다.',
      },
      practicalGuidance: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '평가 대응이나 운영 참고만 적고, 법적 결론과 섞지 않는다.',
      },
      caveats: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '예외, 적용 조건, 추가 확인 필요사항만 적는다.',
      },
      citationEvidenceIds: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '반드시 제공된 evidence id만 넣는다.',
      },
      followUpQuestion: {
        type: 'string',
        description: '근거가 부족할 때만 짧고 구체적으로 쓴다.',
      },
    },
  };
}

function buildCompiledPageContext(pages: CompiledPage[]): string {
  if (pages.length === 0) return '';
  return pages
    .map(
      (page) =>
        [
          `CompiledPage: ${page.title}`,
          `Type: ${page.pageType}`,
          `Summary: ${page.summary}`,
          `Backlinks: ${page.backlinks.join(', ')}`,
        ].join('\n'),
    )
    .join('\n\n');
}

function resolveGenerationTemperature(model: string): number {
  void model;
  return 0.1;
}

function constrainEvidence(search: SearchRun): SearchRun['evidence'] {
  const maxContextChars = MAX_CONTEXT_CHARS_BY_MODE[search.mode];
  let totalChars = 0;
  const constrained: SearchRun['evidence'] = [];
  for (const evidence of search.evidence) {
    if (totalChars + evidence.text.length > maxContextChars) break;
    totalChars += evidence.text.length;
    constrained.push(evidence);
  }
  return constrained;
}

function expandEvidenceWithNeighbors(evidence: SearchRun['evidence'], allChunks: StructuredChunk[]): SearchRun['evidence'] {
  const byParentSection = new Map<string, StructuredChunk[]>();
  for (const chunk of allChunks) {
    const key = `${chunk.documentId}:${chunk.parentSectionId}`;
    const list = byParentSection.get(key) ?? [];
    list.push(chunk);
    byParentSection.set(key, list);
  }

  const expanded = new Map<string, SearchRun['evidence'][number]>();
  for (const candidate of evidence) {
    expanded.set(candidate.id, candidate);
    const key = `${candidate.documentId}:${candidate.parentSectionId}`;
    const siblings = (byParentSection.get(key) ?? []).slice().sort((left, right) => left.windowIndex - right.windowIndex);
    const index = siblings.findIndex((item) => item.id === candidate.id);
    for (const neighbor of [siblings[index - 1], siblings[index + 1]]) {
      if (!neighbor) continue;
      expanded.set(neighbor.id, {
        ...neighbor,
        exactScore: candidate.exactScore,
        lexicalScore: candidate.lexicalScore,
        vectorScore: candidate.vectorScore,
        fusedScore: candidate.fusedScore,
        rerankScore: candidate.rerankScore - 0.5,
        matchedTerms: candidate.matchedTerms,
      });
    }
  }

  return Array.from(expanded.values()).sort((left, right) => {
    const rerankDiff = right.rerankScore - left.rerankScore;
    if (rerankDiff !== 0) return rerankDiff;
    if (left.documentId !== right.documentId) return left.documentId.localeCompare(right.documentId);
    if (left.parentSectionId !== right.parentSectionId) return left.parentSectionId.localeCompare(right.parentSectionId);
    return left.windowIndex - right.windowIndex;
  });
}

async function generateGroundedAnswer(params: {
  ai: GoogleGenAI;
  model: string;
  contents: Array<{ role: ChatMessage['role']; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  evidence: StructuredChunk[];
}): Promise<GroundedAnswer> {
  const evidenceIds = new Set(params.evidence.map((item) => item.id));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const extraReminder =
      attempt === 0
        ? ''
        : '\n\n재시도 규칙: citationEvidenceIds에는 제공된 evidence id만 사용하고, 확신이 낮으면 not_enough로 답하세요.';

    const response = await params.ai.models.generateContent({
      model: params.model,
      contents: params.contents,
      config: {
        systemInstruction: `${params.systemInstruction}${extraReminder}`,
        temperature: resolveGenerationTemperature(params.model),
        responseMimeType: 'application/json',
        responseJsonSchema: buildGroundedAnswerSchema(),
      },
    });

    let parsed: GroundedAnswer;
    try {
      parsed = normalizeAnswerShape(JSON.parse(response.text || '{}') as Partial<GroundedAnswer>);
    } catch {
      continue;
    }
    const validCitationIds = parsed.citationEvidenceIds.filter((item) => evidenceIds.has(item));
    if (validCitationIds.length > 0 || parsed.evidenceState === 'not_enough') {
      return {
        ...parsed,
        citationEvidenceIds: validCitationIds.length > 0 ? validCitationIds : params.evidence.slice(0, 2).map((item) => item.id),
      };
    }
  }

  return createAbstainAnswer({
    query: '',
    mode: 'integrated',
    intent: 'integrated',
    confidence: 'low',
    exactCandidates: [],
    lexicalCandidates: [],
    vectorCandidates: [],
    fusedCandidates: [],
    evidence: params.evidence.map((item) => ({
      ...item,
      exactScore: 0,
      lexicalScore: 0,
      vectorScore: 0,
      fusedScore: 0,
      rerankScore: 0,
      matchedTerms: [],
    })),
  });
}

export class NodeRagService {
  private readonly projectRoot: string;
  private readonly promptSources;
  private readonly brain: DomainBrain;
  private store: RagStore;
  private readonly embeddingAi: GoogleGenAI | null;
  private readonly generationMode: GenerationMode;
  private workflowBriefs: WorkflowBrief[] = [];
  private diskFiles: KnowledgeFile[] = [];
  private diskManifestEntries: IndexManifestEntry[] = [];
  private doctorIssues: KnowledgeDoctorIssue[] = [];
  private indexStatus: IndexStatus = compareIndexStatus({
    diskEntries: [],
    indexedEntries: [],
    storageMode: 'memory',
  });
  private lastRetrievalByPath = new Map<string, RecentRetrievalMatch>();
  private readonly queryEmbeddingCache = new Map<string, number[] | null>();
  private embeddingRefreshTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.promptSources = loadPromptSourceSet(projectRoot);
    this.brain = loadDomainBrain(projectRoot);
    this.generationMode = resolveGenerationMode();

    const storageMode = process.env.RAG_STORAGE_MODE?.toLowerCase() ?? 'memory';
    const databaseUrl = process.env.DATABASE_URL;
    if (storageMode === 'postgres' && databaseUrl) {
      this.store = new PostgresRagStore(databaseUrl);
    } else {
      this.store = new MemoryRagStore(projectRoot);
    }

    const embeddingApiKey = resolveEmbeddingApiKey();
    this.embeddingAi = embeddingApiKey ? new GoogleGenAI({ apiKey: embeddingApiKey }) : null;
  }

  private loadDiskKnowledgeState(): { files: KnowledgeFile[]; manifestEntries: IndexManifestEntry[]; issues: KnowledgeDoctorIssue[] } {
    const corpora = loadKnowledgeCorporaFromDisk(this.projectRoot);
    const files = mergeCorpora(corpora.integrated, corpora.evaluation);
    const chunks = buildStructuredChunks(files);
    return {
      files,
      manifestEntries: buildKnowledgeManifest(files, chunks),
      issues: buildKnowledgeDoctorIssues(files, chunks),
    };
  }

  private refreshIndexStatus(): IndexStatus {
    const diskState = this.loadDiskKnowledgeState();
    this.diskFiles = diskState.files;
    this.diskManifestEntries = diskState.manifestEntries;
    this.doctorIssues = diskState.issues;
    this.indexStatus = compareIndexStatus({
      diskEntries: this.diskManifestEntries,
      indexedEntries: this.store.getManifestEntries(),
      storageMode: this.store.getStats().storageMode,
      generatedAt: this.store.getIndexGeneratedAt(),
      issues: this.doctorIssues,
      nextEmbeddingRetryAt: getNextEmbeddingRetryAt(),
    });
    return this.indexStatus;
  }

  private rememberRetrieval(retrieval: RetrievalDiagnostics, query: string): void {
    const matchedAt = new Date().toISOString();
    const matches = new Map<string, RecentRetrievalMatch>();
    retrieval.candidateDiagnostics.forEach((candidate, index) => {
      matches.set(candidate.path, {
        query,
        normalizedQuery: retrieval.normalizedQuery,
        rank: index + 1,
        inEvidence: candidate.selectedAsEvidence,
        matchedAt,
      });
    });
    this.lastRetrievalByPath = matches;
  }

  private async getQueryEmbedding(query: string): Promise<number[] | null> {
    if (!this.embeddingAi) return null;

    const normalized = query.trim();
    if (!normalized) return null;

    if (this.queryEmbeddingCache.has(normalized)) {
      return this.queryEmbeddingCache.get(normalized) ?? null;
    }

    const embedding = await embedQuery(this.embeddingAi, normalized);
    this.queryEmbeddingCache.set(normalized, embedding);

    if (this.queryEmbeddingCache.size > 128) {
      const oldestKey = this.queryEmbeddingCache.keys().next().value;
      if (oldestKey) {
        this.queryEmbeddingCache.delete(oldestKey);
      }
    }

    return embedding;
  }

  private startBackgroundEmbeddingRefresh(): void {
    if (!this.embeddingAi || this.embeddingRefreshTimer) return;
    const intervalMs = Math.max(60_000, Math.min(EMBEDDING_REFRESH_INTERVAL_MS, 5 * 60 * 1000));
    this.embeddingRefreshTimer = setInterval(() => {
      void this.store.ensureEmbeddings(this.embeddingAi).then(() => {
        this.refreshIndexStatus();
      }).catch((error) => {
        console.warn(`[embedding] background refresh failed: ${describeError(error)}`);
      });
    }, intervalMs);
  }

  private getRetrievalReadiness(): RetrievalReadiness {
    return this.indexStatus.retrievalReadiness;
  }

  private buildWorkflowBriefIndex(): WorkflowBrief[] {
    const chunks = this.store.getChunks();
    const documentIds = Array.from(new Set(chunks.map((chunk) => chunk.documentId)));
    const pages = [
      ...this.store.getCompiledPages('integrated', documentIds),
      ...this.store.getCompiledPages('evaluation', documentIds),
    ];
    return buildWorkflowBriefs(this.brain, pages, chunks);
  }

  private executeSearch(
    mode: PromptMode,
    normalizedQuery: string,
    queryEmbedding: number[] | null,
    aliases: string[],
    options?: SearchPlanningOptions,
  ): SearchExecutionResult {
    const combinedAliases = uniqueNonEmptyLines([...(options?.extraAliases ?? []), ...aliases]);
    const searchQuery = uniqueNonEmptyLines([normalizedQuery, ...combinedAliases]).join('\n');
    const emptyScope: RetrievalScopeContext = {
      routeOnlyDocumentIds: new Set<string>(),
      primaryExpansionDocumentIds: new Set<string>(),
      routingDocuments: [],
      primaryExpansionDocuments: [],
    };

    if (mode !== 'evaluation') {
      const allChunks = this.store.getChunks();
      const representatives = buildDocumentRepresentativeMap(allChunks);
      const heuristicDocumentScoreBoosts = mergeDocumentScoreBoostMaps(
        buildOperationalDocumentBoosts(allChunks, normalizedQuery),
        options?.additionalDocumentScoreBoosts ?? new Map<string, number>(),
      );
      const initialSearch = this.store.search(
        searchQuery,
        mode,
        queryEmbedding,
        combinedAliases,
        heuristicDocumentScoreBoosts.size > 0 ? { documentScoreBoosts: heuristicDocumentScoreBoosts } : undefined,
      );
      const routingCandidates = uniqueDocumentCandidates(
        initialSearch.fusedCandidates.filter((candidate) => candidate.sourceRole === 'routing_summary'),
        4,
      );
      const primaryExpansionDocumentIds = resolveRoutingExpansionDocumentIds(routingCandidates, allChunks);

      if (primaryExpansionDocumentIds.size === 0) {
        return {
          search: pruneIrrelevantSupportEvidence(applyGroundingGate(initialSearch)),
          scope: emptyScope,
        };
      }

      const routeOnlyDocumentIds = new Set(routingCandidates.map((candidate) => candidate.documentId));
      const documentScoreBoosts = mergeDocumentScoreBoostMaps(heuristicDocumentScoreBoosts);
      for (const documentId of primaryExpansionDocumentIds) {
        const sourceRole = representatives.get(documentId)?.sourceRole;
        const boost = sourceRole === 'primary_evaluation' ? 32 : 16;
        documentScoreBoosts.set(documentId, (documentScoreBoosts.get(documentId) ?? 0) + boost);
      }

      const expansionAliases = uniqueNonEmptyLines([
        ...combinedAliases,
        ...routingCandidates.map((candidate) => candidate.docTitle),
        ...routingCandidates.map((candidate) => candidate.parentSectionTitle),
        ...routingCandidates.flatMap((candidate) => candidate.sectionPath.slice(-2)),
      ]);
      const expansionQuery = uniqueNonEmptyLines([
        searchQuery,
        ...routingCandidates.map((candidate) => candidate.docTitle),
        ...routingCandidates.map((candidate) => candidate.parentSectionTitle),
      ]).join('\n');

      const rerankedSearch = applyGroundingGate(
        this.store.search(searchQuery, mode, queryEmbedding, combinedAliases, {
          documentScoreBoosts,
          excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
        }),
      );
      const promotedPrimaryCandidate = this.store
        .search(expansionQuery, mode, queryEmbedding, expansionAliases, {
          allowedDocumentIds: primaryExpansionDocumentIds,
          documentScoreBoosts,
          excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
        })
        .fusedCandidates.find((candidate) => candidate.sourceRole !== 'routing_summary') ?? null;

      return {
        search: pruneIrrelevantSupportEvidence(injectEvidenceCandidate(rerankedSearch, promotedPrimaryCandidate)),
        scope: {
          routeOnlyDocumentIds,
          primaryExpansionDocumentIds,
          routingDocuments: uniqueDocumentPaths(routingCandidates),
          primaryExpansionDocuments: documentPathsFromIds(primaryExpansionDocumentIds, representatives),
        },
      };
    }

    const allChunks = this.store.getChunks();
    const representatives = buildDocumentRepresentativeMap(allChunks);
    const heuristicDocumentScoreBoosts = mergeDocumentScoreBoostMaps(
      buildOperationalDocumentBoosts(allChunks, normalizedQuery),
      options?.additionalDocumentScoreBoosts ?? new Map<string, number>(),
    );
    const evaluationDocumentIds = new Set(
      allChunks.filter((chunk) => chunk.mode === 'evaluation').map((chunk) => chunk.documentId),
    );
    const routeOnlyDocumentIds = new Set(
      allChunks
        .filter((chunk) => chunk.sourceRole === 'routing_summary')
        .map((chunk) => chunk.documentId),
    );

    const routingSearch = this.store.search(searchQuery, mode, queryEmbedding, combinedAliases, {
      allowedDocumentIds: evaluationDocumentIds,
    });
    const routingCandidates = uniqueDocumentCandidates(
      routingSearch.fusedCandidates.filter((candidate) => candidate.sourceRole === 'routing_summary'),
      4,
    );
    const primaryExpansionDocumentIds = resolveRoutingExpansionDocumentIds(routingCandidates, allChunks);

    const integratedSupportDocumentIds = new Set(
      allChunks
        .filter((chunk) => chunk.mode === 'integrated' && chunk.sourceRole === 'support_reference')
        .map((chunk) => chunk.documentId),
    );
    const directSupportDocumentIds =
      integratedSupportDocumentIds.size > 0
        ? selectDirectSupportReferenceIds(
            this.store.search(searchQuery, mode, queryEmbedding, combinedAliases, {
              allowedDocumentIds: integratedSupportDocumentIds,
            }),
          )
        : new Set<string>();

    const allowedDocumentIds = new Set<string>([
      ...evaluationDocumentIds,
      ...primaryExpansionDocumentIds,
      ...directSupportDocumentIds,
    ]);
    const documentScoreBoosts = mergeDocumentScoreBoostMaps(heuristicDocumentScoreBoosts);

    for (const documentId of primaryExpansionDocumentIds) {
      const sourceRole = representatives.get(documentId)?.sourceRole;
      const boost = sourceRole === 'primary_evaluation' ? 48 : 22;
      documentScoreBoosts.set(documentId, (documentScoreBoosts.get(documentId) ?? 0) + boost);
    }

    for (const documentId of directSupportDocumentIds) {
      documentScoreBoosts.set(documentId, (documentScoreBoosts.get(documentId) ?? 0) + 6);
    }

    const expansionAliases = uniqueNonEmptyLines([
      ...combinedAliases,
      ...routingCandidates.map((candidate) => candidate.docTitle),
      ...routingCandidates.map((candidate) => candidate.parentSectionTitle),
      ...routingCandidates.flatMap((candidate) => candidate.sectionPath.slice(-2)),
    ]);
    const expansionQuery = uniqueNonEmptyLines([
      searchQuery,
      ...routingCandidates.map((candidate) => candidate.docTitle),
      ...routingCandidates.map((candidate) => candidate.parentSectionTitle),
    ]).join('\n');

    const baseSearch = applyGroundingGate(
      this.store.search(searchQuery, mode, queryEmbedding, combinedAliases, {
        allowedDocumentIds,
        documentScoreBoosts,
        excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
      }),
    );
    const promotedPrimaryCandidate =
      primaryExpansionDocumentIds.size > 0
        ? this.store
            .search(expansionQuery, mode, queryEmbedding, expansionAliases, {
              allowedDocumentIds: primaryExpansionDocumentIds,
              documentScoreBoosts,
              excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
            })
            .fusedCandidates.find((candidate) => candidate.sourceRole === 'primary_evaluation') ?? null
        : null;

    return {
      search: pruneIrrelevantSupportEvidence(injectEvidenceCandidate(baseSearch, promotedPrimaryCandidate)),
      scope: {
        routeOnlyDocumentIds,
        primaryExpansionDocumentIds,
        routingDocuments: uniqueDocumentPaths(routingCandidates),
        primaryExpansionDocuments: documentPathsFromIds(primaryExpansionDocumentIds, representatives),
      },
    };
  }

  async getChatCapabilities(): Promise<ChatCapabilities> {
    await this.initialize();
    const status = this.refreshIndexStatus();
    return {
      generationMode: this.generationMode,
      requiresUserGenerationKey: this.generationMode === 'user',
      serverEmbeddingReady: status.retrievalReadiness !== 'lexical_only',
      retrievalReadiness: status.retrievalReadiness,
      supportedModels: CHAT_MODELS.map((model) => ({
        id: model.id,
        label: model.label,
      })),
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.store.initialize(this.embeddingAi);
    } catch (error) {
      if (!(this.store instanceof MemoryRagStore)) {
        console.warn(`Falling back to memory RAG store: ${error instanceof Error ? error.message : String(error)}`);
        this.store = new MemoryRagStore(this.projectRoot);
        await this.store.initialize(this.embeddingAi);
      } else {
        throw error;
      }
    }
    if (this.embeddingAi) {
      await this.store.ensureEmbeddings(this.embeddingAi);
    }
    this.refreshIndexStatus();
    this.workflowBriefs = this.buildWorkflowBriefIndex();
    this.startBackgroundEmbeddingRefresh();
    this.initialized = true;
  }

  getStats() {
    return this.store.getStats();
  }

  listKnowledgeFiles() {
    return manifestEntriesToKnowledgeStats(this.loadDiskKnowledgeState().manifestEntries);
  }

  async getIndexStatus(): Promise<IndexStatus> {
    await this.initialize();
    return this.refreshIndexStatus();
  }

  async getDocumentDiagnostics(documentPath: string): Promise<DocumentDiagnostics | null> {
    await this.initialize();
    const status = this.refreshIndexStatus();
    const normalizedPath = documentPath.replace(/\\/g, '/');
    const safePath = normalizedPath.startsWith('/knowledge/') ? normalizedPath : `/knowledge/${normalizedPath.replace(/^\/+/, '')}`;
    const diskEntry = this.diskManifestEntries.find((entry) => entry.path === safePath);
    const indexedEntry = this.store.getManifestEntries().find((entry) => entry.path === safePath);
    if (!diskEntry && !indexedEntry) return null;

    return buildDocumentDiagnostics({
      path: safePath,
      diskEntry,
      indexedEntry,
      status,
      issues: this.doctorIssues.filter((issue) => issue.path === safePath),
      recentRetrieval: this.lastRetrievalByPath.get(safePath) ?? null,
    });
  }

  private async runRetrievalPlan(input: string | ChatMessage[], mode: PromptMode): Promise<RetrievalPlanResult> {
    const recentMessages = Array.isArray(input) ? input.slice(-4) : [];
    const query = Array.isArray(input)
      ? [...recentMessages].reverse().find((message) => message.role === 'user')?.text ?? ''
      : input;
    const normalized = buildNormalizedRetrievalQuery(
      recentMessages.length > 0 ? recentMessages : query.trim() ? [{ role: 'user', text: query.trim() }] : [],
    );
    const profile = buildBrainQueryProfile(this.brain, normalized.normalizedQuery, mode);
    const plannerTrace: Array<{ step: string; detail: string }> = [
      { step: 'question-archetype', detail: profile.questionArchetype },
      { step: 'preferred-answer-type', detail: profile.recommendedAnswerType },
      { step: 'initial-retrieval-mode', detail: profile.preferredRetrievalMode },
    ];
    const workflowBriefs = selectWorkflowBriefs(this.workflowBriefs, profile.workflowEvents);
    const aliases = uniqueNonEmptyLines([
      ...normalized.aliases,
      ...profile.aliases,
      ...profile.relatedTerms,
    ]);
    const embeddingQuery = [normalized.normalizedQuery, ...aliases].filter(Boolean).join('\n');
    const queryEmbedding = await this.getQueryEmbedding(embeddingQuery);
    const workflowBoosts = buildBrainDocumentBoosts(
      this.brain,
      this.store.getChunks(),
      profile.workflowEvents,
      normalized.normalizedQuery,
    );
    const workflowAliasHints = workflowBriefs.flatMap((brief) => [brief.label, brief.summary]);
    let selectedRetrievalMode: RetrievalMode = profile.preferredRetrievalMode;
    let { search, scope } = this.executeSearch(mode, normalized.normalizedQuery, queryEmbedding, aliases, {
      additionalDocumentScoreBoosts: workflowBoosts,
      extraAliases: selectedRetrievalMode === 'workflow-global' ? workflowAliasHints : [],
    });
    const subquestions: string[] = [];

    if (
      profile.preferredRetrievalMode !== 'local' &&
      (search.confidence === 'low' || search.evidence.length < 2 || (search.mismatchSignals ?? []).length > 0)
    ) {
      const refined = buildDriftSubquestions(this.brain, normalized.normalizedQuery, profile, mode);
      subquestions.push(...refined);
      plannerTrace.push({ step: 'drift-refine', detail: refined.length > 0 ? refined.join(' | ') : 'no-subquestions' });

      const mergedEvidence = new Map(search.evidence.map((item) => [item.id, item]));
      const mergedCandidates = new Map(search.fusedCandidates.map((item) => [item.id, item]));

      for (const subquestion of refined) {
        const refinedAliases = uniqueNonEmptyLines([...aliases, subquestion]);
        const refinedEmbedding = await this.getQueryEmbedding([subquestion, ...refinedAliases].join('\n'));
        const refinedSearch = this.executeSearch(mode, subquestion, refinedEmbedding, refinedAliases, {
          additionalDocumentScoreBoosts: workflowBoosts,
          extraAliases: workflowAliasHints,
        });

        refinedSearch.search.evidence.forEach((item) => {
          if (!mergedEvidence.has(item.id) || (mergedEvidence.get(item.id)?.rerankScore ?? 0) < item.rerankScore) {
            mergedEvidence.set(item.id, item);
          }
        });
        refinedSearch.search.fusedCandidates.forEach((item) => {
          if (!mergedCandidates.has(item.id) || (mergedCandidates.get(item.id)?.rerankScore ?? 0) < item.rerankScore) {
            mergedCandidates.set(item.id, item);
          }
        });
      }

      search = {
        ...search,
        confidence: mergedEvidence.size >= 3 ? 'medium' : search.confidence,
        fusedCandidates: Array.from(mergedCandidates.values())
          .sort((left, right) => right.rerankScore - left.rerankScore)
          .slice(0, Math.max(search.fusedCandidates.length, 20)),
        evidence: Array.from(mergedEvidence.values())
          .sort((left, right) => right.rerankScore - left.rerankScore)
          .slice(0, Math.max(search.evidence.length, 10)),
      };
      selectedRetrievalMode = refined.length > 0 ? 'drift-refine' : selectedRetrievalMode;
    }

    const evidence = constrainEvidence({
      ...search,
      evidence: expandEvidenceWithNeighbors(search.evidence, this.store.getChunks()),
    });
    const basisCoverage = buildBasisCoverage(evidence);
    const knowledgeContext = buildExpertKnowledgeContext({
      evidence,
      workflowBriefs,
    });
    plannerTrace.push({
      step: 'workflow-events',
      detail: profile.workflowEvents.length > 0 ? summarizeWorkflowEvents(this.brain, profile.workflowEvents).join(', ') : 'none',
    });
    plannerTrace.push({
      step: 'basis-coverage',
      detail: `legal=${basisCoverage.legal}, evaluation=${basisCoverage.evaluation}, practical=${basisCoverage.practical}`,
    });

    return {
      normalizedQuery: normalized.normalizedQuery,
      querySources: normalized.querySources,
      aliases,
      questionArchetype: profile.questionArchetype,
      recommendedAnswerType: profile.recommendedAnswerType,
      selectedRetrievalMode,
      workflowEventIds: profile.workflowEvents,
      workflowEventsHit: summarizeWorkflowEvents(this.brain, profile.workflowEvents),
      subquestions,
      plannerTrace,
      search,
      scope,
      evidence,
      workflowBriefs,
      knowledgeContext,
      basisCoverage,
    };
  }

  async inspectRetrieval(input: string | ChatMessage[], mode: PromptMode, apiKey?: string): Promise<RetrievalInspectionResponse> {
    await this.initialize();
    void apiKey;
    if (this.embeddingAi) {
      await this.store.ensureEmbeddings(this.embeddingAi);
    }
    const query = Array.isArray(input)
      ? [...input.slice(-4)].reverse().find((message) => message.role === 'user')?.text ?? ''
      : input;
    const planned = await this.runRetrievalPlan(input, mode);
    const compiledPages = this.store.getCompiledPages(mode, planned.evidence.map((item) => item.documentId));
    const indexStatus = this.refreshIndexStatus();
    const retrieval = buildRetrievalDiagnostics(
      {
        ...planned.search,
        evidence: planned.evidence,
      },
      planned.normalizedQuery,
      planned.querySources,
      this.store.getChunks(),
      indexStatus.retrievalReadiness,
      planned.scope,
      {
        selectedRetrievalMode: planned.selectedRetrievalMode,
        workflowEventsHit: planned.workflowEventsHit,
        subquestions: planned.subquestions,
        basisCoverage: planned.basisCoverage,
        plannerTrace: planned.plannerTrace,
      },
    );
    this.rememberRetrieval(retrieval, query);
    return {
      query,
      normalizedQuery: planned.normalizedQuery,
      querySources: planned.querySources,
      search: {
        ...planned.search,
        evidence: planned.evidence,
      },
      compiledPages,
      indexStatus,
      candidateDiagnostics: retrieval.candidateDiagnostics,
      matchedDocumentPaths: retrieval.matchedDocumentPaths,
      retrievalReadiness: retrieval.retrievalReadiness,
      stageTrace: retrieval.stageTrace,
      neighborWindows: retrieval.neighborWindows,
      rejectionReasons: retrieval.rejectionReasons,
      routingDocuments: retrieval.routingDocuments,
      primaryExpansionDocuments: retrieval.primaryExpansionDocuments,
      finalEvidenceDocuments: retrieval.finalEvidenceDocuments,
      selectedRetrievalMode: retrieval.selectedRetrievalMode,
      workflowEventsHit: retrieval.workflowEventsHit,
      subquestions: retrieval.subquestions,
      basisCoverage: retrieval.basisCoverage,
      plannerTrace: retrieval.plannerTrace,
    };
  }

  async generateChatResponse(request: GroundedChatRequest): Promise<GroundedChatResponse> {
    await this.initialize();
    const effectiveApiKey =
      this.generationMode === 'server'
        ? resolveServerGenerationApiKey()
        : request.apiKey?.trim();
    if (!effectiveApiKey) {
      throw new Error('API key is required for grounded chat.');
    }

    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    if (this.embeddingAi) {
      await this.store.ensureEmbeddings(this.embeddingAi);
    }

    const recentMessages = request.messages.slice(-4);
    const latestUserMessage = [...recentMessages].reverse().find((message) => message.role === 'user')?.text ?? '';
    const planned = await this.runRetrievalPlan(recentMessages, request.mode);
    const indexStatus = this.refreshIndexStatus();
    const retrieval = buildRetrievalDiagnostics(
      {
        ...planned.search,
        evidence: planned.evidence,
      },
      planned.normalizedQuery,
      planned.querySources,
      this.store.getChunks(),
      indexStatus.retrievalReadiness,
      planned.scope,
      {
        selectedRetrievalMode: planned.selectedRetrievalMode,
        workflowEventsHit: planned.workflowEventsHit,
        subquestions: planned.subquestions,
        basisCoverage: planned.basisCoverage,
        plannerTrace: planned.plannerTrace,
      },
    );
    this.rememberRetrieval(retrieval, latestUserMessage || planned.normalizedQuery);

    const keyIssueDate = planned.evidence.find((item) => item.effectiveDate)?.effectiveDate;
    const citations = dedupeCitations(planned.evidence);

    if (planned.evidence.length === 0 || planned.search.confidence === 'low') {
      const answer = createExpertAbstainAnswer({
        question: latestUserMessage || planned.normalizedQuery,
        confidence: planned.search.confidence,
        evidenceState: planned.search.confidence === 'low' ? 'not_enough' : 'partial',
        keyIssueDate,
        evidence: citations,
      });
      return {
        answer,
        text: renderExpertAnswerMarkdown(answer),
        search: {
          ...planned.search,
          evidence: planned.evidence,
        },
        citations,
        retrieval,
      };
    }

    const answerPlan = await generateAnswerPlan({
      ai,
      model: request.model,
      brain: this.brain,
      mode: request.mode,
      variant: request.promptVariant,
      sources: this.promptSources,
      question: latestUserMessage || planned.normalizedQuery,
      retrievalMode: planned.selectedRetrievalMode,
      questionArchetype: planned.questionArchetype,
      recommendedAnswerType: planned.recommendedAnswerType,
      workflowEventIds: planned.workflowEventIds,
      workflowBriefs: planned.workflowBriefs,
      evidence: planned.evidence,
      knowledgeContext: planned.knowledgeContext,
    });
    retrieval.plannerTrace = [
      ...retrieval.plannerTrace,
      { step: 'planner-answer-type', detail: answerPlan.recommendedAnswerType },
      { step: 'planner-tasks', detail: answerPlan.taskCandidates.map((task) => task.title).join(', ') || 'none' },
    ];

    const answer = await synthesizeExpertAnswer({
      ai,
      model: request.model,
      mode: request.mode,
      variant: request.promptVariant,
      sources: this.promptSources,
      question: latestUserMessage || planned.normalizedQuery,
      brain: this.brain,
      plan: answerPlan,
      evidence: planned.evidence,
      knowledgeContext: planned.knowledgeContext,
      retrievalMode: planned.selectedRetrievalMode,
      evidenceState:
        planned.search.confidence === 'high'
          ? 'confirmed'
          : planned.search.confidence === 'medium'
            ? 'partial'
            : 'not_enough',
      confidence: planned.search.confidence,
      keyIssueDate,
    });
    const answerEvidenceIds = new Set(answer.citations.map((item) => item.evidenceId));
    const resolvedCitations = citations.filter((item) => answerEvidenceIds.has(item.id));
    const finalCitations = resolvedCitations.length > 0 ? resolvedCitations : citations.slice(0, 4);

    return {
      answer,
      text: renderExpertAnswerMarkdown(answer),
      search: {
        ...planned.search,
        evidence: planned.evidence,
      },
      citations: finalCitations,
      retrieval,
    };
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
    article_no: chunk.articleNo ?? null,
    matched_labels: chunk.matchedLabels,
    linked_document_titles: chunk.linkedDocumentTitles,
    chunk_hash: chunk.chunkHash,
    parent_section_id: chunk.parentSectionId,
    parent_section_title: chunk.parentSectionTitle,
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

export async function embedIndexRows(ai: GoogleGenAI, rows: Array<Record<string, unknown>>): Promise<void> {
  const chunkLike = rows.map((row) => ({
    id: String(row.id),
    searchText: String(row.search_text),
    embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : undefined,
  }));

  if (shouldSkipEmbeddingWork('index embeddings')) return;

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
        const row = rows.find((item) => item.id === batch[responseIndex].id);
        if (row) row.embedding = embedding;
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

export async function upsertRowsToPostgres(params: {
  connectionString: string;
  documentRows: Array<Record<string, unknown>>;
  documentVersionRows: Array<Record<string, unknown>>;
  sectionRows: Array<Record<string, unknown>>;
  chunkRows: Array<Record<string, unknown>>;
  compiledRows: Array<Record<string, unknown>>;
  indexMetadataRow: Record<string, unknown>;
}): Promise<void> {
  const pool = new Pool({ connectionString: params.connectionString });
  const client = await pool.connect();
  try {
    const pg = <T>(value: T): T => sanitizePostgresValue(value);

    await ensurePostgresSchema(client);
    await client.query('begin');
    await client.query('delete from rag_index_metadata');
    await client.query('delete from sections');
    await client.query('delete from document_versions');
    await client.query('delete from chunks');
    await client.query('delete from compiled_pages');
    await client.query('delete from documents');

    for (const row of params.documentRows) {
      await client.query(
        `
        insert into documents (
          id,
          title,
          file_name,
          path,
          mode,
          source_role,
          source_type,
          document_group,
          effective_date,
          published_date,
          content_hash,
          file_size,
          source_mtime,
          chunk_count,
          embedding_count
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `,
        [
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
      );
    }

    for (const row of params.documentVersionRows) {
      await client.query(
        `
        insert into document_versions (
          id,
          document_id,
          version_hash,
          raw_content
        ) values ($1,$2,$3,$4)
        `,
        [pg(row.id), pg(row.document_id), pg(row.version_hash), pg(row.raw_content)],
      );
    }

    for (const row of params.sectionRows) {
      await client.query(
        `
        insert into sections (
          id,
          document_id,
          title,
          depth,
          section_path,
          article_no,
          line_start,
          line_end,
          content
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
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
      );
    }

    for (const row of params.chunkRows) {
      await client.query(
        `
        insert into chunks (
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
          article_no,
          matched_labels,
          linked_document_titles,
          chunk_hash,
          parent_section_id,
          parent_section_title,
          window_index,
          span_start,
          span_end,
          citation_group_id,
          embedding
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
        )
        `,
        [
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
          pg(row.article_no),
          JSON.stringify(pg(row.matched_labels)),
          JSON.stringify(pg(row.linked_document_titles)),
          pg(row.chunk_hash),
          pg(row.parent_section_id),
          pg(row.parent_section_title),
          row.window_index,
          row.span_start,
          row.span_end,
          pg(row.citation_group_id),
          Array.isArray(row.embedding) && (row.embedding as number[]).length === EMBEDDING_DIMENSIONS
            ? `[${(row.embedding as number[]).join(',')}]`
            : null,
        ],
      );
    }

    for (const row of params.compiledRows) {
      await client.query(
        `
        insert into compiled_pages (
          id,
          page_type,
          title,
          mode,
          source_document_ids,
          backlinks,
          summary,
          body,
          tags
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
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
      );
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
