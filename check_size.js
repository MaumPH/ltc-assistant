import fs from 'fs';
import path from 'path';

const knowledgeDir = path.join(process.cwd(), 'knowledge');
let totalSize = 0;

if (fs.existsSync(knowledgeDir)) {
  const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
    console.log(`${file}: ${stats.size} bytes`);
  }
}

console.log(`Total size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
