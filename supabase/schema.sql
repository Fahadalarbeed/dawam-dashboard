-- ============================================================
-- سكيما قاعدة البيانات لداشبورد الدوام
-- ============================================================

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('faults','meters','daily')),
  report_date date not null,
  area text,
  period_key text,
  data jsonb not null default '{}'::jsonb,
  pdf_path text,
  display_name text,
  prepared_by text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists reports_date_idx on reports (report_date);
create index if not exists reports_type_idx on reports (type);
create index if not exists reports_area_idx on reports (area);

alter table reports enable row level security;

drop policy if exists "authenticated can read reports" on reports;
create policy "authenticated can read reports"
  on reports for select
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated can insert reports" on reports;
create policy "authenticated can insert reports"
  on reports for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated can delete reports" on reports;
create policy "authenticated can delete reports"
  on reports for delete
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated can upload pdfs" on storage.objects;
create policy "authenticated can upload pdfs"
  on storage.objects for insert
  with check (bucket_id = 'report-pdfs' and auth.role() = 'authenticated');

drop policy if exists "authenticated can read pdfs" on storage.objects;
create policy "authenticated can read pdfs"
  on storage.objects for select
  using (bucket_id = 'report-pdfs' and auth.role() = 'authenticated');

drop policy if exists "authenticated can delete pdfs" on storage.objects;
create policy "authenticated can delete pdfs"
  on storage.objects for delete
  using (bucket_id = 'report-pdfs' and auth.role() = 'authenticated');
