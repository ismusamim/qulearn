-- =====================================================================
-- تحصيل المعلمين: المعلم يسجّل ما حصّله من كل طالب في الشهر ويرسل القائمة للمحاسب،
-- والمحاسب يؤكد الأسماء السليمة (فتُسجَّل دفعات في الاشتراكات) أو يعيد ما فيه مشكلة بملاحظة.
--   - كل الكتابة عبر دوال على الخادم تتحقق من الصلاحيات (لا كتابة مباشرة في الجدول لغير المدير).
--   - المستحق يُحسب على الخادم بقواعد قسم الاشتراكات نفسها، والمعلم يرى الرقم فقط.
-- يُنفَّذ بعد accountant.sql، مرة واحدة، وآمن للتكرار.
-- =====================================================================
create table if not exists public.collections (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid references public.members(id) on delete cascade,
  teacher_name text,
  halaqa_id    uuid references public.halaqat(id) on delete set null,
  y            int  not null,
  m            int  not null check (m between 1 and 12),
  status       text not null default 'draft' check (status in ('draft', 'sent', 'returned', 'done')),
  lines        jsonb not null default '[]',
  acc_note     text default '',
  sent_at      timestamptz,
  reviewed_at  timestamptz,
  reviewed_by  text,
  created_at   timestamptz default now(),
  sync_ts      timestamptz not null default clock_timestamp(),
  unique (teacher_id, halaqa_id, y, m)
);
create index if not exists collections_sync_ts_idx on public.collections (sync_ts);
alter table public.collections enable row level security;
-- القراءة بحسب قواعد الأمان أدناه، والكتابة لغير المدير عبر دوال الخادم فقط
grant select, insert, update, delete on public.collections to authenticated;
drop policy if exists coll_read on public.collections;
create policy coll_read on public.collections for select to authenticated
  using (public.is_admin() or public.has_perm('fees.collect') or teacher_id in (select public.my_ids()));
drop policy if exists coll_admin on public.collections;
create policy coll_admin on public.collections for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop trigger if exists collections_sync_stamp on public.collections;
create trigger collections_sync_stamp before insert or update on public.collections for each row execute function public.sync_stamp();
drop trigger if exists collections_sync_tomb on public.collections;
create trigger collections_sync_tomb after delete on public.collections for each row execute function public.sync_tomb('id');

-- المستحق الشهري للطالب بقواعد قسم الاشتراكات: مبلغه الخاص، أو فئته، أو الفئة الافتراضية لسنّه، مطروحًا منه خصمه
create or replace function public.fee_due(s public.members) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := coalesce((select value from settings where key = 'priv_fees'), '{}'); i jsonb := coalesce(s.info, '{}');
        base numeric; c jsonb; d jsonb; v numeric; t text; off numeric := 0;
begin
  if coalesce(i->>'fee', '') ~ '^[0-9]+(\.[0-9]+)?$' and (i->>'fee')::numeric > 0 then base := (i->>'fee')::numeric;
  else
    select x into c from jsonb_array_elements(coalesce(cfg->'cats', '[]')) x where x->>'id' = i->>'feeCat' limit 1;
    if c is null then select x into c from jsonb_array_elements(coalesce(cfg->'cats', '[]')) x where x->>'def' = (case when s.cat = 'adult' then 'adult' else 'child' end) limit 1; end if;
    if c is null then return null; end if;
    base := coalesce(nullif(c->>'amount', '')::numeric, 0);
  end if;
  select x into d from jsonb_array_elements(coalesce(cfg->'discs', '[]')) x where x->>'id' = i->>'feeDisc' limit 1;
  if d is not null then
    if coalesce(i->>'feeDiscVal', '') ~ '^[0-9]+(\.[0-9]+)?$' then v := (i->>'feeDiscVal')::numeric; t := coalesce(nullif(i->>'feeDiscType', ''), d->>'type');
    else v := case when coalesce((d->>'each')::boolean, false) then 0 else coalesce(nullif(d->>'value', '')::numeric, 0) end; t := d->>'type'; end if;
    off := least(base, greatest(0, case when t = 'amt' then v else base * v / 100 end));
  end if;
  return round(base - off, 2);
end $$;

-- مستحقات طلاب حلقة: لمعلمها أو مشرفها أو من يحصّل أو المدير (رقم المستحق فقط)
create or replace function public.student_dues(hid uuid) returns table (student_id uuid, due numeric)
language sql stable security definer set search_path = public as $$
  select m.id, public.fee_due(m) from members m
  where m.role = 'student' and m.halaqa_id = hid
    and (public.is_admin() or public.has_perm('fees.collect')
         or exists (select 1 from halaqat h where h.id = hid and (h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids()))))
$$;

