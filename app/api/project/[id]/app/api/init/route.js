export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Create table once. Safe to call multiple times.
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        project_id  text PRIMARY KEY,
        client_name text NOT NULL,
        status      text NOT NULL,
        steps_json  jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at  timestamptz NOT NULL DEFAULT NOW()
      )
    `;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
