import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { buildKnowledgeDoctorIssues, buildKnowledgeManifest } from '../src/lib/ragIndex';
import { loadKnowledgeCorporaFromDisk } from '../src/lib/nodeKnowledge';
import { buildStructuredChunks } from '../src/lib/ragStructured';

dotenv.config();

async function main() {
  const projectRoot = process.cwd();
  const corpora = loadKnowledgeCorporaFromDisk(projectRoot);
  const files = Array.from(new Map([...corpora.integrated, ...corpora.evaluation].map((file) => [file.path, file])).values());
  const chunks = buildStructuredChunks(files);
  const manifestEntries = buildKnowledgeManifest(files, chunks);
  const issues = buildKnowledgeDoctorIssues(files, chunks);

  const payload = {
    generatedAt: new Date().toISOString(),
    documentCount: manifestEntries.length,
    chunkCount: chunks.length,
    issues,
  };

  const cacheDir = path.join(projectRoot, '.rag-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const outputPath = path.join(cacheDir, 'rag-doctor.json');
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Saved doctor report to ${outputPath}`);
  console.log(`Documents: ${manifestEntries.length}`);
  console.log(`Chunks: ${chunks.length}`);
  console.log(`Issues: ${issues.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
