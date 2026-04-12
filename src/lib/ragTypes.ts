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

export type RetrievalReadiness = 'lexical_only' | 'hybrid_partial' | 'hybrid_ready';

export type GenerationMode = 'user' | 'server';

export interface KnowledgeFile {
  path: string;
  name: string;
  size: number;
  content: string;
  updatedAt?: string;
  nulStripped?: boolean;
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
  parentSectionId: string;
  parentSectionTitle: string;
  windowIndex: number;
  spanStart: number;
  spanEnd: number;
  citationGroupId: string;
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

export interface RetrievalStageTrace {
  stage:
    | 'query_normalization'
    | 'lexical_candidates'
    | 'vector_candidates'
    | 'fusion'
    | 'document_diversification'
    | 'answer_evidence_gate';
  inputCount: number;
  outputCount: number;
  notes?: string[];
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
  focusTerms?: string[];
  mismatchSignals?: string[];
  groundingGatePassed?: boolean;
  stageTrace?: RetrievalStageTrace[];
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
  messages?: ChatMessage[];
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

export interface IndexManifestEntry {
  documentId: string;
  path: string;
  name: string;
  mode: PromptMode;
  contentHash: string;
  size: number;
  updatedAt?: string;
  chunkCount: number;
  embeddingCount: number;
}

export interface EmbeddingCoverage {
  embeddedChunks: number;
  totalChunks: number;
  ratio: number;
}

export interface KnowledgeDoctorIssue {
  code:
    | 'nul-stripped'
    | 'empty-document'
    | 'oversized-section'
    | 'duplicate-content'
    | 'zero-chunks';
  path: string;
  severity: 'warning';
  message: string;
}

export interface IndexStatus {
  state: 'fresh' | 'stale' | 'partial_embeddings';
  storageMode: string;
  manifestHash: string;
  diskManifestHash: string;
  indexedManifestHash: string;
  diskDocumentCount: number;
  indexedDocumentCount: number;
  chunkCount: number;
  staleDocuments: string[];
  missingDocuments: string[];
  orphanedDocuments: string[];
  embeddingCoverage: EmbeddingCoverage;
  retrievalReadiness: RetrievalReadiness;
  pendingEmbeddingChunks: number;
  nextEmbeddingRetryAt?: string;
  generatedAt?: string;
  modeCounts: Record<PromptMode, number>;
  issues: KnowledgeDoctorIssue[];
}

export interface ChunkWindowRef {
  id: string;
  documentId: string;
  path: string;
  docTitle: string;
  articleNo?: string;
  sectionPath: string[];
  parentSectionId: string;
  parentSectionTitle: string;
  windowIndex: number;
  spanStart: number;
  spanEnd: number;
  relation: 'previous' | 'current' | 'next';
  selectedAsEvidence: boolean;
}

export interface CandidateDiagnostic {
  id: string;
  path: string;
  docTitle: string;
  rerankScore: number;
  matchedTerms: string[];
  focusTermMatches: string[];
  selectedAsEvidence: boolean;
  matchedOnlyGenericTerms: boolean;
  rejectionReasons: string[];
  citationGroupId: string;
  parentSectionId: string;
  windowIndex: number;
}

export interface RetrievalDiagnostics {
  normalizedQuery: string;
  querySources: string[];
  matchedDocumentPaths: string[];
  candidateDiagnostics: CandidateDiagnostic[];
  focusTerms: string[];
  mismatchSignals: string[];
  groundingGatePassed: boolean;
  stageTrace: RetrievalStageTrace[];
  retrievalReadiness: RetrievalReadiness;
  neighborWindows: ChunkWindowRef[];
  rejectionReasons: Array<{ candidateId: string; reasons: string[] }>;
}

export interface RecentRetrievalMatch {
  query: string;
  normalizedQuery: string;
  rank: number | null;
  inEvidence: boolean;
  matchedAt: string;
}

export interface DocumentDiagnostics {
  path: string;
  existsOnDisk: boolean;
  indexed: boolean;
  mode?: PromptMode;
  contentHash?: string;
  size?: number;
  updatedAt?: string;
  chunkCount: number;
  embeddingCount: number;
  embeddingCoverage: EmbeddingCoverage;
  indexState: 'fresh' | 'stale' | 'missing';
  issues: KnowledgeDoctorIssue[];
  recentRetrieval: RecentRetrievalMatch | null;
}

export interface ChatCapabilities {
  generationMode: GenerationMode;
  requiresUserGenerationKey: boolean;
  serverEmbeddingReady: boolean;
  retrievalReadiness: RetrievalReadiness;
  supportedModels: Array<{
    id: string;
    label: string;
  }>;
}
