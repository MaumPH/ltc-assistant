create extension if not exists vector;

create table if not exists documents (
  id text primary key,
  title text not null,
  file_name text not null,
  path text not null unique,
  mode text not null,
  source_role text not null default 'general',
  source_type text not null,
  document_group text not null,
  effective_date date,
  published_date date,
  content_hash text,
  file_size bigint,
  source_mtime timestamptz,
  chunk_count integer not null default 0,
  embedding_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table documents add column if not exists content_hash text;
alter table documents add column if not exists file_size bigint;
alter table documents add column if not exists source_mtime timestamptz;
alter table documents add column if not exists chunk_count integer not null default 0;
alter table documents add column if not exists embedding_count integer not null default 0;
alter table documents add column if not exists source_role text not null default 'general';

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
  linked_document_titles jsonb not null default '[]'::jsonb,
  chunk_hash text not null,
  parent_section_id text not null,
  parent_section_title text not null,
  window_index integer not null default 0,
  span_start integer not null default 0,
  span_end integer not null default 0,
  citation_group_id text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists chunks_mode_idx on chunks(mode);
create index if not exists chunks_doc_title_idx on chunks(doc_title);
create index if not exists chunks_article_idx on chunks(article_no);
create index if not exists chunks_effective_date_idx on chunks(effective_date desc);
create index if not exists chunks_embedding_ivfflat_idx on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
alter table chunks add column if not exists source_role text not null default 'general';
alter table chunks add column if not exists linked_document_titles jsonb not null default '[]'::jsonb;
alter table chunks add column if not exists parent_section_id text;
alter table chunks add column if not exists parent_section_title text;
alter table chunks add column if not exists window_index integer not null default 0;
alter table chunks add column if not exists span_start integer not null default 0;
alter table chunks add column if not exists span_end integer not null default 0;
alter table chunks add column if not exists citation_group_id text;

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

create table if not exists rag_index_metadata (
  id text primary key,
  generated_at timestamptz not null,
  storage_mode text not null,
  manifest_hash text not null,
  document_count integer not null,
  chunk_count integer not null,
  embedding_count integer not null,
  mode_counts jsonb not null default '{}'::jsonb
);

create table if not exists ontology_entities (
  id text primary key,
  entity_type text not null,
  label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ontology_aliases (
  id text primary key,
  entity_id text not null references ontology_entities(id) on delete cascade,
  alias text not null,
  alias_type text not null,
  weight double precision not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists ontology_aliases_entity_id_idx on ontology_aliases(entity_id);
create index if not exists ontology_aliases_alias_idx on ontology_aliases(alias);

create table if not exists ontology_edges (
  id text primary key,
  from_entity_id text not null references ontology_entities(id) on delete cascade,
  to_entity_id text not null references ontology_entities(id) on delete cascade,
  relation text not null,
  weight double precision not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ontology_edges_from_idx on ontology_edges(from_entity_id);
create index if not exists ontology_edges_to_idx on ontology_edges(to_entity_id);

create table if not exists law_fallback_cache (
  id text primary key,
  cache_key text not null unique,
  title text not null,
  query text not null,
  text text not null,
  source text not null,
  path text not null,
  article_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists law_fallback_cache_key_idx on law_fallback_cache(cache_key);
