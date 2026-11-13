-- =====================================================================
--  qulearn — قاعدة بيانات إدارة الحلقات القرآنية على Supabase
--  الصقه كاملًا في: Supabase ← SQL Editor ← New query ← Run
--  آمن لإعادة التشغيل على مشروع جديد فارغ.
-- =====================================================================

-- ---------- تطبيع الأسماء العربية للبحث (بلا تشكيل، أ/إ/آ ← ا، ة ← ه، ى ← ي) ----------
create or replace function public.norm_ar(t text) returns text
language sql immutable as $$
  select lower(trim(regexp_replace(
    regexp_replace(translate(coalesce(t, ''), 'أإآةى', 'اااهي'),
      '[' || U&'\064B' || '-' || U&'\0652' || U&'\0640' || ']', '', 'g'),
    '\s+', ' ', 'g')))
$$;

-- =====================================================================
--  الجداول
-- =====================================================================

-- إعدادات عامة: اسم المؤسسة والمظهر والشعار (تُقرأ قبل الدخول)
create table public.settings (
  key   text primary key,
  value jsonb not null default 'null'::jsonb
);

-- الأماكن: مسجد أو دار تحفيظ
create table public.places (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  type      text not null default 'مسجد' check (type in ('مسجد', 'دار تحفيظ')),
  address   text not null default '',
  legacy_id text
);

-- كل الحسابات في جدول واحد بنوعها؛ الشخص الواحد قد يكون له أكثر من نوع بنفس user_id
create table public.members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  login_email text,
  role        text not null check (role in ('admin', 'supervisor', 'teacher', 'student')),
  name        text not null,
  phone       text not null default '',
  halaqa_id   uuid,                       -- للطلاب
  cat         text check (cat in ('child', 'adult')),
  info        jsonb not null default '{}'::jsonb,  -- الاستمارة / الملف الشخصي والفني
  extra       jsonb not null default '{}'::jsonb,  -- الحقول المضافة من الاستيراد
  photo       text,
  legacy_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index members_user_idx   on public.members (user_id);
create index members_role_idx   on public.members (role);
create index members_halaqa_idx on public.members (halaqa_id);

-- البيانات الإدارية للمعلم (المكافأة والتعاقد…): للإدارة وصاحبها فقط
create table public.member_admin (
  member_id uuid primary key references public.members(id) on delete cascade,
  data      jsonb not null default '{}'::jsonb
);

-- الحلقات: تُسمّى باسم معلمها في التطبيق
create table public.halaqat (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default '',
  teacher_id    uuid references public.members(id) on delete set null,
  supervisor_id uuid references public.members(id) on delete set null,
  place_id      uuid references public.places(id) on delete set null,
  time          jsonb,
  legacy_id     text
);
alter table public.members
  add constraint members_halaqa_fk foreign key (halaqa_id) references public.halaqat(id) on delete set null;

create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.members(id) on delete cascade,
  date        date not null,
  status      text not null check (status in ('present', 'late', 'excused', 'absent')),
  recorded_by uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (student_id, date)
);

create table public.records (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.members(id) on delete cascade,
  date        date not null,
  type        text not null check (type in ('حفظ', 'مراجعة', 'تثبيت')),
  surah       smallint not null check (surah between 1 and 114),
  from_ayah   smallint not null,
  to_ayah     smallint not null,
  grade       text,
  note        text not null default '',
  recorded_by uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (from_ayah >= 1 and to_ayah >= from_ayah)
);
create index records_student_idx on public.records (student_id, date desc);

