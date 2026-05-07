import { normalizeDocumentTitle, stripExtension } from './ragMetadata';
import type { BenchmarkCase, IndexManifestEntry, PromptMode } from './ragTypes';

export type AliasCandidateSource =
  | 'file-title'
  | 'document-title'
  | 'heading'
  | 'qa-question'
  | 'benchmark-question'
  | 'benchmark-expected-doc';

export interface AliasCandidateChunkInput {
  id?: string;
  document_id?: string;
  documentId?: string;
  doc_title?: string;
  docTitle?: string;
  file_name?: string;
  fileName?: string;
  path?: string;
  title?: string;
  parent_section_title?: string;
  parentSectionTitle?: string;
  section_path?: string[] | string;
  sectionPath?: string[];
  text?: string;
}

export interface RagAliasCandidateInput {
  manifestEntries: IndexManifestEntry[];
  chunks?: AliasCandidateChunkInput[];
  benchmarkCases?: BenchmarkCase[];
  generatedAt?: string;
}

export interface RagAliasCandidate {
  alias: string;
  compactAlias: string;
  canonical: string;
  source: AliasCandidateSource;
  score: number;
  evidence: string;
}

export interface RagAliasDocumentReport {
  documentId: string;
  path: string;
  name: string;
  mode: PromptMode;
  canonical: string;
  aliases: RagAliasCandidate[];
  curationHints: string[];
}

export interface RagAliasCandidateReport {
  generatedAt: string;
  summary: {
    documentCount: number;
    candidateCount: number;
    sourceCounts: Partial<Record<AliasCandidateSource, number>>;
    curatedAliasTargetPath: string;
  };
  documents: RagAliasDocumentReport[];
}

const SOURCE_SCORES: Record<AliasCandidateSource, number> = {
  'benchmark-question': 1,
  heading: 0.9,
  'qa-question': 0.85,
  'benchmark-expected-doc': 0.8,
  'document-title': 0.75,
  'file-title': 0.7,
};

const GENERIC_TITLE_NOISE = [
  '붙임',
  '첨부',
  '게시용',
  '최종게시용',
  '최종',
  '업로드본',
  '정리본',
  '전문',
  '개정',
  '일부',
  '관련',
  '안내',
];

