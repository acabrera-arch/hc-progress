import { sql } from '@vercel/postgres';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-admin-key'
    }
  });

export async function OPTIONS() { return json({}, 204); }

// GET /api/project/:id — public read
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400);

  const { rows } = await sql`
    SELECT project_id, client_name, status, steps_json, updated_at
    FROM projects WHERE project_id = ${id} LIMIT 1;
  `;
  if (!rows.length) return json({ error: 'Not found', id }, 404);

  const p = rows[0];
  return json({
    project: {
      project_id: p.project_id,
      client_name: p.client_name,
      status: p.status,
      steps: p.steps_json ?? [],
      updated_at: p.updated_at
    }
  });
}

// POST /api/project/:id — admin update (X-Admin-Key)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const adminKey = req.headers.get('x-admin-key') || '';
  if (adminKey !== process.env.ADMIN_KEY) return json({ error: 'Unauthorized' }, 401);

  const id = decodeURIComponent(params.id || '').trim();
  if (!id) return json({ error: 'Missing id' }, 400);

  let payload: any = {};
  try { payload = await req.json(); } catch {}
  const client_name = payload.client_name ?? '';
  const status = payload.status ?? '';
  const steps = Array.isArray(payload.steps) ? payload.steps : null;

  await sql`
    INSERT INTO projects (project_id, client_name, status, steps_json)
    VALUES (${id}, ${client_name}, ${status || 'On Track'}, ${steps ?? sql`'[]'::jsonb`})
    ON CONFLICT (project_id)
    DO UPDATE SET
      client_name = COALESCE(NULLIF(${client_name}, ''), projects.client_name),
      status      = COALESCE(NULLIF(${status}, ''), projects.status),
      steps_json  = COALESCE(${steps ?? null}, projects.steps_json),
      updated_at  = NOW();
  `;

  return json({ ok: true, project_id: id });
}
