-- =====================================================================
-- المزامنة بالتغييرات فقط (توفير استهلاك الباقة)
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor ← Run
-- آمن للتكرار: تنفيذه مرة ثانية لا يضر.
-- =====================================================================

-- وقت آخر تغيير لكل صف: يُضبط تلقائيًا عند الإضافة والتعديل
create or replace function public.sync_stamp() returns trigger language plpgsql as $$
begin new.sync_ts := clock_timestamp(); return new; end $$;

-- سجل المحذوفات: حتى يعرف التطبيق ما حُذف دون إعادة تنزيل الجدول كله
create table if not exists public.sync_deleted (
  rev bigserial primary key,
  tbl text not null,
  pk  jsonb not null,
  at  timestamptz not null default clock_timestamp()
);
create index if not exists sync_deleted_at_idx on public.sync_deleted (at);
alter table public.sync_deleted enable row level security;
drop policy if exists sync_deleted_read on public.sync_deleted;
create policy sync_deleted_read on public.sync_deleted for select to authenticated using (true);
grant select on public.sync_deleted to authenticated;

create or replace function public.sync_tomb() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; o jsonb := to_jsonb(old); j jsonb := '{}'::jsonb;
begin
  foreach k in array tg_argv loop j := j || jsonb_build_object(k, o -> k); end loop;
  insert into public.sync_deleted (tbl, pk) values (tg_table_name, j);
  -- لا داعي للاحتفاظ بالمحذوفات القديمة (التطبيق يعيد جلبًا كاملًا كل 30 دقيقة)
  delete from public.sync_deleted where at < clock_timestamp() - interval '2 days';
  return old;
end $$;

-- عمود وقت التغيير + فهرسه + المشغّلات لكل الجداول
do $$
declare t record; args text;
begin
  for t in select * from (values
    ('settings','key'), ('places','id'), ('members','id'), ('member_admin','member_id'), ('halaqat','id'),
    ('attendance','id'), ('records','id'), ('news','id'), ('custom_fields','kind,key'), ('pending_columns','id'),
    ('pay_settings','id'), ('pay_employees','id'), ('pay_rows','id'), ('pay_closed','y,m'), ('absences','id')
  ) v(tbl, pk) loop
    execute format('alter table public.%I add column if not exists sync_ts timestamptz not null default clock_timestamp()', t.tbl);
    execute format('create index if not exists %I on public.%I (sync_ts)', t.tbl || '_sync_ts_idx', t.tbl);
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_sync_stamp', t.tbl);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.sync_stamp()', t.tbl || '_sync_stamp', t.tbl);
    select string_agg(quote_literal(x), ',') into args from unnest(string_to_array(t.pk, ',')) x;
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_sync_tomb', t.tbl);
    execute format('create trigger %I after delete on public.%I for each row execute function public.sync_tomb(%s)', t.tbl || '_sync_tomb', t.tbl, args);
  end loop;
end $$;

-- هل للعضو صورة؟ (يُرسَل بدل الصورة نفسها، والصورة تُجلب عند الحاجة فقط)
alter table public.members add column if not exists has_photo boolean generated always as (coalesce(photo, '') <> '') stored;

-- وقت الخادم الحالي (نقطة البداية للمزامنة التالية)
create or replace function public.sync_now() returns timestamptz language sql as $$ select clock_timestamp() $$;
grant execute on function public.sync_now() to authenticated;

notify pgrst, 'reload schema';