-- المعلم: حفظ قائمة التحصيل (مسودة) أو إرسالها للمحاسب. الأسطر المؤكدة لا تتغير، والمُعادة تُستبدل بما صحّحه
create or replace function public.save_collection(hid uuid, yy int, mm int, lns jsonb, send boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare me record; c record; keep jsonb; newl jsonb; cid uuid;
begin
  select m.id, m.name into me from members m join halaqat h on h.teacher_id = m.id where h.id = hid and m.user_id = auth.uid() limit 1;
  if me.id is null then raise exception 'غير مصرح: هذه ليست حلقتك'; end if;
  if public.is_blocked() then raise exception 'حسابك موقوف'; end if;
  if mm < 1 or mm > 12 then raise exception 'شهر غير صحيح'; end if;
  select * into c from collections where teacher_id = me.id and halaqa_id = hid and y = yy and m = mm for update;
  if c.id is not null and c.status = 'sent' then raise exception 'القائمة عند المحاسب للمراجعة'; end if;
  if c.id is not null and c.status = 'done' then raise exception 'أكّد المحاسب القائمة كاملة'; end if;
  keep := coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(c.lines, '[]')) x where x->>'state' = 'ok'), '[]');
  newl := coalesce((select jsonb_agg(jsonb_build_object('studentId', x->>'studentId', 'amount', greatest(0, coalesce(nullif(x->>'amount', '')::numeric, 0)),
                                                      'note', left(coalesce(x->>'note', ''), 300), 'state', 'pending', 'accNote', ''))
    from jsonb_array_elements(coalesce(lns, '[]')) x
    where exists (select 1 from members s where s.id::text = x->>'studentId' and s.role = 'student' and s.halaqa_id = hid)
      and not exists (select 1 from jsonb_array_elements(keep) k where k->>'studentId' = x->>'studentId')
      and (coalesce(nullif(x->>'amount', '')::numeric, 0) > 0 or coalesce(x->>'note', '') <> '')), '[]');
  if send and jsonb_array_length(newl) = 0 then raise exception 'لا توجد مبالغ جديدة للإرسال'; end if;
  if c.id is null then
    insert into collections (teacher_id, teacher_name, halaqa_id, y, m, status, lines, sent_at)
    values (me.id, me.name, hid, yy, mm, case when send then 'sent' else 'draft' end, keep || newl, case when send then now() end) returning id into cid;
  else
    update collections set lines = keep || newl, teacher_name = me.name, status = case when send then 'sent' else 'draft' end,
      sent_at = case when send then now() else sent_at end where id = c.id;
    cid := c.id;
  end if;
  return cid;
end $$;

-- المحاسب: تأكيد الأسماء السليمة (تُسجَّل دفعات في الاشتراكات باسمه) أو إعادتها للمعلم بملاحظة — في عملية واحدة
create or replace function public.review_collection(cid uuid, decisions jsonb, note text) returns text
language plpgsql security definer set search_path = public as $$
declare me record; c record; L jsonb := '[]'; x jsonb; d jsonb; pend int := 0; iss int := 0; st text;
begin
  if not public.has_perm('fees.collect') then raise exception 'غير مصرح'; end if;
  select id, name into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'accountant') desc limit 1;
  select * into c from collections where id = cid for update;
  if c.id is null then raise exception 'القائمة غير موجودة'; end if;
  if c.status <> 'sent' then raise exception 'القائمة ليست بانتظار المراجعة'; end if;
  for x in select e from jsonb_array_elements(c.lines) e loop
    if x->>'state' = 'pending' then
      d := (select e from jsonb_array_elements(coalesce(decisions, '[]')) e where e->>'studentId' = x->>'studentId' limit 1);
      if d is null then pend := pend + 1;
      elsif coalesce((d->>'ok')::boolean, false) then
        if coalesce(nullif(x->>'amount', '')::numeric, 0) > 0 then
          insert into fees (id, student_id, y, m, amount, date, by_name, by_member, note)
          values (gen_random_uuid(), (x->>'studentId')::uuid, c.y, c.m, (x->>'amount')::numeric, current_date, me.name, me.id,
                  'تحصيل المعلم ' || coalesce(c.teacher_name, '') || coalesce(' — ' || nullif(x->>'note', ''), ''));
        end if;
        x := x || jsonb_build_object('state', 'ok', 'accNote', coalesce(d->>'note', ''));
      else
        x := x || jsonb_build_object('state', 'issue', 'accNote', coalesce(d->>'note', '')); iss := iss + 1;
      end if;
    end if;
    L := L || jsonb_build_array(x);
  end loop;
  st := case when iss > 0 then 'returned' when pend > 0 then 'sent' else 'done' end;
  update collections set lines = L, acc_note = coalesce(note, ''), reviewed_at = now(), reviewed_by = me.name, status = st where id = cid;
  return st;
end $$;

revoke all on function public.fee_due(public.members), public.student_dues(uuid), public.save_collection(uuid, int, int, jsonb, boolean), public.review_collection(uuid, jsonb, text) from public, anon;
grant execute on function public.student_dues(uuid), public.save_collection(uuid, int, int, jsonb, boolean), public.review_collection(uuid, jsonb, text) to authenticated;

-- المزامنة تعرف قوائم التحصيل (المدير والمحاسب: كلها، والمعلم: قوائمه)
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