create table public.news (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  audience   text not null default 'all' check (audience in ('all', 'teacher', 'supervisor', 'student')),
  date       date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.custom_fields (
  kind  text not null check (kind in ('students', 'teachers')),
  key   text not null,
  label text not null,
  type  text not null default 'text',
  primary key (kind, key)
);

create table public.pending_columns (
  id       uuid primary key default gen_random_uuid(),
  kind     text not null check (kind in ('students', 'teachers')),
  header   text not null,
  "values" jsonb not null default '[]'::jsonb,
  date     date not null default current_date
);

-- ---------------------------- المرتبات ----------------------------
create table public.pay_settings (
  id   int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

create table public.pay_employees (
  id        uuid primary key default gen_random_uuid(),
  code      text,
  name      text not null,
  role      text,
  sys       text,
  status    text not null default 'نشط' check (status in ('نشط', 'متوقف')),
  basic     numeric, rate numeric, incentive numeric, transport numeric, hours numeric,
  place     text,
  note      text,
  member_id uuid references public.members(id) on delete set null,
  legacy_id text
);

-- صف لكل موظف في كل شهر؛ عناصر الراتب محفوظة بقيمتها في ذلك الشهر
create table public.pay_rows (
  id        uuid primary key default gen_random_uuid(),
  y         int not null,
  m         int not null check (m between 1 and 12),
  emp_id    uuid not null references public.pay_employees(id) on delete restrict,
  name      text, role text,
  base numeric, extra numeric, exc numeric,
  abs_p numeric, abs_n numeric, mtg_p numeric, mtg_n numeric,
  d_test numeric, d_rec numeric, d_books numeric,
  basic numeric, rate numeric, incentive numeric, transport numeric,
  note      text not null default '',
  legacy_id text,
  unique (y, m, emp_id)
);

create table public.pay_closed (
  y int not null, m int not null,
  primary key (y, m)
);

create table public.absences (
  id         uuid primary key default gen_random_uuid(),
  y          int not null,
  m          int not null check (m between 1 and 12),
  date       date not null,
  emp_id     uuid not null references public.pay_employees(id) on delete cascade,
  name       text,
  place      text,
  perm       text check (perm is null or perm in ('', 'بإذن', 'بغير إذن')),
  reason     text,
  proof      text check (proof is null or proof in ('', 'رصيد', 'مثبت')),
  note       text,
  by_member  uuid references public.members(id) on delete set null,
  by_name    text,
  created_at timestamptz not null default now(),
  legacy_id  text,
  unique (emp_id, date)
);

-- تحديث updated_at تلقائيًا
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger members_touch before update on public.members for each row execute function public.touch();

-- =====================================================================
--  دوال الصلاحيات (security definer حتى لا تتكرر قواعد RLS على نفسها)
-- =====================================================================
create or replace function public.my_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid()
$$;

create or replace function public.has_role(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role = r)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('admin')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role in ('admin', 'supervisor', 'teacher'))
$$;

-- الإداري يرى كل الحلقات؛ المعلم حلقاته؛ المشرف الحلقات المسندة إليه
create or replace function public.can_manage_halaqa(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from halaqat x
    where x.id = h and (x.teacher_id in (select public.my_ids()) or x.supervisor_id in (select public.my_ids())))
$$;

-- من يحق له تسجيل حضور الطالب وتسميعه
create or replace function public.can_teach_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from members st
    where st.id = s and st.role = 'student' and st.halaqa_id is not null and public.can_manage_halaqa(st.halaqa_id))
$$;

-- من يرى بيانات الطالب: من يُعلّمه، أو الطالب نفسه
create or replace function public.can_see_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select s in (select public.my_ids()) or public.can_teach_student(s)
$$;

-- معلم ومشرف حلقة الطالب الحالي (ليرى الطالب اسميهما)
create or replace function public.my_halaqa_staff() returns setof uuid
language sql stable security definer set search_path = public as $$
  select unnest(array[h.teacher_id, h.supervisor_id])
  from members s join halaqat h on h.id = s.halaqa_id
  where s.user_id = auth.uid() and s.role = 'student'
$$;

-- شهر المرتب المفتوح (للمشرف عند تسجيل غياب دون أن يرى المرتبات)
create or replace function public.current_pay_month(out y int, out m int)
language sql stable security definer set search_path = public as $$
  select r.y, r.m from pay_rows r
  where not exists (select 1 from pay_closed c where c.y = r.y and c.m = r.m)
  group by r.y, r.m order by r.y desc, r.m desc limit 1
$$;

-- قائمة المعلمين لنموذج الغياب: أسماء وأماكن فقط، بلا مبالغ
create or replace function public.staff_list()
returns table (id uuid, code text, name text, place text, status text)
language sql stable security definer set search_path = public as $$
  select e.id, e.code, e.name, e.place, e.status from pay_employees e
  where public.is_admin() or public.has_role('supervisor')
  order by e.name
$$;

