'use strict';
/* ============ توزيع الصلاحيات (للمدير) ============
   - صلاحيات لكل فئة (المعلمون، المشرفون)، واستثناءات لأفراد بأعينهم: «حسب فئته» أو «مسموح» أو «ممنوع».
   - استثناء الفرد يتقدّم على صلاحية فئته، والمدير يملك كل الصلاحيات دائمًا.
   - الإعدادات في db.settings.priv_perms (لا يقرؤها على الخادم إلا المدير)، والتحقق الفعلي على الخادم بالدالة has_perm.
   - كل صلاحية جديدة تُعرَّف هنا بـ Perms.define({ key, label, desc }) ومعها قاعدتها على الخادم، فتظهر في الجدول تلقائيًا.
   - يعرف كل مستخدم صلاحياته من الخادم (my_perms)، ويسألها التطبيق بـ can('<صلاحية>'). */
(() => {
  const DEFS = [];
  const ROLE_COLS = [['teacher', 'المعلمون', 'teachers'], ['supervisor', 'المشرفون', 'supervisors']];
  const st = { q: '' };

  TABS.admin.splice(TABS.admin.findIndex(t => t[0] === 'settings'), 0, ['perms', 'الصلاحيات']);
  TAB_ICONS.perms = svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.4"/>');
  adminViews.perms = () => view();
  setTimeout(() => { try { if (!VFILES.includes('./perms.js')) VFILES.push('./perms.js'); } catch (e) { /* ignore */ } }, 0);

  const cfg = () => { const c = db.settings.priv_perms || {}; return { roles: c.roles || {}, members: c.members || {} }; };
  const setCfg = c => { db.settings.priv_perms = { roles: c.roles, members: c.members }; save(); };
  const staff = () => ROLE_COLS.flatMap(([r, , coll]) => (db[coll] || []).map(m => ({ m, role: r })));
  const roleL = r => ({ teacher: 'معلم', supervisor: 'مشرف' })[r] || r;

  /* هل يملك المستخدم الحالي الصلاحية؟ المدير دائمًا؛ وغيره بحسب ما أرسله الخادم */
  function can(p) {
    if (!session) return false;
    if (session.role === 'admin') return true;
    if (!CLOUD) {
      const c = cfg(), o = (c.members[session.id] || {})[p];
      return o !== undefined ? !!o : !!(c.roles[session.role] || {})[p];
    }
    return (db.myPerms || []).includes(p);
  }
  const effective = (id, role, p) => { const c = cfg(), o = (c.members[id] || {})[p]; return o !== undefined ? !!o : !!(c.roles[role] || {})[p]; };

  function view() {
    const c = cfg();
    if (!DEFS.length) {
      return `<div class="card"><h2>توزيع الصلاحيات</h2>
        <div class="note">لا توجد صلاحيات قابلة للتوزيع بعد. حين تحدد صلاحية (مثل تحصيل الاشتراكات أو نشر الإعلانات) ونطاقها، تُضاف قاعدتها على الخادم فتظهر هنا تلقائيًا، ويمكنك حينها:</div>
        <ul style="margin:.4rem 0 0;line-height:2">
          <li><b>صلاحيات لكل فئة:</b> تمنحها لكل المعلمين أو كل المشرفين بمربع اختيار.</li>
          <li><b>صلاحيات لأفراد:</b> تمنحها لشخص بعينه أو تسحبها منه، أيًّا كانت صلاحية فئته.</li>
        </ul>
        <p class="muted" style="font-size:.85rem;margin:.8rem 0 0">المدير يملك كل الصلاحيات دائمًا. والتحقق يتم على الخادم، فلا يكفي إخفاء الزر لتجاوزها.</p></div>`;
    }
    const roleTable = `<div class="tbl"><table><tr><th>الصلاحية</th>${ROLE_COLS.map(([, l]) => `<th style="text-align:center">${l}</th>`).join('')}</tr>
      ${DEFS.map(d => `<tr><td><b>${esc(d.label)}</b>${d.desc ? `<br><small class="muted">${esc(d.desc)}</small>` : ''}</td>${ROLE_COLS.map(([r, l]) => `<td style="text-align:center"><input type="checkbox" data-prole="${r}" data-perm="${esc(d.key)}" ${(c.roles[r] || {})[d.key] ? 'checked' : ''} aria-label="${esc(d.label)} — ${l}"></td>`).join('')}</tr>`).join('')}</table></div>`;
    const ids = Object.keys(c.members);
    const people = staff();
    const exRows = ids.map(id => {
      const p = people.find(x => x.m.id === id);
      if (!p) return '';
      return `<tr><td><b>${esc(p.m.name)}</b><br><small class="muted">${roleL(p.role)}</small></td>${DEFS.map(d => {
        const o = (c.members[id] || {})[d.key], v = o === undefined ? '' : o ? '1' : '0';
        return `<td><select data-pmem="${esc(id)}" data-perm="${esc(d.key)}" style="width:auto">
          <option value="" ${v === '' ? 'selected' : ''}>حسب فئته (${(c.roles[p.role] || {})[d.key] ? 'مسموح' : 'ممنوع'})</option>
          <option value="1" ${v === '1' ? 'selected' : ''}>مسموح</option><option value="0" ${v === '0' ? 'selected' : ''}>ممنوع</option></select></td>`;
      }).join('')}<td><button type="button" class="btn sm danger" data-pclear="${esc(id)}">إلغاء الاستثناء</button></td></tr>`;
    }).join('');
    const q = norm(st.q), cand = q ? people.filter(x => !ids.includes(x.m.id) && norm(x.m.name).includes(q)).slice(0, 8) : [];
    return `<div class="card"><h2>صلاحيات الفئات</h2>
        <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">ما تختاره هنا يسري على كل أفراد الفئة، إلا من له استثناء أدناه. المدير يملك كل الصلاحيات دائمًا.</p>${roleTable}</div>
      <div class="card"><h2>استثناءات لأفراد</h2>
        <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">امنح صلاحية لشخص بعينه أو اسحبها منه، أيًّا كانت صلاحية فئته.</p>
        <div class="combo" style="max-width:420px"><label>إضافة شخص<input type="search" data-pq value="${esc(st.q)}" placeholder="اكتب اسم معلم أو مشرف" autocomplete="off"></label>
          ${cand.length ? `<div class="results">${cand.map(x => `<button type="button" class="opt" data-padd="${esc(x.m.id)}">${esc(x.m.name)} <small class="muted">— ${roleL(x.role)}</small></button>`).join('')}</div>` : q ? '<p class="muted">لا نتائج.</p>' : ''}</div>
        ${exRows ? `<div class="tbl" style="margin-top:.8rem"><table><tr><th>الشخص</th>${DEFS.map(d => `<th>${esc(d.label)}</th>`).join('')}<th></th></tr>${exRows}</table></div>` : '<p class="muted" style="margin-top:.8rem">لا توجد استثناءات.</p>'}</div>`;
  }

  document.addEventListener('change', e => {
    const t = e.target, d = t.dataset || {};
    if (d.prole) { const c = cfg(); c.roles[d.prole] = { ...(c.roles[d.prole] || {}), [d.perm]: t.checked }; if (!t.checked) delete c.roles[d.prole][d.perm]; setCfg(c); toast('حُفظ'); return; }
    if (d.pmem) {
      const c = cfg(), m = { ...(c.members[d.pmem] || {}) };
      if (t.value === '') delete m[d.perm]; else m[d.perm] = t.value === '1';
      c.members = { ...c.members, [d.pmem]: m }; setCfg(c); render(); toast('حُفظ');
    }
  });
  document.addEventListener('input', e => {
    if (!('pq' in (e.target.dataset || {}))) return;
    st.q = e.target.value; render();
    const i = document.querySelector('[data-pq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-padd]');
    if (a) { const c = cfg(); c.members = { ...c.members, [a.dataset.padd]: c.members[a.dataset.padd] || {} }; st.q = ''; setCfg(c); render(); return; }
    const x = e.target.closest('[data-pclear]');
    if (x) { const c = cfg(), m = { ...c.members }; delete m[x.dataset.pclear]; c.members = m; setCfg(c); render(); toast('أُلغي الاستثناء'); }
  });

  window.Perms = {
    /* تعريف صلاحية قابلة للتوزيع: { key, label, desc } */
    define(def) { if (def?.key && !DEFS.some(x => x.key === def.key)) DEFS.push(def); },
    get list() { return DEFS.slice(); },
    can
  };
})();
