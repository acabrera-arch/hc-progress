// app/api/init/route.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sql } from '@vercel/postgres';

const respond = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  });

export async function GET() {
  try {
    await sql`select 1`; // connectivity check

    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        project_id  TEXT PRIMARY KEY,
        client_name TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'On Track',
        steps_json  JSONB NOT NULL DEFAULT '[]',
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok:false, message: String(err), have_POSTGRES_URL: !!process.env.POSTGRES_URL }, 500);
  }
}
