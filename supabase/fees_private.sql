-- =====================================================================
-- فئات الاشتراكات وخصوماتها: تُحفظ في جدول الإعدادات بمفتاح يبدأ بـ priv_
-- هذا الأمر يجعل هذه المفاتيح للمدير وحده (بقية الإعدادات كاسم المؤسسة والشعار
-- تبقى ظاهرة في صفحة الدخول كما هي). يُنفَّذ مرة واحدة، وآمن للتكرار.
-- =====================================================================
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to anon, authenticated
  using (key not like 'priv\_%' or public.is_admin());

notify pgrst, 'reload schema';
