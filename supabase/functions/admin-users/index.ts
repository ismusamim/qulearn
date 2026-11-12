// =====================================================================
//  Edge Function: admin-users (منشورة باسم dynamic-worker)
//  إنشاء حسابات الدخول للأعضاء وتغيير كلمات مرورهم — للإداري فقط.
//  يحتاج المفتاح السري، وهو متاح هنا تلقائيًا كمتغير بيئة على خوادم Supabase
//  ولا يصل أبدًا إلى المتصفح. التحقق من JWT من البوابة مقفول، لأن الدالة تتحقق بنفسها.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const EMAIL_DOMAIN = 'qulearn.app';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST فقط' }, 405);

  // المفاتيح الجديدة (publishable/secret) تأتي كقاموس JSON باسم default، والقديمة كنص مباشر
  const named = (v: string) => { try { return JSON.parse(Deno.env.get(v) ?? '{}').default as string | undefined; } catch { return undefined; } };
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = named('SUPABASE_PUBLISHABLE_KEYS') ?? Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = named('SUPABASE_SECRET_KEYS') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'مفاتيح المشروع غير متاحة للدالة' }, 500);

  // التحقق من أن الطالب إداري، بصلاحياته هو لا بصلاحيات الخادم
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: isAdmin, error: e0 } = await caller.rpc('is_admin');
  if (e0 || !isAdmin) return json({ error: 'غير مصرح: هذه العملية للإداري فقط' }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'طلب غير صالح' }, 400); }

  // provision: إنشاء حساب دخول لكل عضو (أو تحديث كلمة مروره إن كان له حساب)
  // body.items = [{ member_id, password, share_with? }]
  if (body.action === 'provision') {
    const items: { member_id: string; password: string; share_with?: string }[] = Array.isArray(body.items) ? body.items : [];
    if (items.length > 200) return json({ error: 'الحد الأقصى 200 عضو في الطلب الواحد' }, 400);
    const results: unknown[] = [];
    for (const it of items) {
      try {
        if (!it.password || String(it.password).length < 6) throw new Error('كلمة المرور 6 أحرف أو أرقام على الأقل');
        const { data: m, error } = await admin.from('members').select('id, name, user_id, login_email').eq('id', it.member_id).single();
        if (error || !m) throw new Error('العضو غير موجود');
        let userId = m.user_id as string | null, email = m.login_email as string | null;
        if (!userId && it.share_with) {
          const { data: o } = await admin.from('members').select('user_id, login_email').eq('id', it.share_with).single();
          if (o?.user_id) { userId = o.user_id; email = o.login_email; }
        }
        if (userId) {
          const { error: e1 } = await admin.auth.admin.updateUserById(userId, { password: String(it.password) });
          if (e1) throw e1;
        } else {
          email = `m-${m.id.replace(/-/g, '').slice(0, 16)}@${EMAIL_DOMAIN}`;
          const { data: u, error: e2 } = await admin.auth.admin.createUser({
            email, password: String(it.password), email_confirm: true, user_metadata: { name: m.name },
          });
          if (e2 || !u.user) throw e2 ?? new Error('تعذّر إنشاء الحساب');
          userId = u.user.id;
        }
        const { error: e3 } = await admin.from('members').update({ user_id: userId, login_email: email }).eq('id', m.id);
        if (e3) throw e3;
        results.push({ member_id: m.id, ok: true });
      } catch (err) {
        results.push({ member_id: it.member_id, ok: false, error: String((err as Error)?.message ?? err) });
      }
    }
    return json({ results });
  }

  // remove: حذف حساب الدخول لعضو (لا يُحذف إن كان مشتركًا مع عضو آخر بنفس الاسم)
  if (body.action === 'remove') {
    const { data: m } = await admin.from('members').select('id, user_id').eq('id', body.member_id).single();
    if (!m?.user_id) return json({ ok: true });
    const { count } = await admin.from('members').select('id', { count: 'exact', head: true }).eq('user_id', m.user_id);
    await admin.from('members').update({ user_id: null, login_email: null }).eq('id', m.id);
    if ((count ?? 0) <= 1) await admin.auth.admin.deleteUser(m.user_id);
    return json({ ok: true });
  }

  return json({ error: 'إجراء غير معروف' }, 400);
});
