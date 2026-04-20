import * as dotenv from 'dotenv';
import { NodeRagService } from '../src/lib/nodeRagService';

dotenv.config();

async function main() {
  const service = new NodeRagService(process.cwd());
  await service.initialize();

  const requestedProfileIds = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
  const report = await service.runEvalTrial(requestedProfileIds.length > 0 ? requestedProfileIds : undefined);

  console.log(`Eval trial saved: ${report.outputPath}`);
  console.log(`Profiles: ${report.profileIds.join(', ')}`);
  console.log(`Cases: ${report.totalCases}`);
  console.log(`Top-3 recall: ${(report.top3Recall * 100).toFixed(1)}%`);
  console.log(`Top-5 recall: ${(report.top5Recall * 100).toFixed(1)}%`);
  console.log(`Expected evidence pass: ${(report.expectedEvidencePassRate * 100).toFixed(1)}%`);
  console.log(`Required citation pass: ${(report.requiredCitationPassRate * 100).toFixed(1)}%`);
  console.log(`Section hit rate: ${(report.sectionHitRate * 100).toFixed(1)}%`);
  console.log(`Primary-source priority: ${(report.primarySourcePriorityRate * 100).toFixed(1)}%`);
  if (report.abstainPrecision !== null) {
    console.log(`Abstain precision: ${(report.abstainPrecision * 100).toFixed(1)}%`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
