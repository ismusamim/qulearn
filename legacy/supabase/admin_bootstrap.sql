-- =====================================================================
--  إنشاء أول حساب إداري (مرة واحدة فقط بعد تشغيل schema.sql)
--  1) من Authentication ← Users ← Add user ← Create new user:
--     Email: admin@qulearn.app   Password: (6 أحرف أو أرقام على الأقل)
--     وفعّل «Auto Confirm User»
--  2) ثم شغّل هذا الاستعلام (غيّر الاسم أو الإيميل إن أردت):
-- =====================================================================
insert into public.members (role, name, user_id, login_email)
select 'admin', 'المدير', id, email
from auth.users
where email = 'admin@qulearn.app';

-- للتأكد:
select id, role, name, login_email from public.members;
