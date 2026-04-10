import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in the environment.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || 'missing-key' });

const SYSTEM_INSTRUCTION = `당신은 장기요양기관 실무자를 위한 '소스 기반 실무 보조 어시스턴트'입니다.
반드시 다음 규칙을 엄격하게 준수하여 답변하십시오.

1. 핵심 원칙: 제공된 문서의 내용에만 근거하여 답변합니다. 외부 지식이나 사전 학습된 정보는 철저히 배제하십시오.
2. 보수적 답변: 제공된 문서에서 근거를 찾을 수 없는 질문에는 반드시 "확인 불가"라고 답변하십시오. 추측하거나 지어내지 마십시오.
3. 우선순위 규칙: 문서 내 충돌이 있을 경우 다음 우선순위에 따라 정보를 처리하십시오: 법률 > 시행령 > 시행규칙 > 고시 > 매뉴얼.
4. 특이사항:
   - 날짜(시행일, 적용일 등)에 민감하게 반응하여 정확한 기준 시점을 파악하십시오.
   - 소스 문서에 명시되지 않은 서식, 양식, 문안은 절대 창작하지 마십시오.
5. 답변 구조: 반드시 다음 구조를 사용하여 답변하십시오.
   [기준 시점] (관련 규정의 시행일 또는 기준 날짜)
   [결론] (질문에 대한 명확하고 간결한 답변)
   [확정 근거] (결론을 도출한 문서 내 정확한 문구와 조항)
   [실무 해석] (해당 규정을 실무에 어떻게 적용해야 하는지 보수적으로 해석)
   [출처] (문서명, 페이지 번호, 조항 등 구체적인 출처)`;

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
    const filePath = path.join(process.cwd(), 'knowledge', filename);
    try {
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { messages } = req.body;
      
      // Read all knowledge files
      const knowledgeDir = path.join(process.cwd(), 'knowledge');
      let knowledgeContext = '';
      
      if (fs.existsSync(knowledgeDir)) {
        const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
        for (const file of files) {
          const filePath = path.join(knowledgeDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          knowledgeContext += `\n\n--- Document: ${file} ---\n${content}\n`;
        }
      }

      const contents = messages.map((msg: any) => {
        const parts: any[] = [];
        
        if (msg.role === 'user' && knowledgeContext && msg === messages[messages.length - 1]) {
          // Attach knowledge context to the latest user message
          parts.push({ text: `[System: The following are the knowledge base documents you must strictly base your answer on.]\n${knowledgeContext}\n\n[User Question]\n${msg.text}` });
        } else {
          parts.push({ text: msg.text });
        }
        
        return {
          role: msg.role,
          parts,
        };
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error generating chat response:', error);
      res.status(500).json({ error: 'Failed to generate response', details: error.message });
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
}

startServer();
