export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sql } from '@vercel/postgres';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });

export async function OPTIONS() {
  return json({}, 204);
}

// GET
export async function GET(_req, { params }) {
  const id = decodeURIComponent(params?.id || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400);

  try {
    const { rows } = await sql`
      SELECT project_id, client_name, status, steps_json, updated_at
      FROM projects
      WHERE project_id = ${id}
      LIMIT 1
    `;
    if (!rows.length) return json({ error: 'Not found' }, 404);

    const row = rows[0];
    return json({
      project_id: row.project_id,
      client_name: row.client_name,
      status: row.status,
      steps: row.steps_json ?? [],
      updated_at: row.updated_at,
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error', details: err.message }, 500);
  }
}

// POST
export async function POST(req, { params }) {
  const id = decodeURIComponent(params?.id || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400);

  const key = req.headers.get('x-admin-key');
  if (key !== process.env.ADMIN_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const client_name = (body.client_name || '').trim();
  const status = (body.status || '').trim();
  const steps = Array.isArray(body.steps) ? body.steps : [];

  if (!client_name || !status) {
    return json({ error: 'Missing client_name or status' }, 400);
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
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error', details: err.message }, 500);
  }
}
