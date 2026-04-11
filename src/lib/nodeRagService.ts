import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Pool } from 'pg';
import { buildRagCorpusIndex, searchCorpus, type RagCorpusIndex } from './ragEngine';
import { buildCitationLabel, compareIsoDateDesc, formatEvidenceStateLabel, toDocumentMetadata } from './ragMetadata';
import { loadKnowledgeCorporaFromDisk } from './nodeKnowledge';
import { loadPromptSourceSet } from './nodePrompts';
import { buildVariantSystemInstruction, type PromptVariant } from './promptAssembly';
import { buildCompiledPages, buildStructuredChunks, buildStructuredSections, chunksToEvidenceContext } from './ragStructured';
import type {
  BenchmarkCase,
  ChatMessage,
  CompiledPage,
  ConfidenceLevel,
  GroundedAnswer,
  KnowledgeFile,
  PromptMode,
  QueryIntent,
  SearchRun,
  StructuredChunk,
} from './ragTypes';

interface StoredChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  title: string;
  text: string;
  search_text: string;
  mode: PromptMode;
  source_type: StructuredChunk['sourceType'];
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
  embedding?: number[] | string | null;
}

interface GroundedChatRequest {
  messages: ChatMessage[];
  mode: PromptMode;
  model: string;
  promptVariant: PromptVariant;
  apiKey?: string;
}

export interface GroundedChatResponse {
  text: string;
  search: SearchRun;
  citations: StructuredChunk[];
}

export interface RetrievalInspectionResponse {
  query: string;
  search: SearchRun;
  compiledPages: CompiledPage[];
}

interface RagStore {
  initialize(ai: GoogleGenAI | null): Promise<void>;
  ensureEmbeddings(ai: GoogleGenAI): Promise<void>;
  search(query: string, mode: PromptMode, queryEmbedding: number[] | null): SearchRun;
  getCompiledPages(mode: PromptMode, documentIds: string[]): CompiledPage[];
  listKnowledgeFiles(): { name: string; size: number; updatedAt: Date }[];
  getStats(): { chunks: number; compiledPages: number; storageMode: string };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_BATCH_SIZE = parsePositiveInteger(process.env.RAG_EMBEDDING_BATCH_SIZE, 20);
const EMBEDDING_MAX_CHUNKS_PER_PASS = parsePositiveInteger(process.env.RAG_EMBEDDING_MAX_CHUNKS_PER_PASS, 400);
const EMBEDDING_REFRESH_INTERVAL_MS = parsePositiveInteger(process.env.RAG_EMBEDDING_REFRESH_INTERVAL_MS, 15 * 60 * 1000);
const EMBEDDING_QUOTA_COOLDOWN_MS = parsePositiveInteger(process.env.RAG_EMBEDDING_QUOTA_COOLDOWN_MS, 6 * 60 * 60 * 1000);
const MAX_CONTEXT_CHARS = 20_000;
const CURRENT_DATE = new Date().toISOString().slice(0, 10);
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

function rowToChunk(row: StoredChunkRow): StructuredChunk {
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
    documentGroup: row.document_group,
    docTitle: row.doc_title,
    fileName: row.file_name,
    path: row.path,
    effectiveDate: row.effective_date ?? undefined,
    publishedDate: row.published_date ?? undefined,
    sectionPath: parseStringArray(row.section_path),
    articleNo: row.article_no ?? undefined,
    matchedLabels: parseStringArray(row.matched_labels),
    chunkHash: row.chunk_hash,
    embedding: parseEmbedding(row.embedding),
  };
}

function chunkToCitationLine(chunk: StructuredChunk): string {
  return buildCitationLabel(chunk);
}

