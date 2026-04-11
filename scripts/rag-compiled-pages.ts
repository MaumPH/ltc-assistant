import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { buildCompiledRows, loadKnowledgeFilesForIndex } from '../src/lib/nodeRagService';

dotenv.config();

async function main() {
  const projectRoot = process.cwd();
  const files = await loadKnowledgeFilesForIndex(projectRoot);
  const compiledRows = buildCompiledRows(files);
  const outputDir = path.join(projectRoot, '.rag-cache');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'compiled-pages.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        pages: compiledRows,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`Generated ${compiledRows.length} compiled pages.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
