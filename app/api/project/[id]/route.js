export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sql } from '@vercel/postgres';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-admin-key',
    },
  });

export async function OPTIONS() {
  return json({}, 204);
}

// 📌 GET — retrieve project data by ID
export async function GET(_req, { params }) {
  const id = decodeURIComponent(params?.id || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400);

  try {
    const { rows } = await sql`SELECT * FROM projects WHERE id = ${id}`;
    if (!rows.length) return json({ error: 'Not found' }, 404);
    return json(rows[0]);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error', details: err.message }, 500);
  }
}

// 📌 POST — add or update project data
export async function POST(req, { params }) {
  const id = decodeURIComponent(params?.id || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400);

  const body = await req.json();
  const { client_name, status, steps } = body;
  const key = req.headers.get('x-admin-key');

  // 🔑 Replace with your actual admin key
  if (key !== process.env.ADMIN_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    await sql`
      INSERT INTO projects (id, client_name, status, steps)
      VALUES (${id}, ${client_name}, ${status}, ${JSON.stringify(steps)})
      ON CONFLICT (id)
      DO UPDATE SET client_name = ${client_name}, status = ${status}, steps = ${JSON.stringify(steps)};
    `;
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error', details: err.message }, 500);
  }
}
