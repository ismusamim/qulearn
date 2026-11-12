-- =====================================================================
-- المحاسب وصلاحياته
--   - نوع حساب جديد «محاسب» (accountant)
--   - صلاحيات افتراضية للمحاسب (يمكن سحبها منه أو منحها لغيره من قسم «الصلاحيات»):
--       students.add     إضافة طالب
--       students.status  تغيير حالة الطالب: منقطع / منتظم
--       students.move    نقل طالب من حلقة إلى أخرى أو من مكان لآخر
--       fees.collect     تحصيل الاشتراكات وتسجيلها
--       fees.amount      تحديد قيمة اشتراك الطالب وتغييرها
--       notes.send       إرسال ملاحظة للمدير أو المشرفين تظهر في الإعلانات باسم صاحبها
--   - الخادم يمنع غير المدير من تعديل أي بيانات أخرى للطالب (الاسم، الهاتف، الحساب…)
--   - الحسابات الموقوفة (الطالب المنقطع والمعلم الموقوف) لا تكتب شيئًا
-- يُنفَّذ بعد fees.sql و fees_private.sql و perms.sql، مرة واحدة، وآمن للتكرار.
-- =====================================================================

-- 1) نوع الحساب، وجمهور الإعلانات، وصاحب الملاحظة، ومن حصّل الاشتراك
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('admin', 'supervisor', 'teacher', 'student', 'accountant'));
alter table public.news drop constraint if exists news_audience_check;
alter table public.news add constraint news_audience_check check (audience in ('all', 'teacher', 'supervisor', 'student', 'admin', 'accountant'));
alter table public.news add column if not exists author_id uuid references public.members(id) on delete set null;
alter table public.news add column if not exists author text;
alter table public.fees add column if not exists by_member uuid references public.members(id) on delete set null;

-- 2) الصلاحيات الافتراضية لكل فئة، ودالة التحقق (استثناء الفرد ← اختيار الفئة ← الافتراضي)
create or replace function public.perm_default(r text, p text) returns boolean
language sql immutable as $$
  select r = 'accountant' and p in ('students.add', 'students.status', 'students.move', 'fees.collect', 'fees.amount', 'notes.send')
$$;
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from members m
    cross join (select coalesce((select value from settings where key = 'priv_perms'), '{}'::jsonb) v) c
    where m.user_id = auth.uid()
      and coalesce((c.v -> 'members' -> (m.id::text) ->> p)::boolean,
                   (c.v -> 'roles' -> m.role ->> p)::boolean,
                   public.perm_default(m.role, p))
  )
$$;
create or replace function public.my_perms() returns text[]
language sql stable security definer set search_path = public as $$
  with c as (select coalesce((select value from settings where key = 'priv_perms'), '{}'::jsonb) v),
  keys as (
    select k from members m, c,
      lateral jsonb_object_keys(coalesce(c.v -> 'roles' -> m.role, '{}'::jsonb) || coalesce(c.v -> 'members' -> (m.id::text), '{}'::jsonb)) k
    where m.user_id = auth.uid()
    union select unnest(array['students.add', 'students.status', 'students.move', 'fees.collect', 'fees.amount', 'notes.send'])
  )
  select coalesce(array_agg(distinct k order by k), '{}') from keys where public.has_perm(k)
$$;
create or replace function public.can_manage_students() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_perm('students.add') or public.has_perm('students.status') or public.has_perm('students.move')
      or public.has_perm('fees.collect') or public.has_perm('fees.amount')
$$;

-- 3) الطلاب: القراءة والإضافة والتعديل لمن له الصلاحية، والخادم يحرس الحقول
drop policy if exists members_read_mgr on public.members;
create policy members_read_mgr on public.members for select to authenticated using (role = 'student' and public.can_manage_students());
drop policy if exists members_add_mgr on public.members;
create policy members_add_mgr on public.members for insert to authenticated with check (role = 'student' and public.has_perm('students.add'));
drop policy if exists members_upd_mgr on public.members;
create policy members_upd_mgr on public.members for update to authenticated
  using (role = 'student' and public.can_manage_students()) with check (role = 'student' and public.can_manage_students());

create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.role = 'student' and (new.user_id is not null or new.login_email is not null) then raise exception 'غير مصرح'; end if;
    return new;
  end if;
  if old.role <> 'student' and new.role <> 'student' then return new; end if;   -- مثل تعديل المعلم ملفه
  if new.role is distinct from old.role or new.user_id is distinct from old.user_id or new.login_email is distinct from old.login_email
     or replace(coalesce(new.name, ''), ' ', '') <> replace(coalesce(old.name, ''), ' ', '')
     or coalesce(new.phone, '') <> coalesce(old.phone, '') or coalesce(new.cat, 'child') <> coalesce(old.cat, 'child')
     or coalesce(new.extra, '{}'::jsonb) <> coalesce(old.extra, '{}'::jsonb) or new.photo is distinct from old.photo then
    raise exception 'غير مصرح بتعديل بيانات الطالب';
  end if;
  if new.halaqa_id is distinct from old.halaqa_id and not public.has_perm('students.move') then raise exception 'غير مصرح بنقل الطالب'; end if;
  for k in select jsonb_object_keys(coalesce(old.info, '{}'::jsonb) || coalesce(new.info, '{}'::jsonb)) loop
    if (old.info -> k) is distinct from (new.info -> k) then
      if k in ('status', 'statusDate') and public.has_perm('students.status') then continue; end if;
      if k in ('fee', 'feeCat', 'feeDisc', 'feeDiscVal', 'feeDiscType') and public.has_perm('fees.amount') then continue; end if;
      raise exception 'غير مصرح بتعديل %', k;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before insert or update on public.members for each row execute function public.members_guard();

