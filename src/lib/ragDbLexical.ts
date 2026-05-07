import { tokenize } from './ragMetadata';
import type { PromptMode, SourceRole } from './ragTypes';

const DEFAULT_DB_LEXICAL_TOP_K = 48;

export interface PostgresLexicalCandidateQueryInput {
  query: string;
  mode: PromptMode;
  allowedDocumentIds?: string[];
  excludedEvidenceRoles?: SourceRole[];
  limit?: number;
}

export interface PostgresLexicalCandidateQuery {
  sql: string;
  values: unknown[];
}

function normalizeLexicalTerms(query: string): string[] {
  return Array.from(new Set(tokenize(query).filter((term) => term.length >= 2))).slice(0, 16);
}

export function buildPostgresLexicalCandidateQuery(
  input: PostgresLexicalCandidateQueryInput,
): PostgresLexicalCandidateQuery {
  const terms = normalizeLexicalTerms(input.query);
  const phrasePattern = `%${input.query.trim().replace(/\s+/g, ' ')}%`;
  const values: unknown[] = [terms, phrasePattern];
  const conditions = ['c.id is not null'];

  if (input.mode === 'evaluation') {
    values.push(input.mode);
    conditions.push(`c.mode = $${values.length}`);
  }

  if (input.allowedDocumentIds && input.allowedDocumentIds.length > 0) {
    values.push(input.allowedDocumentIds);
    conditions.push(`c.document_id = any($${values.length}::text[])`);
  }

  if (input.excludedEvidenceRoles && input.excludedEvidenceRoles.length > 0) {
    values.push(input.excludedEvidenceRoles);
    conditions.push(`(c.source_role is null or not (c.source_role = any($${values.length}::text[])))`);
  }

  const limit = input.limit ?? DEFAULT_DB_LEXICAL_TOP_K;
  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  return {
    sql: `
      with lexical_terms as (
        select unnest($1::text[]) as term
      ),
      candidate_scores as (
        select
          c.id,
          (
            case when c.doc_title ilike $2 then 12 else 0 end +
            case when c.file_name ilike $2 then 8 else 0 end +
            case when c.title ilike $2 then 6 else 0 end +
            case when coalesce(c.article_no, '') ilike $2 then 10 else 0 end +
            coalesce(sum(
              case
                when c.doc_title ilike '%' || lt.term || '%' then 6
                when c.file_name ilike '%' || lt.term || '%' then 5
                when c.title ilike '%' || lt.term || '%' then 4
                when coalesce(c.article_no, '') ilike '%' || lt.term || '%' then 5
                when c.search_text ilike '%' || lt.term || '%' then 1
                else 0
              end
            ), 0)
          ) as lexical_score,
          coalesce(
            array_agg(distinct lt.term) filter (
              where
                c.doc_title ilike '%' || lt.term || '%' or
                c.file_name ilike '%' || lt.term || '%' or
                c.title ilike '%' || lt.term || '%' or
                coalesce(c.article_no, '') ilike '%' || lt.term || '%' or
                c.search_text ilike '%' || lt.term || '%'
            ),
            array[]::text[]
          ) as matched_terms
        from chunks c
        left join lexical_terms lt on true
        where ${conditions.join(' and ')}
        group by c.id
      )
      select id, lexical_score, matched_terms
      from candidate_scores
      where lexical_score > 0
      order by lexical_score desc, id asc
      limit ${limitPlaceholder}
    `,
    values,
  };
}
