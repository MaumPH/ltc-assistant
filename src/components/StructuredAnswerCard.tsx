import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { ParsedStructuredAnswer, StructuredAnswerSectionKey } from '../lib/structuredAnswer';

interface StructuredAnswerCardProps {
  answer: ParsedStructuredAnswer;
}

const DETAIL_SECTION_CONFIG: Array<{
  key: StructuredAnswerSectionKey;
  title: string;
  className?: string;
}> = [
  {
    key: '확정 근거',
    title: '확정 근거',
    className: 'md:col-span-2',
  },
  {
    key: '실무 해석/운영 참고',
    title: '실무 해석/운영 참고',
  },
  {
    key: '예외·주의 및 추가 확인사항',
    title: '예외·주의 및 추가 확인사항',
  },
  {
    key: '출처',
    title: '출처',
    className: 'md:col-span-2',
  },
];

function getStatusStyles(status: string): string {
  switch (status.trim()) {
    case '확정':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    case '부분확정':
      return 'border-amber-200 bg-amber-100 text-amber-800';
    case '충돌':
      return 'border-rose-200 bg-rose-100 text-rose-800';
    case '확인 불가':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function MarkdownSection({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="text-sm leading-6 text-slate-500">내용이 없습니다.</p>;
  }

  return (
    <div className="structured-answer-markdown prose prose-sm max-w-none break-words prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-blue-600 md:prose-base">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

function DetailCard({
  title,
  content,
  className,
}: {
  title: string;
  content: string;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className ?? ''}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
      </div>
      <MarkdownSection content={content} />
    </section>
  );
}

export default function StructuredAnswerCard({ answer }: StructuredAnswerCardProps) {
  const status = answer.sections['답변 가능 상태'];
  const keyIssueDate = answer.sections['기준 시점'];
  const conclusion = answer.sections['결론'];

  return (
    <article className="w-full overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(239,246,255,1))] px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">구조화 답변</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyles(status)}`}>
            {status || '상태 미기재'}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {keyIssueDate || '기준 시점 없음'}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <section className="rounded-3xl border border-blue-200 bg-blue-50/80 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">결론</h2>
          </div>
          <MarkdownSection content={conclusion} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {DETAIL_SECTION_CONFIG.map((section) => (
            <DetailCard
              key={section.key}
              title={section.title}
              content={answer.sections[section.key]}
              className={section.className}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
