// ===== CONFIG =====
const _cfg = window.__CONFIG__ || {};
const API  = _cfg.API_URL || (window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://e-comerce-bot-main-production.up.railway.app');

let token     = localStorage.getItem('adminToken');
let adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');
let ordersSkip = 0;
let autoRefreshTimer = null;
let dragSrc = null;
let _empPhotoBase64 = null;

// ===== HELPERS =====
function $(id) { return document.getElementById(id); }

function toast(msg, type = 'ok') {
  const box = $('adminToasts');
  const el  = document.createElement('div');
  const bg  = type === 'ok' ? 'bg-green-500' : type === 'err' ? 'bg-red-500' : 'bg-blue-500';
  el.className = `${bg} text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl`;
  el.style.cssText = 'animation:toastIn .3s ease;min-width:140px';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 3000);
}

function fmtSalary(n) {
  if (!n) return '0 soʼm';
  return Number(n).toLocaleString('uz-UZ') + ' soʼm';
}

function fmtMins(m) {
  if (!m) return '—';
  const h = Math.floor(m/60), min = m%60;
  return h ? `${h}s ${min}d` : `${min}d`;
}

function fmtDate(d) {
  return new Date(d).toLocaleString('uz-UZ', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function statusColor(s) {
  const map = {
    'Yangi':          'bg-blue-500/20 text-blue-400',
    'Qabul qilindi':  'bg-green-500/20 text-green-400',
    'Bekor qilindi':  'bg-red-500/20 text-red-400',
    'Tayyorlanmoqda': 'bg-yellow-500/20 text-yellow-400',
    'Bajarildi':      'bg-emerald-500/20 text-emerald-400',
  };
  return map[s] || 'bg-gray-500/20 text-gray-400';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

async function api(url, opts = {}) {
  try {
    const r = await fetch(API + url, { method: opts.method || 'GET', headers: authHeaders(), body: opts.body });
    if (r.status === 401) { logout(); return { error: 'Sessiya tugadi' }; }
    if (r.status === 403) {
      const d = await r.json();
      if (d.blocked) { showBlocked(d.message); return d; }
      return d;
    }
    return await r.json();
  } catch(e) { return { error: e.message }; }
}

function closeModal(id) {
  $(id).classList.add('hidden');
}

// ===== BLOCKED =====
function showBlocked(reason) {
  $('loginPage').style.display = 'none';
  $('app').classList.add('hidden');
  const el = $('blockedScreen');
  $('blockedReason').textContent = reason || '';
  el.classList.remove('hidden');
}

// ===== AUTH =====
async function doLogin() {
  const username = $('loginUser').value.trim();
  const password = $('loginPass').value;
  const err = $('loginErr');
  err.classList.add('hidden');
  if (!username || !password) { err.textContent = 'Login va parol kiriting'; err.classList.remove('hidden'); return; }

  const btn = event.target;
  btn.textContent = 'Tekshirilmoqda...'; btn.disabled = true;

  try {
    const d = await fetch(API + '/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(r => r.json());

    if (!d.ok) {
      if (d.blocked) { showBlocked(d.message); return; }
      err.textContent = '❌ ' + (d.error || 'Xato'); err.classList.remove('hidden');
      $('loginPass').value = '';
      return;
    }
    token     = d.token;
    adminInfo = d.admin;
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminInfo', JSON.stringify(adminInfo));
    startApp();
  } catch(e) {
    err.textContent = '🔌 Server bilan ulanib bolmadi'; err.classList.remove('hidden');
  } finally {
    btn.textContent = 'Kirish →'; btn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminInfo');
  token = null;
  $('app').classList.add('hidden');
  $('loginPage').style.display = 'flex';
  clearInterval(autoRefreshTimer);
}

// ===== START APP =====
async function startApp() {
  const rId = adminInfo.restaurantId;
  if (rId && adminInfo.role !== 'superadmin') {
    try {
      const d = await fetch(API + '/check-block/' + rId).then(r => r.json());
      if (d.blocked) { showBlocked(d.reason); return; }
    } catch(e) {}
  }
  $('loginPage').style.display = 'none';
  $('app').classList.remove('hidden');
  $('sideRestName').textContent = adminInfo.restaurantName || 'Restoran';
  $('sideUsername').textContent  = '@' + (adminInfo.username || '');
  showSection('dashboard');
  startBlockCheck();
}

function startBlockCheck() {
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(async () => {
    if (!token || adminInfo.role === 'superadmin') return;
    try {
      const d = await fetch(API + '/check-block/' + adminInfo.restaurantId).then(r => r.json());
      if (d.blocked) showBlocked(d.reason);
    } catch(e) {}
  }, 60000);
}

function toggleAutoRefresh() {
  // Simple: har 30 sek yangilash
  if (window._autoOn) {
    clearInterval(window._autoInterval);
    window._autoOn = false;
    toast('Auto yangilash o\'chirildi', 'info');
  } else {
    window._autoOn = true;
    window._autoInterval = setInterval(() => showSection(window._currentSection || 'dashboard'), 30000);
    toast('Auto yangilash yoqildi ✓');
  }
}

// Init
if (token) {
  const rId = adminInfo?.restaurantId;
  if (rId && adminInfo?.role !== 'superadmin') {
    fetch(API + '/check-block/' + rId).then(r => r.json()).then(d => {
      if (d.blocked) { $('loginPage').style.display='none'; showBlocked(d.reason); }
      else startApp();
    }).catch(() => startApp());
  } else if (token) {
    startApp();
  }
}

// ===== NAV =====
function showSection(name) {
  window._currentSection = name;
  // Hide all sections
  document.querySelectorAll('[id^="sec-"]').forEach(s => s.classList.add('hidden'));
  // Show target
  const sec = $('sec-' + name);
  if (sec) sec.classList.remove('hidden');

  // Sidebar active
  document.querySelectorAll('[data-nav]').forEach(b => {
    b.classList.toggle('active', b.dataset.nav === name);
    if (b.dataset.nav !== name) {
      b.classList.remove('bg-blue-500/10', 'text-accent');
      b.classList.add('text-gray-400');
    } else {
      b.classList.add('bg-blue-500/10', 'text-accent');
      b.classList.remove('text-gray-400');
    }
  });

  // Mobile nav active
  document.querySelectorAll('[data-mnav]').forEach(b => {
    b.classList.toggle('text-accent', b.dataset.mnav === name);
    b.classList.toggle('text-gray-500', b.dataset.mnav !== name);
  });

  const titles = { dashboard:'Dashboard', orders:'Buyurtmalar', products:'Mahsulotlar', categories:'Kategoriyalar', users:'Mijozlar', broadcast:'Xabar yuborish', branches:'Filiallar', employees:'Ishchilar', attendance:'Davomat' };
  $('pageTitle') && ($('pageTitle').textContent = titles[name] || name);
  $('mobileTitle') && ($('mobileTitle').textContent = titles[name] || name);

  // Load data
  if (name === 'dashboard')  loadDashboard();
  if (name === 'orders')     loadOrders(true);
  if (name === 'products')   loadProducts();
  if (name === 'categories') loadCategories();
  if (name === 'users')      loadUsers();
  if (name === 'branches')   loadBranches();
  if (name === 'employees')  loadEmployees();
  if (name === 'attendance') { initAttendance(); loadAttendance(); }
}

// ===== DASHBOARD =====
async function loadDashboard() {
  const stats = await api('/admin/stats');
  if (!stats || stats.error) return;

  $('stat-todayOrders').textContent = stats.today.orders;
  $('stat-todayRev').textContent    = Number(stats.today.revenue).toLocaleString() + ' soʼm';
  $('stat-monthOrders').textContent = stats.month.orders;
  $('stat-users').textContent       = stats.totalUsers;

  // Chart
  const wrap = $('chartWrap');
  if (wrap && stats.weekly?.length) {
    const max = Math.max(...stats.weekly.map(d => d.orders), 1);
    wrap.innerHTML = stats.weekly.map(d => {
      const pct = Math.round((d.orders / max) * 100);
      return `
      <div class="flex-1 flex flex-col items-center gap-1">
        <span class="text-xs font-bold text-accent">${d.orders || ''}</span>
        <div class="w-full bg-bg3 rounded-t-lg relative" style="height:96px">
          <div class="absolute bottom-0 inset-x-0 bg-accent/70 rounded-t-lg transition-all bar" style="height:${pct}%"></div>
        </div>
        <span class="text-xs text-gray-500">${d.date}</span>
      </div>`;
    }).join('');
  }

  // Top products
  const topEl = $('topProducts');
  if (topEl && stats.topProducts?.length) {
    topEl.innerHTML = stats.topProducts.map((p, i) => `
      <div class="flex items-center gap-3">
        <span class="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs font-black flex items-center justify-center">${i+1}</span>
        <span class="flex-1 text-sm text-gray-300 truncate">${p._id}</span>
        <span class="text-xs font-black text-gold">${p.quantity} ta</span>
      </div>`).join('');
  }

  // Rating
  const ratingEl = $('ratingBlock');
  if (ratingEl) {
    ratingEl.innerHTML = stats.rating.avg
      ? `<div class="text-4xl font-black text-gold">${stats.rating.avg} ⭐</div>
         <div class="text-xs text-gray-500 mt-1">${stats.rating.count} ta baho</div>`
      : `<div class="text-gray-500 text-sm">Hali baho yo'q</div>`;
  }

  // Recent orders
  const recentEl = $('recentOrders');
  if (recentEl) {
    const od = await api('/admin/orders?limit=5');
    if (od?.orders) {
      recentEl.innerHTML = od.orders.map(o => {
        const name = ((o.userInfo?.first_name||'') + ' ' + (o.userInfo?.last_name||'')).trim() || '—';
        return `
        <div class="flex items-center justify-between bg-bg3 rounded-xl px-4 py-3 gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-white truncate">${name}</p>
            <p class="text-xs text-gray-500 truncate">${o.items.map(i=>i.name+'×'+i.quantity).join(', ')}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-black text-gold">${Number(o.total).toLocaleString()}</p>
            <span class="text-xs px-2 py-0.5 rounded-full ${statusColor(o.status)}">${o.status}</span>
          </div>
        </div>`;
      }).join('');
    }
  }
}

// ===== ORDERS =====
async function loadOrders(reset = false) {
  if (reset) ordersSkip = 0;
  const status = $('orderStatusFilter')?.value || '';
  const type   = $('orderTypeFilter')?.value   || '';
  let url = `/admin/orders?limit=30&skip=${ordersSkip}`;
  if (status) url += '&status=' + encodeURIComponent(status);
  if (type)   url += '&type=' + type;

  const data = await api(url);
  if (!data?.orders) return;

  const list = $('ordersList');
  if (!list) return;

  const rows = data.orders.map(o => {
    const name  = ((o.userInfo?.first_name||'') + ' ' + (o.userInfo?.last_name||'')).trim() || '—';
    const phone = o.userInfo?.phone || '';
    return `
    <div class="bg-card rounded-2xl p-4 border border-white/5">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div>
          <p class="font-bold text-white text-sm">${name} ${phone ? '<span class="text-gray-500 font-normal text-xs">'+phone+'</span>' : ''}</p>
          <p class="text-xs text-gray-500 mt-0.5">${fmtDate(o.createdAt)} · ${o.orderType==='online'?'🛵 Online':'🍽 Stol '+o.tableNumber}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="font-black text-gold text-sm">${Number(o.total).toLocaleString()}</p>
          <span class="text-xs px-2 py-0.5 rounded-full ${statusColor(o.status)}">${o.status}</span>
        </div>
      </div>
      <p class="text-xs text-gray-400 mb-3">${o.items.map(i=>i.name+' ×'+i.quantity).join(' · ')}</p>
      <div class="flex gap-1.5 flex-wrap">
        ${['Qabul qilindi','Tayyorlanmoqda','Bajarildi','Bekor qilindi'].map(s =>
          `<button onclick="changeStatus('${o._id}','${s}')" class="press text-xs px-2.5 py-1.5 rounded-xl border border-white/10 bg-bg3 text-gray-400 hover:text-white transition-colors font-bold">${s}</button>`
        ).join('')}
      </div>
    </div>`;
  }).join('');

  if (reset) list.innerHTML = rows;
  else list.innerHTML += rows;

  const moreBtn = $('ordersMore');
  if (moreBtn) {
    moreBtn.classList.toggle('hidden', data.orders.length < 30);
    ordersSkip += data.orders.length;
  }
}

async function loadMoreOrders() {
  await loadOrders(false);
}

async function changeStatus(id, status) {
  await api('/admin/orders/' + id + '/status', { method:'PUT', body: JSON.stringify({ status }) });
  loadOrders(true);
  toast('Status yangilandi ✓');
}

// ===== PRODUCTS =====
async function loadProducts() {
  const [prods, cats] = await Promise.all([api('/admin/products'), api('/admin/categories')]);
  if (!Array.isArray(prods)) return;

  // Fill cat select
  const pCat = $('pCat');
  if (pCat && Array.isArray(cats)) {
    pCat.innerHTML = '<option value="">Kategoriya</option>' + cats.map(c => `<option value="${c.name}">${c.emoji||''} ${c.name}</option>`).join('');
  }

  const el = $('productsList');
  if (!el) return;

  el.innerHTML = prods.map(p => `
    <div class="bg-card rounded-2xl overflow-hidden border border-white/5 ${p.active===false?'opacity-50':''}">
      ${p.image
        ? `<img src="${p.image}" alt="${p.name}" class="w-full h-36 object-cover"/>`
        : `<div class="w-full h-36 bg-bg3 flex items-center justify-center text-5xl">🍽</div>`}
      <div class="p-3">
        <p class="font-bold text-white text-sm">${p.name}</p>
        ${p.name_ru ? `<p class="text-xs text-gray-500">${p.name_ru}</p>` : ''}
        <p class="font-black text-gold text-sm mt-1">${Number(p.price).toLocaleString()} soʼm</p>
        <p class="text-xs text-gray-500 mb-3">${p.category} ${p.active===false?'· Yashirilgan':''}</p>
        <div class="flex gap-2">
          <button onclick="openProductModal(${JSON.stringify(JSON.stringify(p))})" class="press flex-1 py-1.5 rounded-xl bg-accent/10 text-accent text-xs font-bold border border-accent/20">✏️ Tahrir</button>
          <button onclick="deleteProduct(${p.id})" class="press px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

function openProductModal(pJson) {
  const p = pJson ? JSON.parse(pJson) : null;
  $('productModalTitle').textContent = p ? 'Tahrirlash' : 'Yangi mahsulot';
  $('pName').value       = p?.name    || '';
  $('pNameRu').value     = p?.name_ru || '';
  $('pPrice').value      = p?.price   || '';
  $('pImage').value      = p?.image   || '';
  $('pActive').checked   = p?.active !== false;
  $('pEditId').value     = p?.id      || '';
  if (p?.image) { $('pImagePreview').src = p.image; $('pImagePreview').classList.remove('hidden'); }
  else $('pImagePreview').classList.add('hidden');
  if (p?.category) $('pCat').value = p.category;
  $('productModal').classList.remove('hidden');
}

function previewProduct(input) {
  if (!input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    $('pImage').value = e.target.result;
    $('pImagePreview').src = e.target.result;
    $('pImagePreview').classList.remove('hidden');
  };
  reader.readAsDataURL(input.files[0]);
}

async function saveProduct() {
  const id   = $('pEditId').value;
  const body = {
    name:     $('pName').value.trim(),
    name_ru:  $('pNameRu').value.trim(),
    price:    Number($('pPrice').value),
    category: $('pCat').value,
    image:    $('pImage').value.trim(),
    active:   $('pActive').checked
  };
  if (!body.name || !body.price) { toast('Nom va narx kerak', 'err'); return; }
  if (id) await api('/admin/products/' + id, { method:'PUT',  body: JSON.stringify(body) });
  else    await api('/admin/products',        { method:'POST', body: JSON.stringify(body) });
  closeModal('productModal');
  loadProducts();
  toast('Saqlandi ✓');
}

async function deleteProduct(id) {
  if (!confirm('O\'chirilsinmi?')) return;
  await api('/admin/products/' + id, { method:'DELETE' });
  loadProducts();
  toast('O\'chirildi');
}

// ===== CATEGORIES =====
async function loadCategories() {
  const cats = await api('/admin/categories');
  if (!Array.isArray(cats)) return;
  const el = $('catsList');
  if (!el) return;

  el.innerHTML = cats.map(c => `
    <div class="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 border border-white/5 cat-row" draggable="true" data-id="${c._id}">
      <span class="text-gray-500 cursor-grab text-lg">⠿</span>
      <span class="text-xl">${c.emoji||'🍽'}</span>
      <div class="flex-1">
        <p class="font-bold text-white text-sm">${c.name} ${c.name_ru?`<span class="text-gray-500 font-normal text-xs">/ ${c.name_ru}</span>`:''}</p>
        <p class="text-xs text-gray-500">Tartib: ${c.order}</p>
      </div>
      <div class="flex gap-2">
        <button onclick="openCatModal(${JSON.stringify(JSON.stringify(c))})" class="press px-3 py-1.5 rounded-xl bg-accent/10 text-accent text-xs font-bold">✏️</button>
        <button onclick="deleteCat('${c._id}')" class="press px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold">🗑</button>
      </div>
    </div>`).join('');

  // Drag & drop
  el.querySelectorAll('.cat-row').forEach(row => {
    row.addEventListener('dragstart', e => { dragSrc = row; });
    row.addEventListener('dragover',  e => { e.preventDefault(); });
    row.addEventListener('drop', async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      const rows = Array.from(el.querySelectorAll('.cat-row'));
      const si = rows.indexOf(dragSrc), ti = rows.indexOf(row);
      if (si < ti) el.insertBefore(dragSrc, row.nextSibling);
      else el.insertBefore(dragSrc, row);
      const order = Array.from(el.querySelectorAll('.cat-row')).map((r,i) => ({ id: r.dataset.id, order: i+1 }));
      await api('/admin/categories/reorder/save', { method:'PUT', body: JSON.stringify({ order }) });
      toast('Tartib saqlandi ✓');
    });
  });
}

function openCatModal(cJson) {
  const c = cJson ? JSON.parse(cJson) : null;
  $('catModalTitle').textContent = c ? 'Tahrirlash' : 'Yangi kategoriya';
  $('cName').value   = c?.name    || '';
  $('cNameRu').value = c?.name_ru || '';
  $('cEmoji').value  = c?.emoji   || '🍽';
  $('cEditId').value = c?._id     || '';
  $('catModal').classList.remove('hidden');
}

async function saveCat() {
  const id = $('cEditId').value;
  const body = { name: $('cName').value.trim(), name_ru: $('cNameRu').value.trim(), emoji: $('cEmoji').value.trim() || '🍽' };
  if (!body.name) { toast('Nom kerak', 'err'); return; }
  if (id) await api('/admin/categories/' + id, { method:'PUT',  body: JSON.stringify(body) });
  else    await api('/admin/categories',        { method:'POST', body: JSON.stringify(body) });
  closeModal('catModal');
  loadCategories();
  toast('Saqlandi ✓');
}

async function deleteCat(id) {
  if (!confirm('O\'chirilsinmi?')) return;
  await api('/admin/categories/' + id, { method:'DELETE' });
  loadCategories();
}

// ===== USERS =====
async function loadUsers() {
  const users = await api('/admin/users');
  if (!Array.isArray(users)) return;
  const el = $('usersList');
  if (!el) return;
  el.innerHTML = users.map(u => `
    <div class="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 border border-white/5">
      <div class="w-9 h-9 bg-accent/20 rounded-xl flex items-center justify-center font-black text-accent text-sm shrink-0">
        ${(u.first_name||'?')[0].toUpperCase()}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-white text-sm">${(u.first_name||'') + ' ' + (u.last_name||'')}</p>
        <p class="text-xs text-gray-500">${u.username ? '@'+u.username : ''} ${u.phone||''}</p>
      </div>
      <span class="text-xs text-gray-600">${new Date(u.createdAt).toLocaleDateString('uz-UZ')}</span>
    </div>`).join('');
}

// ===== BROADCAST =====
function previewBroadcast(input) {
  if (!input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    $('bcPreview').src = e.target.result;
    $('bcPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(input.files[0]);
}

async function sendBroadcast(btn) {
  const text       = $('bcText').value.trim();
  const fileInput  = $('bcFile');
  const resEl      = $('bcResult');
  resEl.classList.add('hidden');

  if (!text) { toast('Matn kiriting', 'err'); return; }

  let imageBase64 = null;
  if (fileInput?.files?.[0]) {
    imageBase64 = await new Promise(res => {
      const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(fileInput.files[0]);
    });
  }

  btn.disabled = true; btn.textContent = 'Yuborilmoqda...';

  const d = await api('/admin/broadcast', { method:'POST', body: JSON.stringify({ text, imageBase64 }) });

  btn.disabled = false; btn.textContent = '📤 Yuborish';

  if (d?.ok) {
    resEl.className = 'text-xs font-bold rounded-xl p-3 bg-green-500/10 text-green-400';
    resEl.textContent = `✅ Yuborildi: ${d.sent} ta · Xato: ${d.failed} ta`;
    resEl.classList.remove('hidden');
    $('bcText').value = ''; $('bcPreview').classList.add('hidden');
    if (fileInput) fileInput.value = '';
  } else {
    toast(d?.error || 'Xato', 'err');
  }
}

// ===== BRANCHES =====
let branchMapInst = null, branchMarkerInst = null;

async function loadBranches() {
  const d = await api('/admin/branches');
  const branches = d.branches || [];
  const el = $('branchesList');
  if (!el) return;
  el.innerHTML = branches.length ? branches.map(b => `
    <div class="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 border border-white/5">
      <div class="flex-1 min-w-0">
        <p class="font-bold text-white text-sm">${b.name}</p>
        <p class="text-xs text-gray-500">${b.address||'Manzil yoq'}</p>
        ${b.lat ? `<p class="text-xs text-accent mt-0.5">📍 ${b.lat.toFixed(4)}, ${b.lng.toFixed(4)} · ${b.radius||100}m</p>` : '<p class="text-xs text-gold mt-0.5">⚠️ Lokatsiya belgilanmagan</p>'}
      </div>
      <div class="flex gap-2">
        <button onclick="openBranchModal(${JSON.stringify(JSON.stringify(b))})" class="press px-3 py-1.5 rounded-xl bg-accent/10 text-accent text-xs font-bold">✏️</button>
        <button onclick="deleteBranch('${b._id}')" class="press px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold">🗑</button>
      </div>
    </div>`).join('')
    : `<div class="text-center py-12 text-gray-500 text-sm">Hali filial qo'shilmagan</div>`;
}

function openBranchModal(bJson) {
  const b = bJson ? JSON.parse(bJson) : null;
  $('branchModalTitle').textContent = b ? 'Tahrirlash' : 'Yangi filial';
  $('brName').value    = b?.name    || '';
  $('brAddress').value = b?.address || '';
  $('brRadius').value  = b?.radius  || 100;
  $('brLat').value     = b?.lat     || '';
  $('brLng').value     = b?.lng     || '';
  $('brEditId').value  = b?._id     || '';
  $('branchModal').classList.remove('hidden');
}

async function saveBranch() {
  const id   = $('brEditId').value;
  const body = { name: $('brName').value.trim(), address: $('brAddress').value.trim(), radius: Number($('brRadius').value)||100, lat: parseFloat($('brLat').value)||null, lng: parseFloat($('brLng').value)||null };
  if (!body.name) { toast('Nom kerak', 'err'); return; }
  if (id) await api('/admin/branches/' + id, { method:'PUT',  body: JSON.stringify(body) });
  else    await api('/admin/branches',        { method:'POST', body: JSON.stringify(body) });
  closeModal('branchModal');
  loadBranches();
  toast('Saqlandi ✓');
  // Reload employee branch selects
  loadBranchSelects();
}

async function deleteBranch(id) {
  if (!confirm('Filialni o\'chirasizmi?')) return;
  await api('/admin/branches/' + id, { method:'DELETE' });
  loadBranches();
}

async function loadBranchSelects() {
  const d = await api('/admin/branches');
  const branches = d.branches || [];
  ['eBranch', 'attBranch'].forEach(selId => {
    const sel = $(selId);
    if (!sel) return;
    const val = sel.value;
    const opts = branches.map(b => `<option value="${b._id}">${b.name}</option>`).join('');
    sel.innerHTML = selId === 'attBranch' ? '<option value="">Barcha filiallar</option>' + opts : '<option value="">Filial tanlang</option>' + opts;
    sel.value = val;
  });
}

// ===== EMPLOYEES =====
async function loadEmployees() {
  await loadBranchSelects();
  const emps = await api('/admin/employees');
  if (!Array.isArray(emps)) return;
  const el = $('empsList');
  if (!el) return;
  el.innerHTML = emps.map(e => `
    <div class="bg-card rounded-2xl p-4 border border-white/5 ${e.active===false?'opacity-60':''}">
      <div class="flex items-start gap-3 mb-3">
        ${e.photo
          ? `<img src="${e.photo}" class="w-12 h-12 rounded-2xl object-cover shrink-0"/>`
          : `<div class="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-xl shrink-0">👤</div>`}
        <div class="flex-1 min-w-0">
          <p class="font-black text-white text-sm">${e.name}</p>
          <p class="text-xs text-gray-500">${e.position||'—'}</p>
          <p class="text-xs text-accent font-bold mt-0.5">${fmtSalary(e.salary)}</p>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full ${e.active!==false?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400'}">${e.active!==false?'Faol':'Faol emas'}</span>
      </div>
      <p class="text-xs text-gray-500 mb-3">🕐 ${e.workStart||'09:00'} – ${e.workEnd||'18:00'} · @${e.username}</p>
      <div class="flex gap-2">
        <button onclick="openEmpModal(${JSON.stringify(JSON.stringify(e))})" class="press flex-1 py-2 rounded-xl bg-accent/10 text-accent text-xs font-bold border border-accent/20">✏️ Tahrir</button>
        <button onclick="deleteEmp('${e._id}')" class="press px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">🗑</button>
      </div>
    </div>`).join('');
}

function previewFace(input) {
  if (!input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    _empPhotoBase64 = e.target.result;
    $('eFacePreview').src = e.target.result;
    $('eFacePreview').classList.remove('hidden');
    $('eFaceData').value = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

function openEmpModal(eJson) {
  const e = eJson ? JSON.parse(eJson) : null;
  _empPhotoBase64 = e?.photo || null;
  $('empModalTitle').textContent = e ? 'Tahrirlash' : 'Yangi ishchi';
  $('eName').value       = e?.name      || '';
  $('ePhone').value      = e?.phone     || '';
  $('ePosition').value   = e?.position  || '';
  $('eUsername').value   = e?.username  || '';
  $('ePassword').value   = '';
  $('eSalary').value     = e?.salary    || '';
  $('eWorkStart').value  = e?.workStart || '09:00';
  $('eWorkEnd').value    = e?.workEnd   || '18:00';
  $('eWeeklyOff').value  = e?.weeklyOff || 'sunday';
  $('eBranch').value     = e?.branchId?._id || e?.branchId || '';
  $('eEditId').value     = e?._id       || '';
  $('eFaceData').value   = '';
  if (e?.photo) {
    $('eFacePreview').src = e.photo;
    $('eFacePreview').classList.remove('hidden');
  } else {
    $('eFacePreview').classList.add('hidden');
  }
  $('empModal').classList.remove('hidden');
}

async function saveEmployee() {
  const id       = $('eEditId').value;
  const name     = $('eName').value.trim();
  const username = $('eUsername').value.trim();
  const password = $('ePassword').value;
  if (!name)     { toast('Ism kerak', 'err'); return; }
  if (!username) { toast('Login kerak', 'err'); return; }
  if (!id && !password) { toast('Parol kerak', 'err'); return; }

  let photo = $('eFaceData').value || _empPhotoBase64 || null;

  // Compress photo
  if (photo) {
    try {
      const img = new Image(); img.src = photo;
      await new Promise(r => { img.onload = r; });
      const cvs = document.createElement('canvas');
      cvs.width = 200; cvs.height = 200;
      const ctx = cvs.getContext('2d');
      const sz  = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width-sz)/2, (img.height-sz)/2, sz, sz, 0, 0, 200, 200);
      photo = cvs.toDataURL('image/jpeg', 0.75);
    } catch(e) {}
  }

  const body = {
    name, username,
    phone:     $('ePhone').value.trim(),
    position:  $('ePosition').value.trim(),
    salary:    Number($('eSalary').value) || 0,
    workStart: $('eWorkStart').value,
    workEnd:   $('eWorkEnd').value,
    weeklyOff: $('eWeeklyOff').value,
    branchId:  $('eBranch').value || null,
  };
  if (password) body.password = password;
  if (photo)    body.photo    = photo;

  const d = id
    ? await api('/admin/employees/' + id, { method:'PUT',  body: JSON.stringify(body) })
    : await api('/admin/employees',        { method:'POST', body: JSON.stringify(body) });

  if (d?.error) { toast(d.error, 'err'); return; }
  closeModal('empModal');
  _empPhotoBase64 = null;
  loadEmployees();
  toast('Saqlandi ✓');
}

async function deleteEmp(id) {
  if (!confirm('Ishchini o\'chirasizmi?')) return;
  await api('/admin/employees/' + id, { method:'DELETE' });
  loadEmployees();
  toast('O\'chirildi');
}

// ===== ATTENDANCE =====
function initAttendance() {
  const dateEl = $('attDate');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  const monthEl = $('attMonth');
  if (monthEl && !monthEl.value) monthEl.value = new Date().toISOString().slice(0,7);
  loadBranchSelects();
}

async function loadAttendance() {
  const date     = $('attDate')?.value || new Date().toISOString().split('T')[0];
  const branchId = $('attBranch')?.value || '';
  let url = '/admin/attendance/today?date=' + date;
  if (branchId) url += '&branchId=' + branchId;

  const d = await api(url);
  if (!d?.ok) return;

  // Summary
  const sumEl = $('attSummary');
  if (sumEl) {
    const s = d.summary;
    const boxes = [
      { icon:'👥', label:'Jami',     val: s.total,   color:'text-white' },
      { icon:'✅', label:'Keldi',    val: s.came,    color:'text-green-400' },
      { icon:'❌', label:'Kelmadi',  val: s.absent,  color:'text-red-400' },
      { icon:'⚠️', label:'Kechikdi', val: s.late,    color:'text-yellow-400' },
      { icon:'🏖', label:'Dam kuni', val: s.dayOff,  color:'text-purple-400' },
      { icon:'⏰', label:'Ishlayapti',val: s.working, color:'text-blue-400' },
    ];
    sumEl.innerHTML = boxes.map(b => `
      <div class="bg-card rounded-xl p-3 text-center border border-white/5">
        <div class="text-lg mb-0.5">${b.icon}</div>
        <div class="font-black text-lg ${b.color}">${b.val}</div>
        <div class="text-xs text-gray-500">${b.label}</div>
      </div>`).join('');
  }

  // Table
  const tbody = $('attTable');
  if (!tbody) return;
  tbody.innerHTML = (d.employees||[]).map(r => {
    const statusCls = r.status === 'keldi' ? 'bg-green-500/20 text-green-400' : r.isWeeklyOff ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400';
    const statusLbl = r.status === 'keldi' ? '✅ Keldi' : r.isWeeklyOff ? '🏖 Dam' : '❌ Kelmadi';
    const lateTag   = r.lateMinutes > 0 ? `<span class="text-xs text-yellow-400 ml-1">+${r.lateMinutes}d</span>` : '';
    return `
    <tr class="border-b border-white/5">
      <td class="px-4 py-3">
        <p class="font-bold text-white text-sm">${r.employee.name}${lateTag}</p>
        <p class="text-xs text-gray-500">${r.employee.position||'—'}</p>
      </td>
      <td class="px-4 py-3 text-sm text-gray-300">${r.checkIn||'—'}</td>
      <td class="px-4 py-3 text-sm text-gray-300">${r.checkOut||'—'}</td>
      <td class="px-4 py-3 text-sm">${r.lateMinutes > 0 ? `<span class="text-yellow-400">${r.lateMinutes} min</span>` : '—'}</td>
      <td class="px-4 py-3"><span class="text-xs px-2 py-1 rounded-full ${statusCls}">${statusLbl}</span></td>
      <td class="px-4 py-3">
        <button onclick="openManualAtt('${r.employee._id}','${r.employee.name}')" class="press text-xs px-2.5 py-1.5 bg-accent/10 text-accent rounded-lg border border-accent/20">✏️</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="text-center py-10 text-gray-500">Ma'lumot yo'q</td></tr>`;
}

async function loadMonthReport() {
  const month = $('attMonth')?.value || new Date().toISOString().slice(0,7);
  const d     = await api('/admin/attendance/report?month=' + month);
  const el    = $('monthReport');
  if (!el || !d?.ok) return;

  el.innerHTML = (d.report||[]).map(r => {
    const s   = r.stats;
    const pct = s.workingDaysInMonth > 0 ? Math.round(s.workedDays/s.workingDaysInMonth*100) : 0;
    const pc  = pct >= 90 ? 'text-green-400' : pct >= 70 ? 'text-yellow-400' : 'text-red-400';
    return `
    <div class="bg-card rounded-2xl p-4 border border-white/5">
      <div class="flex justify-between items-start mb-3">
        <div>
          <p class="font-black text-white text-sm">${r.employee.name}</p>
          <p class="text-xs text-gray-500">${r.employee.position||'—'}</p>
        </div>
        <div class="text-right">
          <p class="font-black text-green-400 text-sm">${fmtSalary(s.earnedSalary)}</p>
          <p class="text-xs text-gray-500">Oylik: ${fmtSalary(r.employee.salary)}</p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-xs mb-3">
        <div class="bg-bg3 rounded-xl p-2 text-center"><p class="font-black text-white">${s.workedDays}/${s.workingDaysInMonth}</p><p class="text-gray-500">Kun</p></div>
        <div class="bg-bg3 rounded-xl p-2 text-center"><p class="font-black text-yellow-400">${s.lateCount}</p><p class="text-gray-500">Kechikish</p></div>
        <div class="bg-bg3 rounded-xl p-2 text-center"><p class="font-black text-red-400">${s.absentCount}</p><p class="text-gray-500">Kelmadi</p></div>
      </div>
      <div class="flex justify-between text-xs mb-1"><span class="text-gray-500">Davomat</span><span class="font-black ${pc}">${pct}%</span></div>
      <div class="h-1.5 bg-bg3 rounded-full"><div class="h-full rounded-full ${pct>=90?'bg-green-500':pct>=70?'bg-yellow-500':'bg-red-500'}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('') || `<div class="text-center py-8 text-gray-500 text-sm">Ma'lumot yo'q</div>`;
}

function openManualAtt(empId, empName) {
  $('manualEmpId').value  = empId;
  $('manualEmpName').textContent = empName;
  $('manualIn').value     = '';
  $('manualOut').value    = '';
  $('manualNote').value   = '';
  $('manualStatus').value = 'keldi';
  $('manualAttModal').classList.remove('hidden');
}

async function saveManualAtt() {
  const body = {
    employeeId: $('manualEmpId').value,
    date:       $('attDate')?.value || new Date().toISOString().split('T')[0],
    status:     $('manualStatus').value,
    checkIn:    $('manualIn').value  || null,
    checkOut:   $('manualOut').value || null,
    note:       $('manualNote').value
  };
  const d = await api('/admin/attendance/manual', { method:'POST', body: JSON.stringify(body) });
  if (d?.ok) { closeModal('manualAttModal'); loadAttendance(); toast('Saqlandi ✓'); }
  else toast(d?.error || 'Xato', 'err');
}