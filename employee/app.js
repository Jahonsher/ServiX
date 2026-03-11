// ===== CONFIG =====
const _cfg = window.__CONFIG__ || {};
const API  = _cfg.API_URL || (window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://e-comerce-bot-main-production.up.railway.app');

let empToken    = localStorage.getItem('empToken');
let empData     = JSON.parse(localStorage.getItem('empData') || '{}');
let todayData   = null;
let camStream   = null;
let facingFront = true;

// ===== HELPERS =====
function $(id) { return document.getElementById(id); }

function toast(msg, type = 'ok') {
  const box = $('empToasts');
  const el  = document.createElement('div');
  const bg  = type === 'ok' ? 'bg-green-500' : type === 'err' ? 'bg-red-500' : 'bg-yellow-500';
  el.className = `${bg} text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl`;
  el.style.cssText = 'animation:toastIn .3s ease;min-width:160px';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 3500);
}

function fmtMins(m) {
  if (!m) return '0d';
  return Math.floor(m/60) + 's ' + (m%60) + 'd';
}

function fmtSalary(n) {
  return Number(n||0).toLocaleString('uz-UZ') + ' soʼm';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + empToken };
}

async function api(url, opts = {}) {
  try {
    const r = await fetch(API + url, { method: opts.method||'GET', headers: authHeaders(), body: opts.body });
    if (r.status === 401) { logout(); return { error: 'Sessiya tugadi' }; }
    if (r.status === 403) {
      const d = await r.json();
      if (d.blocked) { showBlocked(d.message); return d; }
      return d;
    }
    return await r.json();
  } catch(e) { return { error: e.message }; }
}

function showBlocked(reason) {
  $('blockedReason').textContent = reason || '';
  $('blockedScreen').classList.remove('hidden');
}

// ===== AUTH =====
async function doLogin() {
  const username = $('empUser').value.trim();
  const password = $('empPass').value;
  const err = $('loginErr');
  err.classList.add('hidden');
  if (!username || !password) { err.textContent = 'Login va parol kiriting'; err.classList.remove('hidden'); return; }

  try {
    const d = await fetch(API + '/employee/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    }).then(r => r.json());

    if (!d.ok) {
      if (d.blocked) { showBlocked(d.message); return; }
      err.textContent = '❌ ' + (d.error || 'Xato');
      err.classList.remove('hidden');
      return;
    }
    empToken = d.token;
    empData  = d.employee;
    localStorage.setItem('empToken',  empToken);
    localStorage.setItem('empData',   JSON.stringify(empData));
    startApp();
  } catch(e) {
    err.textContent = '🔌 Server bilan ulanib bolmadi';
    err.classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('empToken');
  localStorage.removeItem('empData');
  empToken = null;
  $('app').classList.add('hidden');
  $('loginPage').style.display = 'flex';
  closeCam();
}

// ===== START =====
function startApp() {
  $('loginPage').style.display = 'none';
  $('app').classList.remove('hidden');

  $('empNameHeader').textContent = empData.name     || 'Ishchi';
  $('empPosHeader').textContent  = empData.position || 'Lavozim';

  const today = new Date();
  $('todayDate').textContent = today.toLocaleDateString('uz-UZ', { weekday:'short', day:'numeric', month:'short' });

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  loadToday();
  loadStats();

  // Block check every 2 min
  setInterval(async () => {
    try {
      const d = await api('/employee/today');
      if (d.blocked) showBlocked(d.message);
    } catch(e) {}
  }, 120000);
}

function updateClock() {
  const now = new Date();
  $('headerTime').textContent = now.toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

if (empToken) startApp();

// ===== LOAD TODAY =====
async function loadToday() {
  $('loadingSpinner').classList.remove('hidden');
  $('actionBtns').querySelector('.spinner') ? null : null;

  const d = await api('/employee/today');
  $('loadingSpinner').classList.add('hidden');

  if (d.blocked) return;
  todayData = d.attendance;

  renderTodayCard(todayData);
  renderActionBtns(todayData);
}

function renderTodayCard(att) {
  $('checkInTime').textContent  = att?.checkIn  || '—';
  $('checkOutTime').textContent = att?.checkOut || '—';
  $('workedTime').textContent   = att?.totalMinutes ? fmtMins(att.totalMinutes) : (att?.checkIn && !att?.checkOut ? '⏳' : '—');

  if (att?.lateMinutes > 0) {
    $('lateBadge').classList.remove('hidden');
    $('lateMin').textContent = att.lateMinutes;
  } else {
    $('lateBadge').classList.add('hidden');
  }
}

function renderActionBtns(att) {
  const btns = $('actionBtns');
  if (!att || !att.checkIn) {
    // Check-in
    btns.innerHTML = `
      <button onclick="startCheckIn()" class="press w-full py-4 bg-accent rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2">
        📍 Ish boshlash (Check-in)
      </button>`;
  } else if (!att.checkOut) {
    // Check-out
    btns.innerHTML = `
      <div class="bg-accent/10 border border-accent/20 rounded-2xl p-3 text-center mb-2">
        <p class="text-accent font-black text-sm">✅ Siz ishlayapsiz</p>
        <p class="text-xs text-gray-400 mt-0.5">${att.checkIn} dan beri</p>
      </div>
      <button onclick="startCheckOut()" class="press w-full py-4 bg-red-500 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2">
        🏁 Ish tugash (Check-out)
      </button>`;
  } else {
    // Done
    btns.innerHTML = `
      <div class="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
        <p class="text-green-400 font-black text-sm">✅ Bugun ish tugadi</p>
        <p class="text-xs text-gray-400 mt-1">Ishlagan vaqt: ${fmtMins(att.totalMinutes)}</p>
      </div>`;
  }
}

// ===== CHECK-IN =====
async function startCheckIn() {
  // Kamera ochish
  await openCam('checkin');
}

async function startCheckOut() {
  await openCam('checkout');
}

// ===== CAMERA =====
async function openCam(action) {
  $('cameraWrap').classList.remove('hidden');
  $('cameraWrap').dataset.action = action;

  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }, audio: false
    });
    $('camVideo').srcObject = camStream;

    // Replace action btns with snap btn
    $('actionBtns').innerHTML = `
      <button onclick="snapAndSubmit('${action}')" class="press w-full py-4 ${action==='checkin'?'bg-accent':'bg-red-500'} rounded-2xl text-white font-black text-sm">
        📸 ${action==='checkin'?'Kelishni tasdiqlash':'Ketishni tasdiqlash'}
      </button>
      <button onclick="closeCam()" class="press w-full py-3 bg-bg3 rounded-2xl text-gray-400 font-bold text-sm">Bekor qilish</button>`;
  } catch(e) {
    $('cameraWrap').classList.add('hidden');
    toast('Kamera ochilmadi, GPS bilan davom etilmoqda', 'warn');
    // Kamerasiz ham davom etish
    await submitWithoutPhoto(action);
  }
}

