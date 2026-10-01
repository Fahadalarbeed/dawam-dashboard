-- جدول المولدات (قسم التشغيل) — مطبّق على قاعدة البيانات
create table if not exists public.generators (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  gen_type text not null check (gen_type in ('LT','HT')),
  status text not null default 'running' check (status in ('running','standby')),
  area text not null,
  block text, street text, plot text,
  station text, uds text, spur text, transformer text, unit_no text,
  gen_count integer not null default 1 check (gen_count > 0),
  size_kva text, gen_no text, wires text,
  shift text,
  connected_on date not null,
  notes text,
  removed_at timestamptz,
  removed_by text,
  created_by_email text
);
create index if not exists generators_active_idx on public.generators (removed_at, connected_on desc);
alter table public.generators enable row level security;
create policy "authenticated can read generators" on public.generators for select to authenticated using (true);
create policy "authenticated can insert generators" on public.generators for insert to authenticated with check (true);
create policy "authenticated can update generators" on public.generators for update to authenticated using (true) with check (true);

-- اسم اللي أزال المولد + إيميل الحساب
alter table public.generators add column if not exists removed_by_email text;
