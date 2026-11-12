-- =====================================================================
-- توزيع الصلاحيات: صلاحيات لكل فئة، واستثناءات لأفراد بأعينهم
-- الإعدادات تُحفظ في settings بالمفتاح priv_perms (لا يقرؤه إلا المدير، بعد fees_private.sql):
--   { "roles":   { "teacher": { "<صلاحية>": true }, "supervisor": { ... } },
--     "members": { "<معرّف العضو>": { "<صلاحية>": true | false } } }
-- استثناء الفرد يتقدّم على صلاحية فئته، والمدير يملك كل الصلاحيات دائمًا.
-- كل صلاحية جديدة تستخدم public.has_perm('<صلاحية>') في قواعد جداولها.
-- يُنفَّذ مرة واحدة، وآمن للتكرار.
-- =====================================================================
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from members m
    cross join (select coalesce((select value from settings where key = 'priv_perms'), '{}'::jsonb) v) c
    where m.user_id = auth.uid()
      and coalesce((c.v -> 'members' -> (m.id::text) ->> p)::boolean,
                   (c.v -> 'roles' -> m.role ->> p)::boolean,
                   false)
  )
$$;

-- صلاحيات المستخدم الحالي (ليعرف التطبيق ما يعرضه له؛ والحماية الفعلية في has_perm)
create or replace function public.my_perms() returns text[]
language sql stable security definer set search_path = public as $$
  with c as (select coalesce((select value from settings where key = 'priv_perms'), '{}'::jsonb) v),
  keys as (
    select distinct k from members m, c,
      lateral jsonb_object_keys(coalesce(c.v -> 'roles' -> m.role, '{}'::jsonb) || coalesce(c.v -> 'members' -> (m.id::text), '{}'::jsonb)) k
    where m.user_id = auth.uid()
  )
  select coalesce(array_agg(k order by k), '{}') from keys where public.has_perm(k)
$$;

revoke all on function public.has_perm(text) from public, anon;
revoke all on function public.my_perms() from public, anon;
grant execute on function public.has_perm(text), public.my_perms() to authenticated;

notify pgrst, 'reload schema';
