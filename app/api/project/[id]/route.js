export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sql } from '@vercel/postgres';

/* =========================
   🔐 CORS HELPERS
========================= */
const ALLOWED = (process.env.ALLOWED_ORIGINS ??
  'https://harwoodcarpentry.pro,https://www.harwoodcarpentry.pro')
  .split(',')
  .map(s => s.trim());

function buildCorsHeaders(origin) {
  const allowOrigin = origin && ALLOWED.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    'Access-Control-Max-Age': '86400',
    ...(allowOrigin ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
  };
}

function json(body, status = 200, origin = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(origin),
    },
  });
}

export async function OPTIONS(req) {
  const origin = req.headers.get('origin');
  return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
}

/* =========================
   🧭 STEP TEMPLATE + NORMALIZER
========================= */
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
      note: o.note ?? s.note ?? '',
      date: o.date ?? s.date ?? '',
      done: !!o.done,
    };
  });
}

/* =========================
   📥 GET /api/project/[id]
========================= */
export async function GET(req, { params }) {
  const origin = req.headers.get('origin');
  const id = decodeURIComponent(params?.id || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400, origin);

  try {
    const { rows } = await sql`
      SELECT project_id, client_name, status, steps_json, updated_at
      FROM projects
      WHERE project_id = ${id}
      LIMIT 1
    `;
    if (!rows.length) return json({ error: 'Not found' }, 404, origin);

    const row = rows[0];
    const steps = normalizeSteps(row.steps_json);

    return json({
      project_id: row.project_id,
      client_name: row.client_name,
      status: row.status,
      steps,
      updated_at: row.updated_at,
    }, 200, origin);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error', details: err.message }, 500, origin);
  }
}

/* =========================
   ✍️ POST /api/project/[id]
   (Upsert project + steps)
========================= */
export async function POST(req, { params }) {
  const origin = req.headers.get('origin');
  const id = decodeURIComponent(params?.id || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400, origin);

  const key = req.headers.get('x-admin-key');
  if (key !== process.env.ADMIN_KEY) {
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
  const steps = normalizeSteps(body.steps);

  if (!client_name || !status) {
    return json({ error: 'Missing client_name or status' }, 400, origin);
  }

  try {
    await sql`
      INSERT INTO projects (project_id, client_name, status, steps_json, updated_at)
      VALUES (${id}, ${client_name}, ${status}, ${JSON.stringify(steps)}, NOW())
      ON CONFLICT (project_id)
      DO UPDATE SET
        client_name = EXCLUDED.client_name,
        status      = EXCLUDED.status,
        steps_json  = EXCLUDED.steps_json,
        updated_at  = NOW()
    `;
    return json({ ok: true }, 200, origin);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error', details: err.message }, 500, origin);
  }
}
