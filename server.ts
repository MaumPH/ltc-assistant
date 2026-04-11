import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import { loadKnowledgeCorporaFromDisk } from './src/lib/nodeKnowledge';
import { loadPromptSourceSet } from './src/lib/nodePrompts';
import { buildVariantSystemInstruction, type PromptVariant } from './src/lib/promptAssembly';
import { searchKnowledge, chunksToContext, getAllChunks, type PromptMode, type Chunk } from './src/lib/ragCore';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in the environment.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || 'missing-key' });
const PROJECT_ROOT = process.cwd();
const KNOWLEDGE_CORPORA = loadKnowledgeCorporaFromDisk(PROJECT_ROOT);
const PROMPT_SOURCES = loadPromptSourceSet(PROJECT_ROOT);

// ── 요청 큐 (분당 30회 이하 보장) ──────────────────────────────────────────
const requestQueue: Array<() => Promise<void>> = [];
let queueRunning = false;
const QUEUE_INTERVAL_MS = 2000;

async function enqueueRequest(task: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try { await task(); resolve(); }
      catch (err) { reject(err); }
    });
    if (!queueRunning) void drainQueue();
  });
}

async function drainQueue() {
  queueRunning = true;
  while (requestQueue.length > 0) {
    await requestQueue.shift()!();
    if (requestQueue.length > 0) await new Promise(r => setTimeout(r, QUEUE_INTERVAL_MS));
  }
  queueRunning = false;
}

// ── 임베딩 캐시 + 2단계 재순위 ───────────────────────────────────────────────
interface EmbeddedChunk extends Chunk { embedding: number[] }
let embeddedChunks: EmbeddedChunk[] = [];

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

async function rerankWithEmbeddings(candidates: Chunk[], query: string, topK = 8): Promise<Chunk[]> {
  if (embeddedChunks.length === 0) return candidates.slice(0, topK);
  try {
    const qRes = await ai.models.embedContent({ model: 'text-embedding-004', contents: query });
    const qVec = qRes.embeddings[0].values;
    return candidates
      .map(chunk => {
        const ec = embeddedChunks.find(e => e.file === chunk.file && e.text === chunk.text);
        return { ...chunk, score: ec ? cosineSimilarity(qVec, ec.embedding) : 0 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ file, text }) => ({ file, text }));
  } catch {
    return candidates.slice(0, topK);
  }
}

async function precomputeEmbeddings(): Promise<void> {
  const chunks = getAllChunks(KNOWLEDGE_CORPORA.integrated);
  const BATCH = 20;
  const results: EmbeddedChunk[] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    try {
      const responses = await Promise.all(
        batch.map(c => ai.models.embedContent({ model: 'text-embedding-004', contents: c.text }))
      );
      for (let j = 0; j < batch.length; j++) {
        results.push({ ...batch[j], embedding: responses[j].embeddings[0].values });
      }
    } catch {
      console.warn(`[embedding] 배치 ${i}~${i + BATCH} 실패, 건너뜁니다.`);
    }
  }
  embeddedChunks = results;
  console.log(`[embedding] 완료: ${results.length}/${chunks.length}개 청크`);
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.get('/api/knowledge', (req, res) => {
    const knowledgeDir = path.join(process.cwd(), 'knowledge');
    try {
      if (!fs.existsSync(knowledgeDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(knowledgeDir);
      const fileStats = files.map(file => {
        const filePath = path.join(knowledgeDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          updatedAt: stats.mtime
        };
      }).filter(f => !f.name.startsWith('.')); // filter out hidden files
      res.json(fileStats);
    } catch (error) {
      console.error('Error reading knowledge dir:', error);
      res.status(500).json({ error: 'Failed to read knowledge directory' });
    }
  });

  app.get('/api/knowledge/:filename', (req, res) => {
    const filename = req.params.filename;

    // 레이어 1: 경로 구분자 및 상위 이동 문자 즉시 거부
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    // 레이어 2: .md/.txt 외 확장자 차단
    if (!/\.(md|txt)$/i.test(filename)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }
    // 레이어 3: resolve 후 knowledge/ 디렉토리 밖인지 이중 확인
    const knowledgeDir = path.resolve(PROJECT_ROOT, 'knowledge');
    const filePath = path.resolve(knowledgeDir, filename);
    if (!filePath.startsWith(knowledgeDir + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const {
        messages,
        mode = 'integrated',
        model = 'gemini-3-flash-preview',
        promptVariant = 'v2',
      }: {
        messages?: ChatMessage[];
        mode?: PromptMode;
        model?: string;
        promptVariant?: PromptVariant;
      } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages must be a non-empty array' });
      }

      // 히스토리 최근 2턴(4메시지)만 사용
      const recentMessages = messages.slice(-4);
      const latestUserMessage = [...recentMessages].reverse().find(msg => msg.role === 'user')?.text ?? '';
      const files = KNOWLEDGE_CORPORA[mode] || KNOWLEDGE_CORPORA.integrated;

      // 2단계 검색: TF-IDF(30) → 임베딩 재순위(8)
      const candidates = latestUserMessage ? searchKnowledge(files, latestUserMessage, 30) : [];
      const topChunks = candidates.length > 0 ? await rerankWithEmbeddings(candidates, latestUserMessage, 8) : [];

      // 명시적 토큰 예산: 최대 20,000자
      const MAX_CONTEXT_CHARS = 20_000;
      let contextChars = 0;
      const budgetedChunks = topChunks.filter(c => {
        if (contextChars + c.text.length > MAX_CONTEXT_CHARS) return false;
        contextChars += c.text.length;
        return true;
      });

      const knowledgeContext = chunksToContext(budgetedChunks);
      const systemInstruction = buildVariantSystemInstruction({
        mode,
        variant: promptVariant,
        knowledgeContext,
        sources: PROMPT_SOURCES,
      });

      const contents = recentMessages.map((msg: ChatMessage) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      }));

      await enqueueRequest(async () => {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction, temperature: 0.1 },
        });
        res.json({ text: response.text });
      });
    } catch (error: unknown) {
      console.error('Error generating chat response:', error);
      const message = (error as { message?: string })?.message ?? '';
      const is429 = message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota');
      if (is429) {
        const delayMatch = message.match(/retry.*?(\d+)s/i) || message.match(/"retryDelay":"(\d+)s"/);
        if (delayMatch) res.setHeader('Retry-After', delayMatch[1]);
        return res.status(429).json({ error: '분당 토큰 한도를 초과했습니다.', details: message });
      }
      res.status(500).json({ error: 'Failed to generate response', details: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // 백그라운드에서 임베딩 사전계산 (서버 시작을 블로킹하지 않음)
  void precomputeEmbeddings();
}

startServer();
