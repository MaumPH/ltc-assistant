import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { NodeRagService, loadBenchmarkCases } from '../src/lib/nodeRagService';

dotenv.config();

async function main() {
  const projectRoot = process.cwd();
  const cases = loadBenchmarkCases(projectRoot);
  if (cases.length === 0) {
    throw new Error('No benchmark cases found in benchmarks/golden-cases.json');
  }

  const service = new NodeRagService(projectRoot);
  await service.initialize();

  const results = [];
  let top3Hits = 0;
  let top5Hits = 0;
  let abstainAccepts = 0;
  let expectedEvidenceHits = 0;
  let forbiddenEvidencePasses = 0;
  let requiredCitationHits = 0;
  let normalizationChecks = 0;
  let normalizationHits = 0;
  let intentChecks = 0;
  let intentHits = 0;
  let relationChecks = 0;
  let relationHits = 0;
  let validationChecks = 0;
  let validationHits = 0;
  let missingSlotChecks = 0;
  let missingSlotHits = 0;
  let riskChecks = 0;
  let riskHits = 0;
  let claimCoverageChecks = 0;
  let claimCoverageHits = 0;

  for (const testCase of cases) {
    const inspection = await service.inspectRetrieval(
      testCase.messages ?? testCase.question,
      testCase.mode,
      undefined,
      testCase.serviceScopes,
    );
    const top3 = inspection.search.fusedCandidates.slice(0, 3);
    const top5 = inspection.search.fusedCandidates.slice(0, 5);
    const top3Hit = top3.some((candidate) => candidate.docTitle.includes(testCase.expectedDoc));
    const top5Hit = top5.some((candidate) => candidate.docTitle.includes(testCase.expectedDoc));
    const abstained = inspection.search.confidence === 'low';
    const evidenceDocs = Array.from(new Set(inspection.search.evidence.map((candidate) => candidate.docTitle)));
    const evidencePaths = inspection.finalEvidenceDocuments;
    const matchesAnyEvidence = (needle: string) =>
      evidenceDocs.some((doc) => doc.includes(needle)) || evidencePaths.some((path) => path.includes(needle));
    const expectedEvidenceHit =
      !testCase.expectedEvidenceDocs || testCase.expectedEvidenceDocs.every((doc) => matchesAnyEvidence(doc));
    const forbiddenEvidencePass =
      !testCase.forbiddenEvidenceDocs || testCase.forbiddenEvidenceDocs.every((doc) => !matchesAnyEvidence(doc));
    const requiredCitationHit =
      !testCase.requiredCitationDocs || testCase.requiredCitationDocs.every((doc) => matchesAnyEvidence(doc));
    const validationCodes = inspection.validationIssues.map((issue) => issue.code);
    const relationCodes = inspection.semanticFrame.relationRequests.map((request) => request.relation);
    const missingCriticalSlots = inspection.semanticFrame.missingCriticalSlots;
    const normalizationPass =
      !testCase.expectedCanonicalTerms || testCase.expectedCanonicalTerms.length === 0
        ? null
        : testCase.expectedCanonicalTerms.every((term) => inspection.semanticFrame.canonicalTerms.includes(term));
    const intentPass = !testCase.expectedPrimaryIntent
      ? null
      : inspection.semanticFrame.primaryIntent === testCase.expectedPrimaryIntent;
    const relationPass =
      !testCase.expectedRelationRequests || testCase.expectedRelationRequests.length === 0
        ? null
        : testCase.expectedRelationRequests.every((relation) => relationCodes.includes(relation));
    const validationPass =
      !testCase.expectedValidationCodes || testCase.expectedValidationCodes.length === 0
        ? null
        : testCase.expectedValidationCodes.every((code) => validationCodes.includes(code));
    const missingSlotPass =
      !testCase.expectedMissingCriticalSlots || testCase.expectedMissingCriticalSlots.length === 0
        ? null
        : testCase.expectedMissingCriticalSlots.every((slot) => missingCriticalSlots.includes(slot));
    const riskPass = !testCase.expectedRiskLevel ? null : inspection.semanticFrame.riskLevel === testCase.expectedRiskLevel;
    const claimCoveragePass =
      typeof testCase.minSupportedClaims !== 'number' && typeof testCase.maxUnsupportedClaims !== 'number'
        ? null
        : (typeof testCase.minSupportedClaims !== 'number' ||
            inspection.claimCoverage.supportedClaims >= testCase.minSupportedClaims) &&
          (typeof testCase.maxUnsupportedClaims !== 'number' ||
            inspection.claimCoverage.unsupportedClaims <= testCase.maxUnsupportedClaims);

    if (top3Hit) top3Hits += 1;
    if (top5Hit) top5Hits += 1;
    if (abstained && testCase.acceptableAbstain) abstainAccepts += 1;
    if (expectedEvidenceHit) expectedEvidenceHits += 1;
    if (forbiddenEvidencePass) forbiddenEvidencePasses += 1;
    if (requiredCitationHit) requiredCitationHits += 1;
    if (normalizationPass !== null) {
      normalizationChecks += 1;
      if (normalizationPass) normalizationHits += 1;
    }
    if (intentPass !== null) {
      intentChecks += 1;
      if (intentPass) intentHits += 1;
    }
    if (relationPass !== null) {
      relationChecks += 1;
      if (relationPass) relationHits += 1;
    }
    if (validationPass !== null) {
      validationChecks += 1;
      if (validationPass) validationHits += 1;
    }
    if (missingSlotPass !== null) {
      missingSlotChecks += 1;
      if (missingSlotPass) missingSlotHits += 1;
    }
    if (riskPass !== null) {
      riskChecks += 1;
      if (riskPass) riskHits += 1;
    }
    if (claimCoveragePass !== null) {
      claimCoverageChecks += 1;
      if (claimCoveragePass) claimCoverageHits += 1;
    }

    results.push({
      id: testCase.id,
      question: testCase.question,
      expectedDoc: testCase.expectedDoc,
      normalizedQuery: inspection.normalizedQuery,
      parsedLawRefs: inspection.parsedLawRefs,
      fallbackTriggered: inspection.fallbackTriggered,
      fallbackSources: inspection.fallbackSources,
      ontologyHits: inspection.ontologyHits.map((hit) => ({
        entityId: hit.entityId,
        label: hit.label,
        score: hit.score,
        documentIds: hit.documentIds,
      })),
      top3Hit,
      top5Hit,
      abstained,
      confidence: inspection.search.confidence,
      expectedEvidenceHit,
      forbiddenEvidencePass,
      requiredCitationHit,
      normalizationPass,
      intentPass,
      relationPass,
      validationPass,
      missingSlotPass,
      riskPass,
      claimCoveragePass,
      semanticFrame: {
        primaryIntent: inspection.semanticFrame.primaryIntent,
        secondaryIntents: inspection.semanticFrame.secondaryIntents,
        riskLevel: inspection.semanticFrame.riskLevel,
        canonicalTerms: inspection.semanticFrame.canonicalTerms,
        relationRequests: relationCodes,
        missingCriticalSlots,
      },
      validationCodes,
      claimCoverage: inspection.claimCoverage,
      evidenceDocs,
      evidencePaths,
      top3: top3.map((candidate) => ({
        docTitle: candidate.docTitle,
        articleNo: candidate.articleNo,
        rerankScore: candidate.rerankScore,
      })),
      top5: top5.map((candidate) => ({
        docTitle: candidate.docTitle,
        articleNo: candidate.articleNo,
        rerankScore: candidate.rerankScore,
      })),
    });
  }

  const outputDir = path.join(projectRoot, 'benchmarks', 'results');
  fs.mkdirSync(outputDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    totalCases: cases.length,
    top3Recall: cases.length > 0 ? Number((top3Hits / cases.length).toFixed(4)) : 0,
    top5Recall: cases.length > 0 ? Number((top5Hits / cases.length).toFixed(4)) : 0,
    expectedEvidencePassRate: cases.length > 0 ? Number((expectedEvidenceHits / cases.length).toFixed(4)) : 0,
    forbiddenEvidencePassRate: cases.length > 0 ? Number((forbiddenEvidencePasses / cases.length).toFixed(4)) : 0,
    requiredCitationPassRate: cases.length > 0 ? Number((requiredCitationHits / cases.length).toFixed(4)) : 0,
    normalizationPassRate: normalizationChecks > 0 ? Number((normalizationHits / normalizationChecks).toFixed(4)) : null,
    intentPassRate: intentChecks > 0 ? Number((intentHits / intentChecks).toFixed(4)) : null,
    relationPassRate: relationChecks > 0 ? Number((relationHits / relationChecks).toFixed(4)) : null,
    validationSignalPassRate: validationChecks > 0 ? Number((validationHits / validationChecks).toFixed(4)) : null,
    missingCriticalSlotPassRate: missingSlotChecks > 0 ? Number((missingSlotHits / missingSlotChecks).toFixed(4)) : null,
    riskPassRate: riskChecks > 0 ? Number((riskHits / riskChecks).toFixed(4)) : null,
    claimCoveragePassRate: claimCoverageChecks > 0 ? Number((claimCoverageHits / claimCoverageChecks).toFixed(4)) : null,
    abstainAcceptRate: cases.filter((item) => item.acceptableAbstain).length > 0
      ? Number((abstainAccepts / cases.filter((item) => item.acceptableAbstain).length).toFixed(4))
      : null,
    results,
  };

  const outputPath = path.join(outputDir, `rag-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Saved benchmark results to ${outputPath}`);
  console.log(`Top-3 doc recall: ${(payload.top3Recall * 100).toFixed(1)}%`);
  console.log(`Top-5 doc recall: ${(payload.top5Recall * 100).toFixed(1)}%`);
  console.log(`Expected evidence pass: ${(payload.expectedEvidencePassRate * 100).toFixed(1)}%`);
  console.log(`Forbidden evidence pass: ${(payload.forbiddenEvidencePassRate * 100).toFixed(1)}%`);
  console.log(`Required citation pass: ${(payload.requiredCitationPassRate * 100).toFixed(1)}%`);
  if (payload.normalizationPassRate !== null) {
    console.log(`Normalization pass: ${(payload.normalizationPassRate * 100).toFixed(1)}%`);
  }
  if (payload.intentPassRate !== null) {
    console.log(`Intent pass: ${(payload.intentPassRate * 100).toFixed(1)}%`);
  }
  if (payload.relationPassRate !== null) {
    console.log(`Relation pass: ${(payload.relationPassRate * 100).toFixed(1)}%`);
  }
  if (payload.validationSignalPassRate !== null) {
    console.log(`Validation signal pass: ${(payload.validationSignalPassRate * 100).toFixed(1)}%`);
  }
  if (payload.missingCriticalSlotPassRate !== null) {
    console.log(`Missing critical slot pass: ${(payload.missingCriticalSlotPassRate * 100).toFixed(1)}%`);
  }
  if (payload.riskPassRate !== null) {
    console.log(`Risk pass: ${(payload.riskPassRate * 100).toFixed(1)}%`);
  }
  if (payload.claimCoveragePassRate !== null) {
    console.log(`Claim coverage pass: ${(payload.claimCoveragePassRate * 100).toFixed(1)}%`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
