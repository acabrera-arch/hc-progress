export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sql } from '@vercel/postgres';
export async function GET() {
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      project_id  TEXT PRIMARY KEY,
      client_name TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'On Track',
      steps_json  JSONB NOT NULL DEFAULT '[]',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  });
}