function dedupeCitations(chunks: StructuredChunk[]): StructuredChunk[] {
  const seen = new Set<string>();
  const result: StructuredChunk[] = [];
  for (const chunk of chunks) {
    const key = `${chunk.docTitle}:${chunk.articleNo ?? chunk.sectionPath.join('>')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(chunk);
  }
  return result.sort((left, right) => compareIsoDateDesc(left.effectiveDate, right.effectiveDate));
}

function deriveKeyIssueDate(answer: GroundedAnswer, citations: StructuredChunk[]): string {
  if (answer.keyIssueDate && /^\d{4}-\d{2}-\d{2}$/.test(answer.keyIssueDate)) {
    return answer.keyIssueDate;
  }
  const datedCitation = citations.find((citation) => citation.effectiveDate);
  return datedCitation?.effectiveDate ?? CURRENT_DATE;
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
    conclusion: candidate.conclusion?.trim() || '검색된 근거만으로 결론을 확정하기 어렵습니다.',
    directEvidence: Array.isArray(candidate.directEvidence) ? candidate.directEvidence.map((item) => item.trim()).filter(Boolean) : [],
    practicalGuidance: Array.isArray(candidate.practicalGuidance) ? candidate.practicalGuidance.map((item) => item.trim()).filter(Boolean) : [],
    caveats: Array.isArray(candidate.caveats) ? candidate.caveats.map((item) => item.trim()).filter(Boolean) : [],
    citationEvidenceIds: Array.isArray(candidate.citationEvidenceIds) ? candidate.citationEvidenceIds.map((item) => item.trim()).filter(Boolean) : [],
    followUpQuestion: candidate.followUpQuestion?.trim() || undefined,
  };
}

function createAbstainAnswer(search: SearchRun): GroundedAnswer {
  const leading = search.evidence.slice(0, 2);
  return {
    evidenceState: search.confidence === 'low' ? 'not_enough' : 'partial',
    confidence: 'low',
    keyIssueDate: leading.find((item) => item.effectiveDate)?.effectiveDate ?? CURRENT_DATE,
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
  const sourceLines = dedupeCitations(citations).map(chunkToCitationLine);

  return [
    formatSection('답변 가용 상태', evidenceState),
    formatSection('기준 시점', keyIssueDate),
    formatSection('결론', answer.conclusion),
    formatSection('확정 근거', answer.directEvidence.length > 0 ? answer.directEvidence : ['직접 근거를 확인할 수 없어 결론을 제한했습니다.']),
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
    });
    return response.embeddings[0]?.values ?? null;
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
          }),
        ),
      );
      responses.forEach((response, batchIndex) => {
        batch[batchIndex].embedding = response.embeddings[0]?.values ?? [];
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

class MemoryRagStore implements RagStore {
  private readonly projectRoot: string;
  private readonly embeddingCachePath: string;
  private readonly knowledgeStats: { name: string; size: number; updatedAt: Date }[];
  private chunks: StructuredChunk[] = [];
  private index: RagCorpusIndex = buildRagCorpusIndex([]);
  private compiledPages: CompiledPage[] = [];
  private lastEmbeddingAttemptAt = 0;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.embeddingCachePath = path.join(projectRoot, '.rag-cache', EMBEDDING_CACHE_FILE);
    this.knowledgeStats = collectKnowledgeStats(projectRoot);
  }

  private restoreEmbeddingsFromCache(): number {
    if (!fs.existsSync(this.embeddingCachePath)) return 0;

    try {
      const parsed = JSON.parse(fs.readFileSync(this.embeddingCachePath, 'utf8')) as Record<string, number[]>;
      let restored = 0;

      for (const chunk of this.chunks) {
        const cached = parsed[chunk.chunkHash];
        if (!Array.isArray(cached) || cached.length === 0) continue;
        chunk.embedding = cached.map((value) => Number(value));
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
      .map((chunk) => [chunk.chunkHash, chunk.embedding] as const);

    try {
      fs.mkdirSync(path.dirname(this.embeddingCachePath), { recursive: true });
      fs.writeFileSync(this.embeddingCachePath, JSON.stringify(Object.fromEntries(cachedEntries)));
    } catch (error) {
      console.warn(`[embedding] failed to persist cache: ${describeError(error)}`);
    }
  }

  async initialize(): Promise<void> {
    const corpora = loadKnowledgeCorporaFromDisk(this.projectRoot);
    const merged = mergeCorpora(corpora.integrated, corpora.evaluation);
    this.chunks = buildStructuredChunks(merged);
    const restored = this.restoreEmbeddingsFromCache();
    if (restored > 0) {
      console.info(`[embedding] restored ${restored} cached chunk embeddings from disk.`);
    }
    this.index = buildRagCorpusIndex(this.chunks);
    this.compiledPages = buildCompiledPages(this.chunks);
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
  }

  search(query: string, mode: PromptMode, queryEmbedding: number[] | null): SearchRun {
    return searchCorpus({ index: this.index, query, mode, queryEmbedding });
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
}

class PostgresRagStore implements RagStore {
  private readonly pool: Pool;
  private chunks: StructuredChunk[] = [];
  private index: RagCorpusIndex = buildRagCorpusIndex([]);
  private compiledPages: CompiledPage[] = [];
  private lastEmbeddingAttemptAt = 0;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async initialize(): Promise<void> {
    const chunkResult = await this.pool.query<StoredChunkRow>(`
      select
        id,
        document_id,
        chunk_index,
        title,
        text,
        search_text,
        mode,
        source_type,
        document_group,
        doc_title,
        file_name,
        path,
        effective_date,
        published_date,
        section_path,
        article_no,
        matched_labels,
        chunk_hash,
        embedding
      from chunks
      order by doc_title asc, chunk_index asc
    `);

    if (chunkResult.rows.length === 0) {
      throw new Error('Postgres RAG storage is empty.');
    }

    this.chunks = chunkResult.rows.map(rowToChunk);
    this.index = buildRagCorpusIndex(this.chunks);

    const compiledResult = await this.pool.query<{
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
  }

  async ensureEmbeddings(ai: GoogleGenAI): Promise<void> {
    if (Date.now() - this.lastEmbeddingAttemptAt < EMBEDDING_REFRESH_INTERVAL_MS) return;
    this.lastEmbeddingAttemptAt = Date.now();

    const missing = this.chunks.filter((chunk) => !chunk.embedding || chunk.embedding.length === 0);
    if (missing.length === 0) return;
    await embedChunks(ai, missing);
    this.index = buildRagCorpusIndex(this.chunks);
  }

  search(query: string, mode: PromptMode, queryEmbedding: number[] | null): SearchRun {
    return searchCorpus({ index: this.index, query, mode, queryEmbedding });
  }

  getCompiledPages(mode: PromptMode, documentIds: string[]): CompiledPage[] {
    const documentIdSet = new Set(documentIds);
    return this.compiledPages.filter((page) => page.mode === mode && page.sourceDocumentIds.some((id) => documentIdSet.has(id))).slice(0, 4);
  }

  listKnowledgeFiles() {
    return [];
  }

  getStats() {
    return {
      chunks: this.chunks.length,
      compiledPages: this.compiledPages.length,
      storageMode: 'postgres',
    };
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
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      keyIssueDate: {
        type: 'string',
      },
      conclusion: {
        type: 'string',
      },
      directEvidence: {
        type: 'array',
        items: { type: 'string' },
      },
      practicalGuidance: {
        type: 'array',
        items: { type: 'string' },
      },
      caveats: {
        type: 'array',
        items: { type: 'string' },
      },
      citationEvidenceIds: {
        type: 'array',
        items: { type: 'string' },
      },
      followUpQuestion: {
        type: 'string',
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

function constrainEvidence(search: SearchRun): SearchRun['evidence'] {
  let totalChars = 0;
  const constrained: SearchRun['evidence'] = [];
  for (const evidence of search.evidence) {
    if (totalChars + evidence.text.length > MAX_CONTEXT_CHARS) break;
    totalChars += evidence.text.length;
    constrained.push(evidence);
  }
  return constrained;
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
        temperature: 0.1,
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
  private store: RagStore;
  private readonly bootstrapAi: GoogleGenAI | null;
  private initialized = false;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.promptSources = loadPromptSourceSet(projectRoot);

    const storageMode = process.env.RAG_STORAGE_MODE?.toLowerCase() ?? 'memory';
    const databaseUrl = process.env.DATABASE_URL;
    if (storageMode === 'postgres' && databaseUrl) {
      this.store = new PostgresRagStore(databaseUrl);
    } else {
      this.store = new MemoryRagStore(projectRoot);
    }

    const bootstrapApiKey = process.env.GEMINI_API_KEY;
    this.bootstrapAi = bootstrapApiKey ? new GoogleGenAI({ apiKey: bootstrapApiKey }) : null;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.store.initialize(this.bootstrapAi);
    } catch (error) {
      if (!(this.store instanceof MemoryRagStore)) {
        console.warn(`Falling back to memory RAG store: ${error instanceof Error ? error.message : String(error)}`);
        this.store = new MemoryRagStore(this.projectRoot);
        await this.store.initialize(this.bootstrapAi);
      } else {
        throw error;
      }
    }
    if (this.bootstrapAi) {
      await this.store.ensureEmbeddings(this.bootstrapAi);
    }
    this.initialized = true;
  }

  getStats() {
    return this.store.getStats();
  }

  listKnowledgeFiles() {
    return this.store.listKnowledgeFiles();
  }

  async inspectRetrieval(query: string, mode: PromptMode, apiKey?: string): Promise<RetrievalInspectionResponse> {
    await this.initialize();
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
    const ai = effectiveApiKey ? new GoogleGenAI({ apiKey: effectiveApiKey }) : null;
    if (ai) {
      await this.store.ensureEmbeddings(ai);
    }
    const queryEmbedding = ai ? await embedQuery(ai, query) : null;
    const search = this.store.search(query, mode, queryEmbedding);
    const compiledPages = this.store.getCompiledPages(mode, search.evidence.map((item) => item.documentId));
    return { query, search, compiledPages };
  }

  async generateChatResponse(request: GroundedChatRequest): Promise<GroundedChatResponse> {
    await this.initialize();
    const effectiveApiKey = request.apiKey || process.env.GEMINI_API_KEY;
    if (!effectiveApiKey) {
      throw new Error('API key is required for grounded chat.');
    }

    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    await this.store.ensureEmbeddings(ai);

    const recentMessages = request.messages.slice(-4);
    const latestUserMessage = [...recentMessages].reverse().find((message) => message.role === 'user')?.text ?? '';
    const queryEmbedding = await embedQuery(ai, latestUserMessage);
    const search = this.store.search(latestUserMessage, request.mode, queryEmbedding);
    const evidence = constrainEvidence(search);

    if (evidence.length === 0 || search.confidence === 'low') {
      const abstain = createAbstainAnswer(search);
      const citations = dedupeCitations(evidence);
      return {
        text: formatMarkdownAnswer(abstain, citations),
        search: {
          ...search,
          evidence,
        },
        citations,
      };
    }

    const compiledPages = this.store.getCompiledPages(request.mode, evidence.map((item) => item.documentId));
    const knowledgeContext = [
      chunksToEvidenceContext(evidence),
      buildCompiledPageContext(compiledPages),
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    const systemInstruction = [
      buildVariantSystemInstruction({
        mode: request.mode,
        variant: request.promptVariant,
        knowledgeContext,
        sources: this.promptSources,
      }),
      '',
      '반드시 제공된 evidence id만 citationEvidenceIds에 넣고, evidence에 없는 문서명을 출처로 쓰지 마세요.',
      '근거가 부족하면 evidenceState를 not_enough로 두고 followUpQuestion을 작성하세요.',
    ].join('\n');

    const contents = recentMessages.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    }));

    const answer = await generateGroundedAnswer({
      ai,
      model: request.model,
      contents,
      systemInstruction,
      evidence,
    });

    const citations = dedupeCitations(
      evidence.filter((item) => answer.citationEvidenceIds.includes(item.id)),
    );

    return {
      text: formatMarkdownAnswer(answer, citations.length > 0 ? citations : evidence.slice(0, 2)),
      search: {
        ...search,
        evidence,
      },
      citations: citations.length > 0 ? citations : evidence.slice(0, 2),
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
    document_group: chunk.documentGroup,
    doc_title: chunk.docTitle,
    file_name: chunk.fileName,
    path: chunk.path,
    effective_date: chunk.effectiveDate ?? null,
    published_date: chunk.publishedDate ?? null,
    section_path: chunk.sectionPath,
    article_no: chunk.articleNo ?? null,
    matched_labels: chunk.matchedLabels,
    chunk_hash: chunk.chunkHash,
    embedding: chunk.embedding ?? null,
  }));
}

export function buildDocumentRows(files: KnowledgeFile[]): Array<Record<string, unknown>> {
  return files.map((file) => {
    const metadata = toDocumentMetadata(file);
    return {
      id: metadata.documentId,
      title: metadata.title,
      file_name: metadata.fileName,
      path: metadata.path,
      mode: metadata.mode,
      source_type: metadata.sourceType,
      document_group: metadata.documentGroup,
      effective_date: metadata.effectiveDate ?? null,
      published_date: metadata.publishedDate ?? null,
    };
  });
}

export function buildDocumentVersionRows(files: KnowledgeFile[]): Array<Record<string, unknown>> {
  return files.map((file) => {
    const metadata = toDocumentMetadata(file);
    return {
      id: `${metadata.documentId}:v1`,
      document_id: metadata.documentId,
      version_hash: metadata.documentId,
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
          }),
        ),
      );
      responses.forEach((response, responseIndex) => {
        const embedding = response.embeddings[0]?.values ?? [];
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
}): Promise<void> {
  const pool = new Pool({ connectionString: params.connectionString });
  const client = await pool.connect();
  try {
    const pg = <T>(value: T): T => sanitizePostgresValue(value);

    await client.query('begin');
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
          source_type,
          document_group,
          effective_date,
          published_date
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          pg(row.id),
          pg(row.title),
          pg(row.file_name),
          pg(row.path),
          pg(row.mode),
          pg(row.source_type),
          pg(row.document_group),
          row.effective_date,
          row.published_date,
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
          document_group,
          doc_title,
          file_name,
          path,
          effective_date,
          published_date,
          section_path,
          article_no,
          matched_labels,
          chunk_hash,
          embedding
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
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
          pg(row.document_group),
          pg(row.doc_title),
          pg(row.file_name),
          pg(row.path),
          row.effective_date,
          row.published_date,
          JSON.stringify(pg(row.section_path)),
          pg(row.article_no),
          JSON.stringify(pg(row.matched_labels)),
          pg(row.chunk_hash),
          row.embedding ? `[${(row.embedding as number[]).join(',')}]` : null,
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
    await client.query('commit');
  } finally {
    client.release();
    await pool.end();
  }
}
