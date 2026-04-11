create extension if not exists vector;

create table if not exists documents (
  id text primary key,
  title text not null,
  file_name text not null,
  path text not null unique,
  mode text not null,
  source_type text not null,
  document_group text not null,
  effective_date date,
  published_date date,
  created_at timestamptz not null default now()
);

create table if not exists document_versions (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  version_hash text not null,
  raw_content text not null,
  created_at timestamptz not null default now()
);

create table if not exists sections (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  title text not null,
  depth integer not null,
  section_path jsonb not null,
  article_no text,
  line_start integer,
  line_end integer,
  content text not null
);

create table if not exists chunks (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  chunk_index integer not null,
  title text not null,
  text text not null,
  search_text text not null,
  mode text not null,
  source_type text not null,
  document_group text not null,
  doc_title text not null,
  file_name text not null,
  path text not null,
  effective_date date,
  published_date date,
  section_path jsonb not null,
  article_no text,
  matched_labels jsonb not null default '[]'::jsonb,
  chunk_hash text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists chunks_mode_idx on chunks(mode);
create index if not exists chunks_doc_title_idx on chunks(doc_title);
create index if not exists chunks_article_idx on chunks(article_no);
create index if not exists chunks_effective_date_idx on chunks(effective_date desc);
create index if not exists chunks_embedding_ivfflat_idx on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists compiled_pages (
  id text primary key,
  page_type text not null,
  title text not null,
  mode text not null,
  source_document_ids jsonb not null,
  backlinks jsonb not null,
  summary text not null,
  body text not null,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists benchmark_cases (
  id text primary key,
  mode text not null,
  question text not null,
  expected_doc text not null,
  expected_section text,
  acceptable_abstain boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
