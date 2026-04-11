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

  for (const testCase of cases) {
    const inspection = await service.inspectRetrieval(testCase.messages ?? testCase.question, testCase.mode);
    const top3 = inspection.search.fusedCandidates.slice(0, 3);
    const top5 = inspection.search.fusedCandidates.slice(0, 5);
    const top3Hit = top3.some((candidate) => candidate.docTitle.includes(testCase.expectedDoc));
    const top5Hit = top5.some((candidate) => candidate.docTitle.includes(testCase.expectedDoc));
    const abstained = inspection.search.confidence === 'low';
    if (top3Hit) top3Hits += 1;
    if (top5Hit) top5Hits += 1;
    if (abstained && testCase.acceptableAbstain) abstainAccepts += 1;

    results.push({
      id: testCase.id,
      question: testCase.question,
      expectedDoc: testCase.expectedDoc,
      normalizedQuery: inspection.normalizedQuery,
      top3Hit,
      top5Hit,
      abstained,
      confidence: inspection.search.confidence,
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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
