// init icons
lucide.createIcons();

const API_BASE = '/api';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Asher-Key': 'AsherMod Premium',
  'X-Asher-UA': 'AsherMod 2026/1'
};

// state
let idTokenCache = null;
let uidCache = null;
let orderCache = null;
let currentEmail = null;

// ui helpers
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

function setLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  btn.disabled = isLoading;
  const originalText = btn.dataset.originalText || btn.textContent;
  if (!btn.dataset.originalText) btn.dataset.originalText = originalText;
  btn.textContent = isLoading ? 'Memproses...' : originalText;
}

// --- HELPER TURNSTILE ---
function getTurnstileToken() {
  // ngambil token dari widget turnstile cloudflare
  const el = document.querySelector('[name="cf-turnstile-response"]');
  return el ? el.value : null;
}

function resetTurnstile() {
  if (window.turnstile) window.turnstile.reset();
}
// ------------------------

async function post(endpoint, body) {
  // Selalu sertakan cfToken di setiap request
  const cfToken = getTurnstileToken();
  body.cfToken = cfToken;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body)
  });
  return res.json();
}

// flows
async function sendLink() {
  const email = document.getElementById('email').value.trim();
  if (!email) return toast('Masukkan email dulu', 'error');

  setLoading('btnSend', true);
  try {
    const res = await post('/sendlink', { email });
    if (res.success) {
      toast('Magic link dikirim. Cek email!', 'success');
    } else {
      toast(res.message || 'Gagal mengirim link', 'error');
      resetTurnstile(); // reset kalau gagal
    }
  } catch (err) {
    toast('Koneksi error', 'error');
    resetTurnstile();
  } finally {
    setLoading('btnSend', false);
  }
}

async function verifyLink() {
  const email = document.getElementById('email').value.trim();
  const rawLink = document.getElementById('rawLink').value.trim();
  
  if (!email) return toast('Email wajib diisi', 'error');
  if (!rawLink) return toast('Raw link wajib diisi', 'error');

  setLoading('btnVerify', true);
  try {
    const res = await post('/verify', { email, rawLink });
    if (res.success) {
      toast('Verifikasi berhasil!', 'success');
      resetTurnstile(); // reset karena token udah kepake
      
      idTokenCache = res.idToken;
      uidCache = res.uid;
      currentEmail = email;
      
      const btnAct = document.getElementById('btnActivate');
      btnAct.disabled = false;
      btnAct.classList.remove('btn-disabled');
    } else {
      toast(res.message || 'Gagal verifikasi', 'error');
      resetTurnstile();
    }
  } catch (err) {
    toast('Koneksi error', 'error');
    resetTurnstile();
  } finally {
    setLoading('btnVerify', false);
  }
}

async function activatePremium() {
  if (!currentEmail || !idTokenCache) return toast('Lakukan verifikasi terlebih dahulu', 'error');

  setLoading('btnActivate', true);
  try {
    const res = await post('/activated', { email: currentEmail, idToken: idTokenCache });
    
    if (res.success) {
      resetTurnstile(); // reset token
      orderCache = res.orderId || res.order || 'unknown';
      
      let expiryText = 'Unknown';
      const expiryMs = res.data?.result?.expiryTimeMillis;
      if (expiryMs) {
        const dateObj = new Date(Number(expiryMs));
        expiryText = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      }

      document.getElementById('resEmail').textContent = currentEmail;
      document.getElementById('resUid').textContent = uidCache || '-';
      document.getElementById('resExpiry').textContent = expiryText;
      document.getElementById('resOrder').textContent = orderCache;
      document.getElementById('resToken').textContent = idTokenCache;
      
      document.getElementById('successModal').classList.add('show');
      
    } else {
      toast(res.message || 'Gagal aktivasi', 'error');
      resetTurnstile();
    }
  } catch (err) {
    toast('Koneksi error', 'error');
    resetTurnstile();
  } finally {
    setLoading('btnActivate', false);
  }
}

// modal actions
function copyToken() {
  if (!idTokenCache) return;
  navigator.clipboard.writeText(idTokenCache);
  toast('Token berhasil disalin', 'success');
}

function unlockAgain() {
  // hide modal
  document.getElementById('successModal').classList.remove('show');
  
  // auto clear semua form & state
  document.getElementById('email').value = '';
  document.getElementById('rawLink').value = '';
  idTokenCache = null;
  uidCache = null;
  orderCache = null;
  currentEmail = null;
  
  // reset button
  const btnAct = document.getElementById('btnActivate');
  btnAct.disabled = true;
  btnAct.classList.add('btn-disabled');
  
  toast('Siap untuk unlock berikutnya', 'info');
}