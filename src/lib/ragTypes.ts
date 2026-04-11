export type PromptMode = 'integrated' | 'evaluation';

export type QueryIntent = PromptMode | 'legal-exact' | 'manual-qna' | 'synthesis';

export type SourceType =
  | 'law'
  | 'ordinance'
  | 'rule'
  | 'notice'
  | 'manual'
  | 'qa'
  | 'guide'
  | 'wiki'
  | 'comparison'
  | 'other';

export type EvidenceState = 'confirmed' | 'partial' | 'conflict' | 'not_enough';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface KnowledgeFile {
  path: string;
  name: string;
  size: number;
  content: string;
}

export interface DocumentMetadata {
  documentId: string;
  title: string;
  fileName: string;
  path: string;
  mode: PromptMode;
  sourceType: SourceType;
  effectiveDate?: string;
  publishedDate?: string;
  documentGroup: string;
  articleHint?: string;
}

export interface StructuredSection {
  id: string;
  documentId: string;
  title: string;
  depth: number;
  path: string[];
  articleNo?: string;
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface StructuredChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  title: string;
  text: string;
  textPreview: string;
  searchText: string;
  mode: PromptMode;
  sourceType: SourceType;
  documentGroup: string;
  docTitle: string;
  fileName: string;
  path: string;
  effectiveDate?: string;
  publishedDate?: string;
  sectionPath: string[];
  articleNo?: string;
  matchedLabels: string[];
  chunkHash: string;
  embedding?: number[];
}

export interface SearchCandidate extends StructuredChunk {
  exactScore: number;
  lexicalScore: number;
  vectorScore: number;
  fusedScore: number;
  rerankScore: number;
  matchedTerms: string[];
}

export interface SearchRun {
  query: string;
  mode: PromptMode;
  intent: QueryIntent;
  confidence: ConfidenceLevel;
  exactCandidates: SearchCandidate[];
  lexicalCandidates: SearchCandidate[];
  vectorCandidates: SearchCandidate[];
  fusedCandidates: SearchCandidate[];
  evidence: SearchCandidate[];
}

export interface CompiledPage {
  id: string;
  pageType: 'document-summary' | 'issue-map' | 'comparison-card' | 'evaluation-card';
  title: string;
  mode: PromptMode;
  sourceDocumentIds: string[];
  backlinks: string[];
  summary: string;
  body: string;
  tags: string[];
}

export interface BenchmarkCase {
  id: string;
  mode: PromptMode;
  question: string;
  expectedDoc: string;
  expectedSection?: string;
  acceptableAbstain: boolean;
  notes?: string;
}

export interface GroundedAnswer {
  evidenceState: EvidenceState;
  confidence: ConfidenceLevel;
  keyIssueDate?: string;
  conclusion: string;
  directEvidence: string[];
  practicalGuidance: string[];
  caveats: string[];
  citationEvidenceIds: string[];
  followUpQuestion?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
