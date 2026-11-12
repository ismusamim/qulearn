-- =====================================================================
-- الاشتراكات + قواعد البحث على الخادم
-- يُنفَّذ بعد sync_incremental.sql و sync_scope.sql، مرة واحدة في Supabase ← SQL Editor ← Run
-- آمن للتكرار.
-- =====================================================================

-- 1) قواعد البحث في صفحة الدخول: الهمزات = ا، التاء المربوطة = الهاء، و«عبد الله» = «عبدالله»
create or replace function public.norm_ar(t text) returns text
language sql immutable as $$
  select regexp_replace(lower(trim(regexp_replace(
    regexp_replace(translate(coalesce(t, ''), 'أإآةى', 'اااهي'),
      '[' || U&'\064B' || '-' || U&'\0652' || U&'\0640' || ']', '', 'g'),
    '\s+', ' ', 'g'))), '(^| )عبد ', '\1عبد', 'g')
$$;

-- 2) جدول اشتراكات الطلاب (للمدير فقط)
create table if not exists public.fees (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.members(id) on delete cascade,
  y          int  not null,
  m          int  not null check (m between 1 and 12),
  amount     numeric not null check (amount >= 0),
  date       date,
  by_name    text,
  note       text not null default '',
  created_at timestamptz not null default now(),
  sync_ts    timestamptz not null default clock_timestamp()
);
create index if not exists fees_student_idx on public.fees (student_id);
create index if not exists fees_ym_idx      on public.fees (y, m);
create index if not exists fees_sync_ts_idx on public.fees (sync_ts);
alter table public.fees enable row level security;
drop policy if exists fees_admin on public.fees;
create policy fees_admin on public.fees for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.fees to authenticated;

drop trigger if exists fees_sync_stamp on public.fees;
create trigger fees_sync_stamp before insert or update on public.fees for each row execute function public.sync_stamp();
drop trigger if exists fees_sync_tomb on public.fees;
create trigger fees_sync_tomb after delete on public.fees for each row execute function public.sync_tomb('id');

-- 3) المزامنة تعرف جدول الاشتراكات
create or replace function public.sync_check(since timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me    uuid[] := array(select id from members where user_id = auth.uid());
  roles text[] := array(select role from members where user_id = auth.uid());
  adm   boolean := 'admin' = any(roles);
  sup   boolean := 'supervisor' = any(roles);
  staff boolean := 'teacher' = any(roles) or sup;
  hal uuid[]; stu uuid[]; ids uuid[]; pl uuid[]; allids uuid[]; t text[] := '{}';
begin
  if auth.uid() is null then return null; end if;
  if adm then
    select array_agg(x) into t from (
      select 'settings' x where exists (select 1 from settings where sync_ts > since)
      union all select 'places' where exists (select 1 from places where sync_ts > since)
      union all select 'members' where exists (select 1 from members where sync_ts > since)
      union all select 'member_admin' where exists (select 1 from member_admin where sync_ts > since)
      union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since)
      union all select 'attendance' where exists (select 1 from attendance where sync_ts > since)
      union all select 'records' where exists (select 1 from records where sync_ts > since)
      union all select 'news' where exists (select 1 from news where sync_ts > since)
      union all select 'custom_fields' where exists (select 1 from custom_fields where sync_ts > since)
      union all select 'pending_columns' where exists (select 1 from pending_columns where sync_ts > since)
      union all select 'pay_settings' where exists (select 1 from pay_settings where sync_ts > since)
      union all select 'pay_employees' where exists (select 1 from pay_employees where sync_ts > since)
      union all select 'pay_rows' where exists (select 1 from pay_rows where sync_ts > since)
      union all select 'pay_closed' where exists (select 1 from pay_closed where sync_ts > since)
      union all select 'absences' where exists (select 1 from absences where sync_ts > since)
      union all select 'fees' where exists (select 1 from fees where sync_ts > since)
      union all select 'deleted' where exists (select 1 from sync_deleted where at > since)
    ) q;
    return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')));
  end if;

  -- نطاق المستخدم: حلقاته (أو حلقته إن كان طالبًا)، وطلابها، وأسماء معلميها ومشرفيها
  hal := array(select id from halaqat where teacher_id = any(me) or supervisor_id = any(me)
               or id in (select halaqa_id from members where id = any(me) and halaqa_id is not null));
  stu := case when staff then array(select id from members where role = 'student' and halaqa_id = any(hal)) else '{}' end
         || array(select id from members where id = any(me) and role = 'student');
  ids := me || array(select x from halaqat h, unnest(array[h.teacher_id, h.supervisor_id]) x where h.id = any(hal) and x is not null);
  pl  := array(select place_id from halaqat where id = any(hal) and place_id is not null);
  allids := ids || stu || hal || pl;

  select array_agg(x) into t from (
    select 'settings' x where exists (select 1 from settings where sync_ts > since)
    union all select 'places' where exists (select 1 from places where sync_ts > since and (sup or id = any(pl)))
    union all select 'members' where exists (select 1 from members where sync_ts > since and (id = any(ids) or id = any(stu)))
    union all select 'member_admin' where exists (select 1 from member_admin where sync_ts > since and member_id = any(me))
    union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since and id = any(hal))
    union all select 'attendance' where exists (select 1 from attendance where sync_ts > since and student_id = any(stu))
    union all select 'records' where exists (select 1 from records where sync_ts > since and student_id = any(stu))
    union all select 'news' where exists (select 1 from news where sync_ts > since and (audience = 'all' or audience = any(roles)))
    union all select 'custom_fields' where exists (select 1 from custom_fields where sync_ts > since)
    -- غياب المعلمين عمل مشترك بين المشرفين (حتى لا يُسجَّل الغياب نفسه مرتين)
    union all select 'absences' where sup and exists (select 1 from absences where sync_ts > since)
    union all select 'staff' where sup and exists (select 1 from pay_employees where sync_ts > since union all select 1 from pay_closed where sync_ts > since)
    union all select 'deleted' where exists (select 1 from sync_deleted where at > since and (
      tbl in ('settings', 'news', 'custom_fields') or (sup and tbl in ('places', 'absences')) or scope && allids))
  ) q;
  return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')),
    'hal', to_jsonb(hal), 'stu', to_jsonb(stu), 'ids', to_jsonb(ids), 'pl', to_jsonb(pl), 'me', to_jsonb(me), 'sup', sup);
end $$;
revoke all on function public.sync_check(timestamptz) from public, anon;
grant execute on function public.sync_check(timestamptz) to authenticated;

notify pgrst, 'reload schema';
