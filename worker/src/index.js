/* Narragate form endpoint.

   Receives the contact form and the investor packet request, records each
   submission in KV, then sends the notification by email.

   KV is written before the email is sent, deliberately: a bounced or
   spam-filtered notification must not lose an enquiry. If the mail call
   fails after the KV write succeeded, the caller still gets an error so the
   form shows its failure state, but the submission itself is not lost. */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const FORMS = {
  contact: {
    subject: 'Contact form',
    fields: ['fullname', 'email', 'message'],
    required: ['fullname', 'email']
  },
  investor: {
    subject: 'Investor packet request',
    fields: ['fullname', 'email', 'org', 'role', 'message'],
    required: ['fullname', 'email', 'consent']
  }
};

const LIMITS = { fullname: 200, email: 320, org: 200, role: 80, message: 5000 };

// Per-IP submissions allowed per hour. Turnstile is the real defence; this
// only caps the damage if it is ever misconfigured or disabled.
const RATE_LIMIT = 5;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (origin && !allowed.includes(origin)) return json({ ok: false, error: 'origin_not_allowed' }, 403, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'bad_request' }, 400, cors);
    }

    const spec = FORMS[body.form];
    if (!spec) return json({ ok: false, error: 'unknown_form' }, 400, cors);

    // Honeypot: a real browser leaves this empty because it is hidden.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      // Accept silently so the bot does not learn it was caught.
      return json({ ok: true }, 200, cors);
    }

    const errors = validate(body, spec);
    if (errors.length) return json({ ok: false, error: 'invalid', fields: errors }, 422, cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (!(await withinRateLimit(env, ip))) {
      return json({ ok: false, error: 'rate_limited' }, 429, cors);
    }

    if (!(await verifyTurnstile(env, body.token, ip))) {
      return json({ ok: false, error: 'challenge_failed' }, 403, cors);
    }

    const record = {
      form: body.form,
      receivedAt: new Date().toISOString(),
      ip,
      country: request.headers.get('CF-IPCountry') || null,
      userAgent: request.headers.get('User-Agent') || null,
      data: Object.fromEntries(spec.fields.map((f) => [f, str(body[f])])),
      consent: body.consent === true
    };

    // Durable record first. If this throws, we have not promised anything.
    const key = `sub:${record.receivedAt}:${crypto.randomUUID()}`;
    try {
      await env.SUBMISSIONS.put(key, JSON.stringify(record));
    } catch (err) {
      console.error('kv_write_failed', err);
      return json({ ok: false, error: 'storage_failed' }, 500, cors);
    }

    try {
      await sendEmail(env, spec, record);
    } catch (err) {
      console.error('email_failed', key, err);
      // The submission is safe in KV; tell the browser anyway so the form
      // shows its failure state rather than claiming a success it cannot prove.
      return json({ ok: false, error: 'email_failed', stored: true }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  }
};

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function validate(body, spec) {
  const bad = [];
  for (const field of spec.required) {
    if (field === 'consent') {
      if (body.consent !== true) bad.push('consent');
      continue;
    }
    if (!str(body[field])) bad.push(field);
  }
  if (str(body.email) && !EMAIL_RE.test(str(body.email))) {
    if (!bad.includes('email')) bad.push('email');
  }
  for (const [field, max] of Object.entries(LIMITS)) {
    if (str(body[field]).length > max && !bad.includes(field)) bad.push(field);
  }
  return bad;
}

async function withinRateLimit(env, ip) {
  if (ip === 'unknown') return true;
  const hour = new Date().toISOString().slice(0, 13); // yyyy-mm-ddThh
  const key = `rate:${hour}:${ip}`;
  try {
    const n = parseInt((await env.SUBMISSIONS.get(key)) || '0', 10);
    if (n >= RATE_LIMIT) return false;
    await env.SUBMISSIONS.put(key, String(n + 1), { expirationTtl: 7200 });
    return true;
  } catch (err) {
    // Never let the limiter itself block a genuine submission.
    console.error('rate_limit_unavailable', err);
    return true;
  }
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) {
    console.error('turnstile_secret_missing');
    return false;
  }
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', str(token));
  form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });
  const out = await res.json();
  if (!out.success) console.error('turnstile_rejected', out['error-codes']);
  return out.success === true;
}

async function sendEmail(env, spec, record) {
  const d = record.data;
  const lines = [
    `${spec.subject} — narragate.com`,
    '',
    ...spec.fields
      .filter((f) => d[f])
      .map((f) => `${label(f)}: ${d[f]}`),
    '',
    `Consent given: ${record.consent ? 'yes' : 'no'}`,
    `Received: ${record.receivedAt}`,
    `Country: ${record.country || 'unknown'}`
  ];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.NOTIFY_TO],
      reply_to: d.email || undefined,
      subject: `${spec.subject}: ${d.fullname || 'no name'}`,
      text: lines.join('\n')
    })
  });

  if (!res.ok) {
    throw new Error(`resend ${res.status}: ${await res.text()}`);
  }
}

function label(f) {
  return { fullname: 'Name', email: 'Email', org: 'Organization', role: 'Role', message: 'Message' }[f] || f;
}

function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
  });
}