function closeCam() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  $('cameraWrap').classList.add('hidden');
  renderActionBtns(todayData);
}

async function snapAndSubmit(action) {
  const video  = $('camVideo');
  const canvas = $('camCanvas');
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const photo = canvas.toDataURL('image/jpeg', 0.8);

  closeCam();
  await submitAction(action, photo);
}

async function submitWithoutPhoto(action) {
  await submitAction(action, null);
}

// ===== SUBMIT CHECK-IN/OUT =====
async function submitAction(action, photo) {
  $('actionBtns').innerHTML = `<div class="flex justify-center py-4"><div class="spinner"></div></div>`;

  const now     = new Date();
  const clientTimeMinutes = now.getHours() * 60 + now.getMinutes();
  const clientDate = now.toISOString().split('T')[0];

  // Geolocation
  let lat = null, lng = null;
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch(e) {}

  const endpoint = action === 'checkin' ? '/employee/checkin' : '/employee/checkout';
  const body = { photo, lat, lng, clientTimeMinutes, clientDate };

  const d = await api(endpoint, { method:'POST', body: JSON.stringify(body) });

  if (d.error || d.blocked) {
    if (d.blocked) { showBlocked(d.message); return; }
    toast(d.error || 'Xato', 'err');
    loadToday();
    return;
  }

  todayData = d.attendance;
  renderTodayCard(todayData);
  renderActionBtns(todayData);

  if (action === 'checkin') {
    const lateMsg = d.lateMinutes > 0 ? ` (${d.lateMinutes} min kechikish)` : '';
    toast('✅ Keldi qayd qilindi' + lateMsg + '. Vaqt: ' + d.checkIn);
  } else {
    toast('✅ Ketdi qayd qilindi. Ishlagan: ' + fmtMins(d.totalMinutes));
  }

  loadStats();
}

// ===== STATS =====
async function loadStats() {
  const now = new Date();
  const month = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const d = await api('/employee/stats?month=' + month);
  if (!d?.ok) return;

  const s = d.stats;
  $('monthWorked').textContent = s.workedDays + ' kun';
  $('monthSalary').textContent = fmtSalary(s.earnedSalary);
  $('monthAbsent').textContent = s.absent + ' kun';

  // Last 7 days
  const el = $('last7');
  if (el && d.last7) {
    el.innerHTML = d.last7.map(day => {
      const dt = new Date(day.date);
      const dayName = ['Ya','Du','Se','Ch','Pa','Ju','Sh'][dt.getDay()];
      const isToday = day.date === new Date().toISOString().split('T')[0];
      const bg = !day.status ? 'bg-bg3 text-gray-500'
               : day.status === 'keldi' ? 'bg-accent/20 text-accent'
               : day.status === 'dam'   ? 'bg-purple-500/20 text-purple-400'
               : 'bg-red-500/20 text-red-400';
      const icon = !day.status ? '' : day.status==='keldi' ? '✓' : day.status==='dam' ? '🏖' : '✗';
      return `
      <div class="shrink-0 w-12 rounded-2xl p-2 text-center ${bg} ${isToday?'ring-2 ring-accent/50':''}">
        <p class="text-xs font-bold">${dayName}</p>
        <p class="text-xs mt-0.5">${dt.getDate()}</p>
        <p class="text-sm font-black mt-0.5">${icon}</p>
        ${day.checkIn ? `<p class="text-xs mt-0.5" style="font-size:9px">${day.checkIn}</p>` : ''}
      </div>`;
    }).join('');
  }
}