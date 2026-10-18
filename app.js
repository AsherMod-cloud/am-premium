// init icons
lucide.createIcons();

const API_BASE = '/miku';
const HEADERS = { 
  'Content-Type': 'application/json',
  'X-Miku-Moe-Key': 'Miku Moe Mod',
  'X-MikuMoe-UA': 'MikuMoe 18.10.2026/18'
};

let idTokenCache = null;

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

function copyKey() {
  navigator.clipboard.writeText('Miku Moe Mod');
  toast('API Key berhasil disalin!', 'success');
}

// api calls
async function post(endpoint, body) {
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
    }
  } catch (err) {
    toast('Koneksi error', 'error');
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
      idTokenCache = res.idToken;
      
      // unlock activation button
      const btnAct = document.getElementById('btnActivate');
      btnAct.disabled = false;
      btnAct.classList.remove('btn-disabled');
    } else {
      toast(res.message || 'Gagal verifikasi', 'error');
    }
  } catch (err) {
    toast('Koneksi error', 'error');
  } finally {
    setLoading('btnVerify', false);
  }
}

async function activatePremium() {
  const email = document.getElementById('email').value.trim();
  if (!email || !idTokenCache) return toast('Lakukan verifikasi terlebih dahulu', 'error');

  setLoading('btnActivate', true);
  try {
    const res = await post('/activated', { email, idToken: idTokenCache });
    if (res.success) {
      toast('Premium 1 Tahun Aktif!', 'success');
    } else {
      toast(res.message || 'Gagal aktivasi', 'error');
    }
  } catch (err) {
    toast('Koneksi error', 'error');
  } finally {
    setLoading('btnActivate', false);
  }
}