export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sql } from '@vercel/postgres';

/* ===== CORS (same as your [id] route) ===== */
const ALLOWED = (process.env.ALLOWED_ORIGINS ??
  'https://harwoodcarpentry.pro,https://www.harwoodcarpentry.pro')
  .split(',')
  .map(s => s.trim());

// Add localhost automatically for dev convenience
if (process.env.NODE_ENV !== 'production') {
  ['http://localhost:3000', 'http://127.0.0.1:3000'].forEach(o => {
    if (!ALLOWED.includes(o)) ALLOWED.push(o);
  });
}

function buildCorsHeaders(origin) {
  const allowOrigin = origin && ALLOWED.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    'Access-Control-Max-Age': '86400',
    ...(allowOrigin ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
  };
}

function json(body, status = 200, origin = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(origin) },
  });
}

export async function OPTIONS(req) {
  const origin = req.headers.get('origin');
  return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
}

/* ===== Step template + normalizer (same as [id]) ===== */
const DEFAULT_STEPS = [
  { id: 'inquiry',     title: 'Inquiry Received',           note: '', date: '', done: false },
  { id: 'intake',      title: 'Discovery Call',             note: '', date: '', done: false },
  { id: 'site_visit',  title: 'Site Visit & Measurements',  note: '', date: '', done: false },
  { id: 'design',      title: 'Design & Drawings',          note: '', date: '', done: false },
  { id: 'quote',       title: 'Quote Shared',               note: '', date: '', done: false },
  { id: 'approval',    title: 'Approval / Contract',        note: '', date: '', done: false },
  { id: 'deposit',     title: 'Deposit Received',           note: '', date: '', done: false },
  { id: 'ordering',    title: 'Materials Ordered',          note: '', date: '', done: false },
  { id: 'fabrication', title: 'Fabrication',                note: '', date: '', done: false },
  { id: 'finishing',   title: 'Finishing',                  note: '', date: '', done: false },
  { id: 'schedule',    title: 'Install Scheduled',          note: '', date: '', done: false },
  { id: 'install',     title: 'Installation',               note: '', date: '', done: false },
  { id: 'punch',       title: 'Punch List',                 note: '', date: '', done: false },
  { id: 'complete',    title: 'Complete',                   note: '', date: '', done: false },
];

function normalizeSteps(input) {
  const byId = Object.create(null);
  (Array.isArray(input) ? input : []).forEach(s => {
    if (s && typeof s.id === 'string') byId[s.id] = s;
  });
  return DEFAULT_STEPS.map(s => {
    const o = byId[s.id] || {};
    return {
      id: s.id,
      title: o.title ?? s.title,
      note: o.note ?? '',
      date: o.date ?? '',
      done: !!o.done,
    };
  });
}

/* ===== Helper: generate next ID like HC-2025-003 ===== */
async function generateNextId(year) {
  const like = `HC-${year}-%`;
  const pattern = `HC-${year}-(\\d{3})`;
  const { rows } = await sql`
    SELECT COALESCE(MAX(CAST(SUBSTRING(project_id FROM ${pattern}) AS INT)), 0) AS last
    FROM projects
    WHERE project_id LIKE ${like}
  `;
  const next = Number(rows?.[0]?.last ?? 0) + 1;
  return `HC-${year}-${String(next).padStart(3, '0')}`;
}

/* ===== POST /api/project  (auto-create) =====
 Body: { client_name: string, status: string, steps?: Step[] }
 Resp: { ok: true, project_id: 'HC-YYYY-###' }
============================================== */
export async function POST(req) {
  const origin = req.headers.get('origin');

  const key = req.headers.get('x-admin-key');
  if (key !== process.env.ADMIN_KEY) {
    // Return CORS headers so the browser can read the error
    return json({ error: 'Unauthorized' }, 401, origin);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const client_name = (body.client_name || '').trim();
  const status = (body.status || '').trim();
  if (!client_name || !status) {
    return json({ error: 'Missing client_name or status' }, 400, origin);
  }

  const steps = normalizeSteps(body.steps);
  const year = new Date().getFullYear();
  const newId = await generateNextId(year);

  try {
    await sql`
      INSERT INTO projects (project_id, client_name, status, steps_json, updated_at)
      VALUES (${newId}, ${client_name}, ${status}, ${JSON.stringify(steps)}, NOW())
    `;
    return json({ ok: true, project_id: newId }, 200, origin);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error', details: err.message }, 500, origin);
  }
}
