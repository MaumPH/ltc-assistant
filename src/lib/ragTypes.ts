import type { Category } from './knowledgeCategories';

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
  | 'evaluation'
  | 'other';

export type SourceRole = 'routing_summary' | 'primary_evaluation' | 'support_reference' | 'general';

export type EvidenceState = 'confirmed' | 'partial' | 'conflict' | 'not_enough';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type NaturalLanguageQueryType =
  | 'definition'
  | 'procedure'
  | 'checklist'
  | 'comparison'
  | 'requirement'
  | 'scope'
  | 'consequence'
  | 'exemption'
  | 'application';

export type SemanticPrimaryIntent =
  | 'eligibility'
  | 'compliance'
  | 'cost'
  | 'document'
  | 'workflow'
  | 'comparison'
  | 'definition'
  | 'exception'
  | 'sanction';

export type SemanticRiskLevel = 'low' | 'medium' | 'high';

export type SemanticSlotKey =
  | 'service_scope'
  | 'institution_type'
  | 'benefit_type'
  | 'recipient_grade'
  | 'actor_role'
  | 'document_type'
  | 'cost_topic'
  | 'time_scope'
  | 'legal_action'
  | 'exception_context';

export type OntologyConceptStatus = 'candidate' | 'validated' | 'promoted' | 'rejected';

export type OntologyRelationType =
  | 'alias-of'
  | 'requires'
  | 'eligible-for'
  | 'not-eligible-for'
  | 'applies-to'
  | 'not-applies-to'
  | 'belongs-to'
  | 'uses-document'
  | 'has-cost'
  | 'limited-by'
  | 'exception-of'
  | 'conflicts-with'
  | 'evidenced-by'
  | 'follows-step'
  | 'same-as';

export type RetrievalReadiness = 'lexical_only' | 'hybrid_partial' | 'hybrid_ready';

export type GenerationMode = 'user' | 'server';

export type RetrievalMode = 'local' | 'workflow-global' | 'drift-refine';

export type RetrievalPriorityClass =
  | 'legal_judgment'
  | 'evaluation_readiness'
  | 'operational_workflow'
  | 'document_lookup'
  | 'comparison_definition';

export type ExpertAnswerType = 'verdict' | 'checklist' | 'procedure' | 'comparison' | 'definition' | 'mixed';

export type BasisBucketKey = 'legal' | 'evaluation' | 'practical';

export type AgentDecision = 'answer' | 'abstain' | 'clarify';

export type BackendReadinessStatus = 'ready' | 'degraded' | 'disabled' | 'unavailable';

export type BackendReadinessKey = 'pgvector' | 'elasticsearch' | 'redis' | 'parser' | 'reranker' | 'queue';

export interface QueryNormalizationTraceEntry {
  step: string;
  detail: string;
}

export interface RetrievalFeatureFlags {
  queryRewrite: boolean;
  queryClarification: boolean;
  hyde: boolean;
  decompose: boolean;
  sectionRouting: boolean;
  reranker: boolean;
  cache: boolean;
  guardrails: boolean;
  externalElasticsearch: boolean;
}

export interface RetrievalWeightProfile {
  lexical: number;
  vector: number;
  rerank: number;
  section: number;
}

export interface RetrievalProfile {
  id: string;
  label: string;
  description: string;
  queryProcessing: {
    rewrite: boolean;
    clarify: boolean;
    hyde: boolean;
    decompose: boolean;
  };
  retrieval: {
    sectionRouting: boolean;
    reranker: boolean;
    externalElasticsearch: boolean;
    scopeBoosts: boolean;
  };
  guardrails: {
    piiMasking: boolean;
    promptInjection: boolean;
    citationWarning: boolean;
    hallucinationSignal: boolean;
    abstainOnLowConfidence: boolean;
  };
  cache: {
    normalization: boolean;
    hyde: boolean;
    retrieval: boolean;
    answer: boolean;
    fallback: boolean;
  };
  weights: RetrievalWeightProfile;
}

