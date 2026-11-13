-- =====================================================================
-- الاختبارات: متابعة (المشرف) ودوري (المعلم أو المشرف) وإتقان (المشرف) ومسابقة (المشرفون والمدير).
--   - كل اختبار: الطالب، النوع، التاريخ، المختبِر، والأسئلة (الموضع وعدد الأخطاء والتنبيهات وأخطاء التجويد والدرجة).
--   - الصلاحيات على الخادم: كل نوع لمن يحق له، ولطلاب حلقاته فقط؛ واسم المختبِر يسجّله الخادم.
-- يُنفَّذ بعد collections.sql، مرة واحدة، وآمن للتكرار.
-- =====================================================================
create table if not exists public.exams (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.members(id) on delete cascade,
  halaqa_id     uuid references public.halaqat(id) on delete set null,
  type          text not null check (type in ('follow', 'periodic', 'mastery', 'comp')),
  date          date not null default current_date,
  examiner_id   uuid references public.members(id) on delete set null,
  examiner_name text,
  juz           int check (juz between 1 and 30),
  comp          text,
  level         text,
  questions     jsonb not null default '[]',
  max_score     numeric,
  total         numeric,
  grade         text,
  note          text default '',
  created_at    timestamptz default now(),
  sync_ts       timestamptz not null default clock_timestamp()
);
create index if not exists exams_sync_ts_idx on public.exams (sync_ts);
create index if not exists exams_student_idx on public.exams (student_id);
alter table public.exams enable row level security;
grant select, insert, update, delete on public.exams to authenticated;

-- من يحق له إجراء هذا النوع من الاختبارات لهذا الطالب
create or replace function public.can_exam(t text, sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (not public.is_blocked() and case t
    when 'periodic' then exists (select 1 from members s join halaqat h on h.id = s.halaqa_id where s.id = sid
                                 and (h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids())))
    when 'follow' then exists (select 1 from members s join halaqat h on h.id = s.halaqa_id where s.id = sid and h.supervisor_id in (select public.my_ids()))
    when 'mastery' then exists (select 1 from members s join halaqat h on h.id = s.halaqa_id where s.id = sid and h.supervisor_id in (select public.my_ids()))
    when 'comp' then exists (select 1 from members where user_id = auth.uid() and role = 'supervisor')
    else false end)
$$;
revoke all on function public.can_exam(text, uuid) from public, anon;
grant execute on function public.can_exam(text, uuid) to authenticated;

drop policy if exists exams_read on public.exams;
create policy exams_read on public.exams for select to authenticated using (
  public.is_admin() or examiner_id in (select public.my_ids()) or student_id in (select public.my_ids())
  or exists (select 1 from members s join halaqat h on h.id = s.halaqa_id where s.id = student_id
             and (h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids()))));
drop policy if exists exams_ins on public.exams;
create policy exams_ins on public.exams for insert to authenticated
  with check (public.can_exam(type, student_id) and (public.is_admin() or examiner_id in (select public.my_ids())));
drop policy if exists exams_upd on public.exams;
create policy exams_upd on public.exams for update to authenticated
  using (public.is_admin() or examiner_id in (select public.my_ids()))
  with check (public.can_exam(type, student_id) and (public.is_admin() or examiner_id in (select public.my_ids())));
drop policy if exists exams_del on public.exams;
create policy exams_del on public.exams for delete to authenticated using (public.is_admin() or examiner_id in (select public.my_ids()));

-- اسم المختبِر وحلقة الطالب يسجّلهما الخادم
create or replace function public.exams_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.examiner_name := (select name from members where id = new.examiner_id);
  if new.halaqa_id is null then new.halaqa_id := (select halaqa_id from members where id = new.student_id); end if;
  return new;
end $$;
drop trigger if exists exams_fill on public.exams;
create trigger exams_fill before insert or update on public.exams for each row execute function public.exams_fill();
drop trigger if exists exams_sync_stamp on public.exams;
create trigger exams_sync_stamp before insert or update on public.exams for each row execute function public.sync_stamp();
drop trigger if exists exams_sync_tomb on public.exams;
create trigger exams_sync_tomb after delete on public.exams for each row execute function public.sync_tomb('id');

-- المزامنة تعرف الاختبارات (المدير: كلها، والمعلم والمشرف: طلاب حلقاتهم وما أجروه، والطالب: اختباراته)
create or replace function public.sync_check(since timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me    uuid[] := array(select id from members where user_id = auth.uid());
  roles text[] := array(select role from members where user_id = auth.uid());
  adm   boolean := 'admin' = any(roles);
  sup   boolean := 'supervisor' = any(roles);
  staff boolean := 'teacher' = any(roles) or sup;
  acc   boolean := 'accountant' = any(roles);
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
      union all select 'collections' where exists (select 1 from collections where sync_ts > since)
      union all select 'exams' where exists (select 1 from exams where sync_ts > since)
      union all select 'deleted' where exists (select 1 from sync_deleted where at > since)
    ) q;
    return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')));
  end if;

  -- المحاسب: كل الطلاب والحلقات والأماكن واشتراكاته وملاحظاته (بلا تقييد بنطاق حلقات)
  if acc and not staff then
    select array_agg(x) into t from (
      select 'settings' x where exists (select 1 from settings where sync_ts > since)
      union all select 'places' where exists (select 1 from places where sync_ts > since)
      union all select 'members' where exists (select 1 from members where sync_ts > since)
      union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since)
      union all select 'news' where exists (select 1 from news where sync_ts > since and (audience in ('all', 'accountant') or author_id = any(me)))
      union all select 'fees' where public.has_perm('fees.collect') and exists (select 1 from fees where sync_ts > since)
      union all select 'collections' where public.has_perm('fees.collect') and exists (select 1 from collections where sync_ts > since)
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
    union all select 'collections' where exists (select 1 from collections where sync_ts > since and teacher_id = any(me))
    union all select 'exams' where exists (select 1 from exams where sync_ts > since and (student_id = any(stu) or examiner_id = any(me)))
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
