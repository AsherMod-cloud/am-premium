// asher api backend — cloudflare pages functions
// handles auth, verification, and premium activation

const CFG = { 
  key: 'AIzaSyDtG1AU22ErnQD60AzBAcaknySiz9_CEq0',
  idt: 'https://www.googleapis.com/identitytoolkit/v3/relyingparty',
  vfy: 'https://us-central1-alight-creative.cloudfunctions.net/verifyPurchase'
};

function dip() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return [b[0] || 1, b[1], b[2], b[3] || 1].join('.');
}

function sp(h) {
  const ip = dip();
  return {
    ...h,
    'x-forwarded-for': ip,
    'x-real-ip': ip,
    'client-ip': ip,
    'x-client-ip': ip,
    'x-originating-ip': ip,
    'x-cluster-client-ip': ip
  };
}

const H1 = {
  'content-type': 'application/json',
  'x-android-package': 'com.alightcreative.motion',
  'x-android-cert': 'ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8',
  'user-agent': 'dalvik/2.1.0 (linux; u; android 15; 23127pn0cc build/bp1a.250505.005)'
};

const H2 = {
  'content-type': 'application/json; charset=utf-8',
  'user-agent': 'okhttp/3.12.1',
  'accept-encoding': 'gzip'
};

async function jpost(url, body, headers) {
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) {
    const t = await r.text();
    try { throw new Error(JSON.stringify(JSON.parse(t))); } 
    catch { throw new Error(t || r.statusText); }
  }
  return r.json();
}

function extractCode(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/&amp;/g, '&');
  try { s = decodeURIComponent(s); } catch {}
  try {
    const u = new URL(s);
    let c = u.searchParams.get('oobCode');
    if (!c) {
      const n = u.searchParams.get('link') || u.searchParams.get('q') || u.searchParams.get('url');
      if (n) { try { c = new URL(n).searchParams.get('oobCode'); } catch {} }
    }
    if (c) return c.replace(/[^a-zA-Z0-9_-]/g, '');
  } catch {}
  const m = s.match(/oobCode=([a-zA-Z0-9_-]+)/i);
  if (m) return m[1];
  const t = raw.trim();
  if (/^[a-zA-Z0-9_-]{10,}$/.test(t) && !t.includes('://')) return t;
  return null;
}

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
});

async function verifyTurnstile(token, ip, env) {
  if (!token) return false;
  const formData = new FormData();
  formData.append('secret', env.TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  formData.append('remoteip', ip);
  
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData
  });
  const outcome = await res.json();
  return outcome.success;
}

async function checkRateLimit(ip, env) {
  const key = `rate:${ip}`;
  const limit = 5; // max 5 request
  const window = 600; // per 10 menit (600 detik)
  
  let data = await env.RATE_LIMIT.get(key, 'json');
  const now = Math.floor(Date.now() / 1000);
  
  if (!data || (now - data.start) > window) {
    data = { count: 1, start: now };
    await env.RATE_LIMIT.put(key, JSON.stringify(data), { expirationTtl: window });
    return { allowed: true };
  }
  
  if (data.count >= limit) {
    return { allowed: false };
  }
  
  data.count++;
  await env.RATE_LIMIT.put(key, JSON.stringify(data), { expirationTtl: window });
  return { allowed: true };
}

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
});

export async function onRequestPost({ request, env, params }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // 1. CEK RATE LIMIT
  const rate = await checkRateLimit(ip, env);
  if (!rate.allowed) {
    return json({ success: false, message: 'Terlalu banyak request. Coba lagi nanti.' }, 429);
  }

  // 2. CEK HEADERS (seperti sebelumnya)
  const key = request.headers.get('X-Asher-Key');
  const ua = request.headers.get('X-Asher-UA');
  
  if (key !== 'AsherMod Premium' || !ua || !ua.startsWith('AsherMod')) {
    return json({ success: false, message: 'Header tidak valid' }, 401);
 }

  // 3. PARSE BODY & CEK TURNSTILE
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: 'invalid json' }, 400); }

  const isHuman = await verifyTurnstile(body.cfToken, ip, env);
  if (!isHuman) {
    return json({ success: false, message: 'Verifikasi Turnstile gagal. Kamu bot?' }, 403);
  }

  const path = '/' + (params.path || []).join('/');
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: 'invalid json' }, 400); }

  // 1. sendlink
  if (path === '/sendlink') {
    if (!body.email) return json({ success: false, message: 'email wajib' }, 400);
    try {
      await jpost(`${CFG.idt}/createAuthUri?key=${CFG.key}`, {
        identifier: body.email, continueUri: 'http://localhost'
      }, sp(H1));
      
      const r = await jpost(`${CFG.idt}/getOobConfirmationCode?key=${CFG.key}`, {
        requestType: 6, email: body.email, androidInstallApp: true, canHandleCodeInApp: true,
        continueUrl: 'https://alightcreative.com?ui_sid=0366624874&ui_sd=0',
        iosBundleId: 'com.alightcreative.motion', androidPackageName: 'com.alightcreative.motion',
        androidMinimumVersion: '585', clientType: 'CLIENT_TYPE_ANDROID'
      }, sp(H1));
      return json({ success: true, message: 'Link dikirim ke email.', data: r });
    } catch (e) { return json({ success: false, message: e.message }, 400); }
  }

  // 2. verify
  if (path === '/verify') {
    if (!body.email || !body.rawLink) return json({ success: false, message: 'email & rawLink wajib' }, 400);
    const code = extractCode(body.rawLink);
    if (!code) return json({ success: false, message: 'Link tidak valid / oobCode gak nemu' }, 400);
    
    try {
      const a = await jpost(`${CFG.idt}/emailLinkSignin?key=${CFG.key}`, {
        email: body.email, oobCode: code, clientType: 'CLIENT_TYPE_ANDROID'
      }, sp(H1));
      return json({ success: true, message: 'Verifikasi berhasil', idToken: a.idToken, refreshToken: a.refreshToken, uid: a.localId });
    } catch (e) { return json({ success: false, message: e.message }, 400); }
  }

  // 3. activated
  if (path === '/activated') {
    if (!body.email || !body.idToken) return json({ success: false, message: 'email & idToken wajib' }, 400);
    
    const buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    const orderId = 'neo-' + Array.from(buf, x => x.toString(16).padStart(2, '0')).join('');
    
    try {
      const h = {
        ...H2,
        authorization: 'Bearer ' + body.idToken,
        'firebase-instance-id-token': 'cSDnCyp3T-uwp07z3tL86T:APA91bFkmvvsHw5nnqa1SBFci-99DRsKClLiETdRrVcJjS5yBx1v_FbCb1d8WhBuea_zmwnYBktyTIzcRhN4b6uNOUur9wPc0gKXmJDoZic0LhNq5V2s0xI'
      };
      const r = await jpost(CFG.vfy, {
        data: {
          productId: 'am.full.sub.annual.19q4',
          token: 'mmgaobamlahbbeccfplmbkbb.AO-J1OzqG0or_GJJIx-ms8GrTm-jaglCRfhQSRPUZKpl2YspYS-oN7_94uv8RC5vQbvd_Ios2pPDStZ2n7F0hLE3FiOU7HS3R6Fquulv5xLXFECSv4ctElw',
          skuType: 'subs',
          orderId
        }
      }, sp(h));
      return json({ success: true, message: 'Premium 1 Tahun berhasil diaktifkan!', orderId, data: r });
    } catch (e) { return json({ success: false, message: e.message }, 400); }
  }

  return json({ success: false, message: 'not found' }, 404);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, X-Asher-Key, X-Asher-UA'
    }
  });
}