export interface BackendReadinessItem {
  name: BackendReadinessKey;
  status: BackendReadinessStatus;
  enabled: boolean;
  detail: string;
  checkedAt?: string;
  latencyMs?: number;
  backlog?: number;
}

export interface BackendReadiness {
  pgvector: BackendReadinessItem;
  elasticsearch: BackendReadinessItem;
  redis: BackendReadinessItem;
  parser: BackendReadinessItem;
  reranker: BackendReadinessItem;
  queue: BackendReadinessItem;
}

export interface WorkerQueueStatus {
  pending: number;
  running: number;
  lastStartedAt?: string;
  lastCompletedAt?: string;
  lastError?: string;
}

export interface CacheHitSummary {
  normalization: boolean;
  hyde: boolean;
  retrieval: boolean;
  fallback: boolean;
  answer: boolean;
}

export interface GuardrailResult {
  type: 'pii' | 'prompt_injection' | 'citation_warning' | 'hallucination_signal';
  severity: 'info' | 'warning' | 'block';
  triggered: boolean;
  detail: string;
}

export interface SectionRoutingDecision {
  enabled: boolean;
  strategy: 'document_to_section' | 'chunk_only';
  selectedSectionIds: string[];
  selectedSectionTitles: string[];
  selectedDocumentIds: string[];
  detail: string;
}

export interface StageLatencyBreakdown {
  queryNormalizationMs: number;
  cacheLookupMs: number;
  hydeMs: number;
  retrievalMs: number;
  fallbackMs: number;
  planningMs: number;
  answerMs: number;
  totalMs: number;
}

export interface LawAliasResolution {
  canonical: string;
  alias: string;
  matchedAlias?: string;
  alternatives: string[];
}

export interface ParsedLawReference {
  raw: string;
  canonicalLawName: string;
  article?: string;
  jo?: string;
  clause?: string;
  item?: string;
  subItem?: string;
  matchedAlias?: string;
}

export interface SemanticSlotValue {
  value: string;
  canonical: string;
  confidence: number;
  source: 'query' | 'heuristic' | 'lexicon' | 'ontology';
  entityType?: string;
  status?: Exclude<OntologyConceptStatus, 'rejected'>;
}

export interface SemanticEntityRef {
  label: string;
  canonical: string;
  entityType: string;
  confidence: number;
  source: 'query' | 'heuristic' | 'lexicon' | 'ontology' | 'brain';
  status?: Exclude<OntologyConceptStatus, 'rejected'>;
}

export interface SemanticRelationRequest {
  relation: OntologyRelationType;
  weight: number;
  reason: string;
  source: 'intent' | 'slot' | 'entity';
}

export interface SemanticFrame {
  primaryIntent: SemanticPrimaryIntent;
  secondaryIntents: SemanticPrimaryIntent[];
  canonicalTerms: string[];
  entityRefs: SemanticEntityRef[];
  relationRequests: SemanticRelationRequest[];
  slots: Partial<Record<SemanticSlotKey, SemanticSlotValue[]>>;
  assumptions: string[];
  missingCriticalSlots: SemanticSlotKey[];
  riskLevel: SemanticRiskLevel;
}

export interface NaturalLanguageQueryProfile {
  originalQuery: string;
  normalizedQuery: string;
  queryType: NaturalLanguageQueryType;
  aliasResolutions: LawAliasResolution[];
  parsedLawRefs: ParsedLawReference[];
  synonymExpansions: string[];
  searchVariants: string[];
  normalizationTrace: QueryNormalizationTraceEntry[];
  semanticFrame: SemanticFrame;
}