-- أسماء المعلمين والمشرفين فقط (لتسمية الحلقات) لمن يدير الطلاب، دون بياناتهم الأخرى
create or replace function public.staff_names()
returns table (id uuid, name text, role text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.role from members m
  where m.role in ('teacher', 'supervisor') and (public.is_admin() or public.can_manage_students())
  order by m.name
$$;

-- 4) الاشتراكات: من يحصّل يقرأ ويسجّل، ويحذف ما سجّله هو فقط؛ والخادم يكتب اسم المحصِّل
drop policy if exists fees_mgr_read on public.fees;
create policy fees_mgr_read on public.fees for select to authenticated using (public.has_perm('fees.collect'));
drop policy if exists fees_mgr_add on public.fees;
create policy fees_mgr_add on public.fees for insert to authenticated with check (public.has_perm('fees.collect'));
drop policy if exists fees_mgr_del on public.fees;
create policy fees_mgr_del on public.fees for delete to authenticated using (public.has_perm('fees.collect') and by_member in (select public.my_ids()));
create or replace function public.fees_by() returns trigger
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  if auth.uid() is null then return new; end if;
  select id, name into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'admin') desc limit 1;
  if me.id is not null then new.by_member := me.id; if not public.is_admin() or new.by_name is null then new.by_name := me.name; end if; end if;
  return new;
end $$;
drop trigger if exists fees_by on public.fees;
create trigger fees_by before insert on public.fees for each row execute function public.fees_by();

-- 5) إعدادات الاشتراكات (الفئات والخصومات) يقرؤها من يحصّل أو يحدد القيم
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to anon, authenticated
  using (key not like 'priv\_%' or public.is_admin()
         or (key = 'priv_fees' and (public.has_perm('fees.collect') or public.has_perm('fees.amount'))));

-- 6) الملاحظات: يكتبها الخادم باسم صاحبها ونوع حسابه، وتظهر في إعلانات المدير أو المشرفين
drop policy if exists news_read on public.news;
create policy news_read on public.news for select to authenticated
  using (audience = 'all' or public.is_admin() or public.has_role(audience) or author_id in (select public.my_ids()));
create or replace function public.send_note(aud text, body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me record; nid uuid := gen_random_uuid();
begin
  if not public.has_perm('notes.send') then raise exception 'غير مصرح'; end if;
  if aud not in ('admin', 'supervisor') then raise exception 'جهة غير صحيحة'; end if;
  if length(trim(coalesce(body, ''))) < 2 or length(body) > 2000 then raise exception 'نص الملاحظة غير صالح'; end if;
  select id, name, role into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'accountant') desc limit 1;
  insert into news (id, text, audience, date, author_id, author)
  values (nid, trim(body), aud, current_date, me.id,
          (case me.role when 'accountant' then 'المحاسب' when 'teacher' then 'المعلم' when 'supervisor' then 'المشرف' else 'المدير' end) || ' ' || me.name);
  return nid;
end $$;

revoke all on function public.perm_default(text, text), public.can_manage_students(), public.staff_names(), public.send_note(text, text) from public, anon;
grant execute on function public.perm_default(text, text), public.can_manage_students(), public.staff_names(), public.send_note(text, text),
  public.has_perm(text), public.my_perms() to authenticated;
-- قاعدة قراءة الإعدادات تستدعي has_perm، وصفحة الدخول تقرأ الإعدادات قبل الدخول: الزائر يحتاج تنفيذها (وتُرجع له «لا» دائمًا)
grant execute on function public.has_perm(text), public.perm_default(text, text) to anon;

-- 7) الحسابات الموقوفة: الطالب «منقطع» والمعلم «موقوف» (من بياناته الإدارية) لا يكتبان شيئًا على الخادم،
--    ويرى كل منهما عند الدخول رسالة يحررها المدير من «الإعدادات»
create or replace function public.is_blocked() returns boolean
language sql stable security definer set search_path = public as $$
  select not public.is_admin() and exists (
    select 1 from members m where m.user_id = auth.uid() and (
      (m.role = 'student' and m.info ->> 'status' = 'منقطع')
      or (m.role = 'teacher' and exists (select 1 from member_admin a where a.member_id = m.id and a.data ->> 'status' = 'موقوف'))))
$$;
revoke all on function public.is_blocked() from public, anon;
grant execute on function public.is_blocked() to authenticated;
drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance for all to authenticated
  using (public.can_teach_student(student_id) and not public.is_blocked()) with check (public.can_teach_student(student_id) and not public.is_blocked());
drop policy if exists records_write on public.records;
create policy records_write on public.records for all to authenticated
  using (public.can_teach_student(student_id) and not public.is_blocked()) with check (public.can_teach_student(student_id) and not public.is_blocked());

-- 8) المزامنة تعرف المحاسب
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