-- البحث عن الاسم في صفحة الدخول: يحتاج حرفين على الأقل، ويعيد الاسم ونوع الحساب فقط
-- (لا الحلقة ولا المكان، حمايةً لبيانات الأطفال). يمكن إيقافه بالإعداد public_name_search = false
create or replace function public.login_lookup(q text)
returns table (member_id uuid, name text, role text, login_email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce((select value #>> '{}' from settings where key = 'public_name_search'), 'true') = 'false' then return; end if;
  if length(public.norm_ar(q)) < 2 then return; end if;
  return query
    select m.id, m.name, m.role, m.login_email
    from members m
    where m.login_email is not null and public.norm_ar(m.name) like '%' || public.norm_ar(q) || '%'
    order by (public.norm_ar(m.name) like public.norm_ar(q) || '%') desc, m.name
    limit 8;
end $$;

-- المعلم يعدّل بياناته الشخصية والفنية فقط (ولا يلمس الإدارية أو الحلقة)
create or replace function public.update_my_profile(member uuid, personal jsonb, tech jsonb, new_phone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if member not in (select public.my_ids()) then raise exception 'غير مصرح'; end if;
  update members set
    info = jsonb_set(jsonb_set(info, '{personal}', coalesce(personal, info -> 'personal', '{}'::jsonb)), '{tech}', coalesce(tech, info -> 'tech', '{}'::jsonb)),
    phone = coalesce(new_phone, phone)
  where id = member and role = 'teacher';
end $$;

revoke all on function public.login_lookup(text) from public;
grant execute on function public.login_lookup(text) to anon, authenticated;
grant execute on function public.my_ids(), public.has_role(text), public.is_admin(), public.is_staff(),
  public.can_manage_halaqa(uuid), public.can_teach_student(uuid), public.can_see_student(uuid),
  public.my_halaqa_staff(), public.current_pay_month(), public.staff_list(),
  public.update_my_profile(uuid, jsonb, jsonb, text) to authenticated;

-- =====================================================================
--  قواعد الصلاحيات (Row Level Security) — مفعّلة على كل الجداول
-- =====================================================================
alter table public.settings        enable row level security;
alter table public.places          enable row level security;
alter table public.members         enable row level security;
alter table public.member_admin    enable row level security;
alter table public.halaqat         enable row level security;
alter table public.attendance      enable row level security;
alter table public.records         enable row level security;
alter table public.news            enable row level security;
alter table public.custom_fields   enable row level security;
alter table public.pending_columns enable row level security;
alter table public.pay_settings    enable row level security;
alter table public.pay_employees   enable row level security;
alter table public.pay_rows        enable row level security;
alter table public.pay_closed      enable row level security;
alter table public.absences        enable row level security;

-- الإعدادات: يقرؤها الجميع (اسم المؤسسة والشعار في صفحة الدخول)، ويكتبها الإداري
create policy settings_read  on public.settings for select to anon, authenticated using (true);
create policy settings_write on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- الأماكن والحلقات: يقرؤها كل من دخل، ويديرها الإداري
create policy places_read   on public.places  for select to authenticated using (true);
create policy places_write  on public.places  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy halaqat_read  on public.halaqat for select to authenticated using (true);
create policy halaqat_write on public.halaqat for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- الحسابات: الإداري الكل؛ كل شخص نفسه؛ الطاقم يرى الطاقم؛ المعلم/المشرف طلاب حلقاته؛ الطالب معلم حلقته ومشرفها
create policy members_read on public.members for select to authenticated using (
  public.is_admin()
  or user_id = auth.uid()
  or (role <> 'student' and public.is_staff())
  or (role = 'student' and public.can_teach_student(id))
  or id in (select public.my_halaqa_staff())
);
create policy members_write on public.members for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy member_admin_read  on public.member_admin for select to authenticated using (public.is_admin() or member_id in (select public.my_ids()));
create policy member_admin_write on public.member_admin for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- الحضور والتسميع: يراها من يعلّم الطالب والطالب نفسه، ويسجّلها المعلم/المشرف/الإداري
create policy attendance_read  on public.attendance for select to authenticated using (public.can_see_student(student_id));
create policy attendance_write on public.attendance for all to authenticated using (public.can_teach_student(student_id)) with check (public.can_teach_student(student_id));
create policy records_read     on public.records    for select to authenticated using (public.can_see_student(student_id));
create policy records_write    on public.records    for all to authenticated using (public.can_teach_student(student_id)) with check (public.can_teach_student(student_id));

-- الإعلانات: حسب الجمهور
create policy news_read  on public.news for select to authenticated using (audience = 'all' or public.is_admin() or public.has_role(audience));
create policy news_write on public.news for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy fields_read   on public.custom_fields   for select to authenticated using (true);
create policy fields_write  on public.custom_fields   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pending_admin on public.pending_columns for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- المرتبات: للإداري وحده
create policy pay_settings_admin  on public.pay_settings  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pay_employees_admin on public.pay_employees for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pay_rows_admin      on public.pay_rows      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pay_closed_admin    on public.pay_closed    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- غياب المعلمين: الإداري والمشرف يسجّلان ويقرآن؛ الإثبات للإداري؛ الحذف للإداري أو لمن سجّله
create policy absences_read   on public.absences for select to authenticated using (public.is_admin() or public.has_role('supervisor'));
create policy absences_insert on public.absences for insert to authenticated with check (
  (public.is_admin() or public.has_role('supervisor'))
  and (by_member is null or by_member in (select public.my_ids()))
  and (public.is_admin() or coalesce(proof, '') = ''));
create policy absences_update on public.absences for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy absences_delete on public.absences for delete to authenticated using (public.is_admin() or by_member in (select public.my_ids()));

-- =====================================================================
--  صلاحيات الوصول عبر الـ API (صريحة، فلا تعتمد على خيار «Automatically expose new tables»)
--  الوصول الفعلي لكل صف تحدده قواعد RLS أعلاه
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on public.settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.norm_ar(text) to anon, authenticated;

-- =====================================================================
--  التحديث اللحظي: يرى الإداري حضور المعلمين لحظة تسجيله
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.attendance, public.records, public.news, public.absences;
exception when others then null; end $$;

-- إعدادات أولية
insert into public.settings (key, value) values
  ('org', '"إدارة الحلقات القرآنية"'::jsonb),
  ('public_name_search', 'true'::jsonb)
on conflict (key) do nothing;
insert into public.pay_settings (id, data) values
  (1, '{"perm":20,"noperm":30,"mperm":50,"mnoperm":70,"round":5,"lv3":10,"lv6":21,"hours":26}'::jsonb)
on conflict (id) do nothing;