function toCleanAlias(value: unknown): string {
  if (typeof value !== 'string') return '';
  return stripExtension(value)
    .replace(/[_]+/g, ' ')
    .replace(/[“”"'`]/g, '')
    .replace(/^\s*(?:[-*•‣▪▫■□]+|\d{1,2}[.)]|[①-⑳])\s*/u, '')
    .replace(/^\s*\((?:붙임|첨부)\)\s*/u, '')
    .replace(/^\s*(?:붙임|첨부)\s*\d*[_\-\s]*/u, '')
    .replace(/\bENC\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactAlias(value: string): string {
  return value.replace(/[\s\u3000._\-()[\]{}<>「」『』,;:'"\\/|·ㆍ¸]+/g, '').toLowerCase();
}

function isUsefulAlias(alias: string): boolean {
  const compact = compactAlias(alias);
  if (compact.length < 3) return false;
  if (/^\d+$/.test(compact)) return false;
  if (/^20\d{2}년?$/.test(compact)) return false;
  if (/https?:\/\//i.test(alias)) return false;
  if (alias.length > 90) return false;
  if (alias.split(/\s+/).length > 12) return false;
  return true;
}

function addCandidate(
  candidatesByDocument: Map<string, RagAliasCandidate[]>,
  documentId: string,
  canonical: string,
  alias: unknown,
  source: AliasCandidateSource,
  evidence: string,
): void {
  const clean = toCleanAlias(alias);
  if (!isUsefulAlias(clean)) return;

  const candidate: RagAliasCandidate = {
    alias: clean,
    compactAlias: compactAlias(clean),
    canonical,
    source,
    score: SOURCE_SCORES[source],
    evidence,
  };
  const current = candidatesByDocument.get(documentId) ?? [];
  current.push(candidate);
  candidatesByDocument.set(documentId, current);
}

function splitSectionPath(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function extractQaQuestions(text: unknown): string[] {
  if (typeof text !== 'string') return [];
  const questions: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:질문|문|q)\s*[:.)：-]?\s*(.+\?)?\s*(.*)$/iu);
    if (!match) continue;
    const question = toCleanAlias([match[1], match[2]].filter(Boolean).join(' '));
    if (question) questions.push(question);
  }
  return questions;
}

function addTitleFragments(
  candidatesByDocument: Map<string, RagAliasCandidate[]>,
  documentId: string,
  canonical: string,
  title: string,
): void {
  const parts = title
    .split(/[\s_()[\],·ㆍ¸]+/u)
    .map(toCleanAlias)
    .filter((part) => isUsefulAlias(part) && !GENERIC_TITLE_NOISE.includes(part));

  for (const part of parts) {
    if (part.length >= 4 || /[가-힣]{2,}/u.test(part)) {
      addCandidate(candidatesByDocument, documentId, canonical, part, 'heading', `title-fragment:${title}`);
    }
  }
}

function findDocumentForExpectedDoc(
  expectedDoc: string,
  manifestEntries: IndexManifestEntry[],
  chunksByDocument: Map<string, AliasCandidateChunkInput[]>,
): IndexManifestEntry | undefined {
  const expectedCompact = normalizeDocumentTitle(expectedDoc);
  return manifestEntries.find((entry) => {
    const titleCompact = normalizeDocumentTitle(entry.name);
    if (titleCompact.includes(expectedCompact) || expectedCompact.includes(titleCompact)) return true;
    const chunks = chunksByDocument.get(entry.documentId) ?? [];
    return chunks.some((chunk) => {
      const candidates = [
        chunk.doc_title ?? chunk.docTitle,
        chunk.file_name ?? chunk.fileName,
        chunk.title,
        chunk.parent_section_title ?? chunk.parentSectionTitle,
        ...splitSectionPath(chunk.section_path ?? chunk.sectionPath),
      ];
      return candidates.some((candidate) => {
        const compact = normalizeDocumentTitle(String(candidate ?? ''));
        return compact.includes(expectedCompact) || expectedCompact.includes(compact);
      });
    });
  });
}

function dedupeCandidates(candidates: RagAliasCandidate[]): RagAliasCandidate[] {
  const bestByCompact = new Map<string, RagAliasCandidate>();
  for (const candidate of candidates) {
    const existing = bestByCompact.get(candidate.compactAlias);
    if (!existing || candidate.score > existing.score) {
      bestByCompact.set(candidate.compactAlias, candidate);
    }
  }

  return Array.from(bestByCompact.values()).sort(
    (left, right) =>
      right.score - left.score ||
      left.source.localeCompare(right.source) ||
      left.alias.localeCompare(right.alias, 'ko'),
  );
}

function countSources(documents: RagAliasDocumentReport[]): Partial<Record<AliasCandidateSource, number>> {
  const counts: Partial<Record<AliasCandidateSource, number>> = {};
  for (const candidate of documents.flatMap((document) => document.aliases)) {
    counts[candidate.source] = (counts[candidate.source] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function buildRagAliasCandidateReport(input: RagAliasCandidateInput): RagAliasCandidateReport {
  const candidatesByDocument = new Map<string, RagAliasCandidate[]>();
  const chunksByDocument = new Map<string, AliasCandidateChunkInput[]>();
  for (const chunk of input.chunks ?? []) {
    const documentId = String(chunk.document_id ?? chunk.documentId ?? '');
    if (!documentId) continue;
    const current = chunksByDocument.get(documentId) ?? [];
    current.push(chunk);
    chunksByDocument.set(documentId, current);
  }

  for (const entry of input.manifestEntries) {
    const canonical = toCleanAlias(entry.name);
    addCandidate(candidatesByDocument, entry.documentId, canonical, entry.name, 'file-title', entry.path);
    addTitleFragments(candidatesByDocument, entry.documentId, canonical, canonical);
  }

  for (const [documentId, chunks] of chunksByDocument.entries()) {
    const entry = input.manifestEntries.find((item) => item.documentId === documentId);
    if (!entry) continue;
    const canonical = toCleanAlias(entry.name);
    for (const chunk of chunks) {
      addCandidate(candidatesByDocument, documentId, canonical, chunk.doc_title ?? chunk.docTitle, 'document-title', String(chunk.id ?? 'chunk'));
      addCandidate(candidatesByDocument, documentId, canonical, chunk.title, 'heading', String(chunk.id ?? 'chunk'));
      addCandidate(
        candidatesByDocument,
        documentId,
        canonical,
        chunk.parent_section_title ?? chunk.parentSectionTitle,
        'heading',
        String(chunk.id ?? 'chunk'),
      );
      for (const part of splitSectionPath(chunk.section_path ?? chunk.sectionPath).slice(1)) {
        addCandidate(candidatesByDocument, documentId, canonical, part, 'heading', String(chunk.id ?? 'chunk'));
      }
      for (const question of extractQaQuestions(chunk.text)) {
        addCandidate(candidatesByDocument, documentId, canonical, question, 'qa-question', String(chunk.id ?? 'chunk'));
      }
    }
  }

  for (const benchmark of input.benchmarkCases ?? []) {
    const target = findDocumentForExpectedDoc(benchmark.expectedDoc, input.manifestEntries, chunksByDocument);
    if (!target) continue;
    const canonical = toCleanAlias(target.name);
    addCandidate(candidatesByDocument, target.documentId, canonical, benchmark.expectedDoc, 'benchmark-expected-doc', benchmark.id);
    addCandidate(candidatesByDocument, target.documentId, canonical, benchmark.question, 'benchmark-question', benchmark.id);
  }

  const documents = input.manifestEntries
    .map((entry): RagAliasDocumentReport => {
      const aliases = dedupeCandidates(candidatesByDocument.get(entry.documentId) ?? []);
      return {
        documentId: entry.documentId,
        path: entry.path,
        name: entry.name,
        mode: entry.mode,
        canonical: toCleanAlias(entry.name),
        aliases,
        curationHints: [
          `Review high-value aliases and promote stable entries into knowledge/ontology/curated.json as concept aliases.`,
          `Suggested concept label: ${toCleanAlias(entry.name)}`,
        ],
      };
    })
    .filter((document) => document.aliases.length > 0)
    .sort((left, right) => right.aliases.length - left.aliases.length || left.path.localeCompare(right.path, 'ko'));

  const sourceCounts = countSources(documents);
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary: {
      documentCount: documents.length,
      candidateCount: documents.reduce((sum, document) => sum + document.aliases.length, 0),
      sourceCounts,
      curatedAliasTargetPath: 'knowledge/ontology/curated.json',
    },
    documents,
  };
}

function formatSourceCounts(counts: Partial<Record<AliasCandidateSource, number>>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '- none';
  return entries.map(([source, count]) => `- ${source}: ${count}`).join('\n');
}

export function formatRagAliasCandidateMarkdown(report: RagAliasCandidateReport): string {
  const documentLines = report.documents.slice(0, 40).flatMap((document) => [
    `### ${document.canonical}`,
    '',
    `- Path: ${document.path}`,
    `- Candidate count: ${document.aliases.length}`,
    `- Curation hint: ${document.curationHints[0]}`,
    '',
    ...document.aliases.slice(0, 12).map((candidate) => `- ${candidate.alias} (${candidate.source}, score ${candidate.score})`),
    '',
  ]);

  return [
    '# RAG Alias Candidate Report',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Documents: ${report.summary.documentCount}`,
    `- Candidate count: ${report.summary.candidateCount}`,
    `- Curated alias target: ${report.summary.curatedAliasTargetPath}`,
    '',
    '## Source Counts',
    '',
    formatSourceCounts(report.summary.sourceCounts),
    '',
    '## Document Candidates',
    '',
    ...documentLines,
  ].join('\n');
}