export interface OntologyEntity {
  id: string;
  entityType: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface OntologyAlias {
  id: string;
  entityId: string;
  alias: string;
  aliasType: string;
  weight: number;
}

export interface OntologyEdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relation: OntologyRelationType | string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface OntologyHit {
  entityId: string;
  label: string;
  entityType: string;
  matchedAlias?: string;
  score: number;
  documentIds: string[];
  depth: number;
  status?: Exclude<OntologyConceptStatus, 'rejected'>;
}

export interface GraphExpansionTrace {
  anchorEntityIds: string[];
  expandedEntityIds: string[];
  boostedDocumentPaths: string[];
  depth: number;
}

export interface LawFallbackSource {
  source: string;
  title: string;
  query: string;
  cached: boolean;
  url?: string;
}

export interface KnowledgeFile {
  path: string;
  name: string;
  size: number;
  content: string;
  updatedAt?: string;
  nulStripped?: boolean;
}

export interface KnowledgeListEntry {
  path: string;
  name: string;
  size: number;
  updatedAt?: string;
  mode: PromptMode;
}

export interface DocumentMetadata {
  documentId: string;
  title: string;
  fileName: string;
  path: string;
  mode: PromptMode;
  sourceType: SourceType;
  sourceRole: SourceRole;
  effectiveDate?: string;
  publishedDate?: string;
  documentGroup: string;
  articleHint?: string;
  linkedDocumentTitles: string[];
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
  sourceRole: SourceRole;
  documentGroup: string;
  docTitle: string;
  fileName: string;
  path: string;
  effectiveDate?: string;
  publishedDate?: string;
  sectionPath: string[];
  headingPath?: string[];
  articleNo?: string;
  matchedLabels: string[];
  chunkHash: string;
  parentSectionId: string;
  parentSectionTitle: string;
  listGroupId?: string;
  containsCheckList?: boolean;
  embeddingInput?: string;
  windowIndex: number;
  spanStart: number;
  spanEnd: number;
  citationGroupId: string;
  linkedDocumentTitles: string[];
  embedding?: number[];
}

export interface SearchCandidate extends StructuredChunk {
  exactScore: number;
  lexicalScore: number;
  vectorScore: number;
  fusedScore: number;
  rerankScore: number;
  headingScore?: number;
  ontologyScore: number;
  matchedTerms: string[];
}

export interface RetrievalStageTrace {
  stage:
    | 'query_normalization'
    | 'hyde_context'
    | 'lexical_candidates'
    | 'vector_candidates'
    | 'section_routing'
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

export interface ClaimPlanItem {
  id: string;
  claimType: SemanticPrimaryIntent | 'workflow_step' | 'assumption';
  canonicalSubject: string;
  predicate: string;
  object?: string;
  requiredEvidenceTypes: string[];
  supportAnchors: string[];
  supportBucketHints: BasisBucketKey[];
  supportingEvidenceIds: string[];
  assumptions: string[];
}

export interface ClaimPlan {
  claims: ClaimPlanItem[];
}

export type ClaimCoverageStatus = 'supported' | 'partial' | 'unsupported';

export interface ClaimCoverageDetail {
  claimId: string;
  status: ClaimCoverageStatus;
  evidenceIds: string[];
}

export interface ClaimCoverage {
  totalClaims: number;
  supportedClaims: number;
  partiallySupportedClaims: number;
  unsupportedClaims: number;
  details: ClaimCoverageDetail[];
}

export interface ValidationIssue {
  code:
    | 'unsupported-claim'
    | 'stale-priority'
    | 'mixed-service-scope'
    | 'grade-benefit-mismatch'
    | 'institution-scope-mismatch'
    | 'ungrounded-cost-number'
    | 'missing-exception'
    | 'basis-confusion'
    | 'insufficient-evidence-composition';
  severity: 'info' | 'warning' | 'block';
  message: string;
  claimId?: string;
  evidenceIds?: string[];
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

export interface ExpertBasisEntry {
  label: string;
  summary: string;
  citationIds: string[];
}

export interface ExpertBasisBuckets {
  legal: ExpertBasisEntry[];
  evaluation: ExpertBasisEntry[];
  practical: ExpertBasisEntry[];
}

export interface GroundedBasisEntry {
  label: string;
  quote: string;
  explanation: string;
  citationIds: string[];
}

export interface GroundedBasisBuckets {
  legal: GroundedBasisEntry[];
  evaluation: GroundedBasisEntry[];
  practical: GroundedBasisEntry[];
}

export interface EvidenceBalance {
  legal: number;
  evaluation: number;
  practical: number;
  missingBuckets: BasisBucketKey[];
  balanced: boolean;
}

export interface ExpertAnswerBlockItem {
  label: string;
  detail: string;
  actor?: string;
  timeWindow?: string;
  artifact?: string;
  basis?: BasisBucketKey;
  citationIds?: string[];
  side?: string;
  term?: string;
}

export interface ExpertAnswerBlock {
  type: 'checklist' | 'steps' | 'comparison' | 'bullets' | 'warning' | 'definition' | 'followup';
  title: string;
  intro?: string;
  items: ExpertAnswerBlockItem[];
}

export interface ExpertAnswerCitation {
  evidenceId: string;
  label: string;
  docTitle: string;
  articleNo?: string;
  sectionPath: string[];
  effectiveDate?: string;
  whyItMatters?: string;
}

export interface ExpertAnswerEnvelope {
  answerType: ExpertAnswerType;
  headline: string;
  summary: string;
  directAnswer?: string;
  confidence: ConfidenceLevel;
  evidenceState: EvidenceState;
  keyIssueDate?: string;
  referenceDate: string;
  conclusion: string;
  groundedBasis: GroundedBasisBuckets;
  practicalInterpretation: ExpertAnswerBlockItem[];
  additionalChecks: ExpertAnswerBlockItem[];
  appliedScope: string;
  scope: string;
  basis: ExpertBasisBuckets;
  blocks: ExpertAnswerBlock[];
  citations: ExpertAnswerCitation[];
  followUps: string[];
}

export interface AnswerPlanTaskCandidate {
  title: string;
  actor?: string;
  timeWindow?: string;
  artifact?: string;
  basis: BasisBucketKey;
  note: string;
}

export interface PlannerTraceEntry {
  step: string;
  detail: string;
}

export interface AnswerPlan {
  questionArchetype: string;
  selectedRetrievalMode: RetrievalMode;
  intentSummary: string;
  workflowEvents: string[];
  taskCandidates: AnswerPlanTaskCandidate[];
  basisBuckets: Record<BasisBucketKey, string[]>;
  missingDimensions: string[];
  selectedEvidenceIds: string[];
  recommendedAnswerType: ExpertAnswerType;
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
  expectedEvidenceDocs?: string[];
  forbiddenEvidenceDocs?: string[];
  requiredCitationDocs?: string[];
  serviceScopes?: ServiceScopeId[];
  expectedPrimaryIntent?: SemanticPrimaryIntent;
  expectedCanonicalTerms?: string[];
  expectedRelationRequests?: OntologyRelationType[];
  expectedValidationCodes?: ValidationIssue['code'][];
  forbiddenValidationCodes?: ValidationIssue['code'][];
  expectedMissingCriticalSlots?: SemanticSlotKey[];
  expectedRiskLevel?: SemanticRiskLevel;
  minSupportedClaims?: number;
  maxUnsupportedClaims?: number;
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
  serviceScopes?: ServiceScopeId[];
}

export type ServiceScopeId =
  | 'all'
  | 'facility-care'
  | 'day-night-care'
  | 'short-term-care'
  | 'home-visit-care'
  | 'home-visit-bath'
  | 'home-visit-nursing'
  | 'integrated-home-care'
  | 'welfare-equipment';

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
  backendReadiness?: BackendReadiness;
  queue?: WorkerQueueStatus;
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
  sourceRole: SourceRole;
  rerankScore: number;
  matchedTerms: string[];
  focusTermMatches: string[];
  selectedAsEvidence: boolean;
  routeOnly: boolean;
  expandedFromRouting: boolean;
  primaryExpansionHit: boolean;
  matchedOnlyGenericTerms: boolean;
  rejectionReasons: string[];
  citationGroupId: string;
  parentSectionId: string;
  windowIndex: number;
}

export interface RetrievalDiagnostics {
  normalizedQuery: string;
  querySources: string[];
  profile: RetrievalProfile;
  retrievalPriorityClass: RetrievalPriorityClass;
  priorityPolicyName: string;
  selectedServiceScopes: ServiceScopeId[];
  serviceScopeLabels: string[];
  matchedDocumentPaths: string[];
  candidateDiagnostics: CandidateDiagnostic[];
  focusTerms: string[];
  mismatchSignals: string[];
  groundingGatePassed: boolean;
  stageTrace: RetrievalStageTrace[];
  retrievalReadiness: RetrievalReadiness;
  hybridReadinessReason: string;
  evidenceBalance: EvidenceBalance;
  agentDecision: AgentDecision;
  neighborWindows: ChunkWindowRef[];
  rejectionReasons: Array<{ candidateId: string; reasons: string[] }>;
  routingDocuments: string[];
  primaryExpansionDocuments: string[];
  finalEvidenceDocuments: string[];
  selectedRetrievalMode: RetrievalMode;
  workflowEventsHit: string[];
  subquestions: string[];
  basisCoverage: Record<BasisBucketKey, number>;
  plannerTrace: PlannerTraceEntry[];
  normalizationTrace: QueryNormalizationTraceEntry[];
  aliasResolutions: LawAliasResolution[];
  parsedLawRefs: ParsedLawReference[];
  semanticFrame: SemanticFrame;
  assumptions: string[];
  ontologyHits: OntologyHit[];
  usedPromotedConcepts: string[];
  usedValidatedConcepts: string[];
  graphExpansionTrace: GraphExpansionTrace[];
  validationIssues: ValidationIssue[];
  claimCoverage: ClaimCoverage;
  fallbackTriggered: boolean;
  fallbackSources: LawFallbackSource[];
  guardrails: GuardrailResult[];
  latency: StageLatencyBreakdown;
  sectionRouting: SectionRoutingDecision;
  cacheHits: CacheHitSummary;
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
  initializing?: boolean;
  degraded?: boolean;
  message?: string;
  activeProfileId?: string;
  availableProfiles?: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  featureFlags?: RetrievalFeatureFlags;
  backendReadiness?: BackendReadiness;
  supportedModels: Array<{
    id: string;
    label: string;
  }>;
}

export interface AdminProfilesResponse {
  activeProfileId: string;
  profiles: RetrievalProfile[];
  featureFlags: RetrievalFeatureFlags;
  updatedAt: string;
}

export interface AdminHealthResponse {
  activeProfileId: string;
  backendReadiness: BackendReadiness;
  queue: WorkerQueueStatus;
  indexStatus: IndexStatus;
  featureFlags: RetrievalFeatureFlags;
}

export interface AdminReindexResponse {
  accepted: boolean;
  queue: WorkerQueueStatus;
}

export interface EvalTrialCaseResult {
  id: string;
  top3Hit: boolean;
  top5Hit: boolean;
  expectedEvidenceHit: boolean;
  forbiddenEvidencePass: boolean;
  requiredCitationHit: boolean;
  sectionHit: boolean;
  primarySourcePriority: boolean;
  citationUniqueness: number;
  abstainAccepted: boolean | null;
  selectedProfileId: string;
  latencyMs: number;
}

export interface EvalTrialSummary {
  id: string;
  createdAt: string;
  profileIds: string[];
  totalCases: number;
  top3Recall: number;
  top5Recall: number;
  expectedEvidencePassRate: number;
  forbiddenEvidencePassRate: number;
  requiredCitationPassRate: number;
  sectionHitRate: number;
  primarySourcePriorityRate: number;
  avgCitationUniqueness: number;
  abstainPrecision: number | null;
  outputPath: string;
}

export interface EvalTrialReport extends EvalTrialSummary {
  results: EvalTrialCaseResult[];
}

export interface KnowledgeCategoryCount {
  category: Category;
  count: number;
}

export interface HomeOverviewResponse {
  knowledgeDocumentCount: number;
  knowledgeCategoryCounts: KnowledgeCategoryCount[];
  chunkCount: number;
  compiledPageCount: number;
  retrievalReadiness: RetrievalReadiness;
  pendingEmbeddingChunks: number;
  storageMode: string;
  indexGeneratedAt?: string;
  latestKnowledgeUpdatedAt?: string;
}
