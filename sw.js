/* عامل الخدمة: يحفظ ملفات التطبيق على الجهاز ليعمل بدون إنترنت.
   الاستراتيجية: الشبكة أولًا (حتى تصل التحديثات فور الاتصال)، ثم النسخة المحفوظة عند انقطاعها. */
const CACHE = 'halaqat-v1';
const CORE = ['./', './style.css', './app.js', './payroll.js', './logo.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* إن تأخرت الشبكة أكثر من 4 ثوانٍ نعرض المحفوظ بدل الانتظار */
const timeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); no(err); }); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* مثل Google Sheets: تحتاج إنترنت دائمًا */
  e.respondWith(
    timeout(fetch(req), 4000)
      .then(res => {
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './' : req, copy)); }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true })
        .then(hit => hit || caches.match('./')))
  );
});
