export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { sql } from '@vercel/postgres';


/* =========================================================
   CORS
========================================================= */

const ALLOWED = (
  process.env.ALLOWED_ORIGINS ??
  'https://harwoodcarpentry.pro,https://www.harwoodcarpentry.pro'
)
  .split(',')
  .map(s => s.trim());

if (process.env.NODE_ENV !== 'production') {
  [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ].forEach(o => {
    if (!ALLOWED.includes(o)) {
      ALLOWED.push(o);
    }
  });
}


function buildCorsHeaders(origin) {

  const allowOrigin =
    origin && ALLOWED.includes(origin)
      ? origin
      : '';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, x-admin-key',
    'Access-Control-Max-Age': '86400',
    ...(allowOrigin
      ? { 'Access-Control-Allow-Credentials': 'true' }
      : {}),
  };

}


function json(body, status = 200, origin = null) {

  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...buildCorsHeaders(origin)
      }
    }
  );

}


export async function OPTIONS(req) {

  const origin =
    req.headers.get('origin');

  return new Response(
    null,
    {
      status: 204,
      headers: buildCorsHeaders(origin)
    }
  );

}



/* =========================================================
   DEFAULT STEPS
========================================================= */

const DEFAULT_STEPS = [

  {
    id:'inquiry',
    title:'Inquiry Received',
    desc:'We’ve received your request.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'intake',
    title:'Discovery Call',
    desc:'Discuss needs, timeline, and budget.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'site_visit',
    title:'Site Visit & Measurements',
    desc:'On-site measurements and photos.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'design',
    title:'Design & Drawings',
    desc:'Concept & shop drawings prepared.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'quote',
    title:'Quote Shared',
    desc:'Fixed quote based on design.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'approval',
    title:'Approval / Contract',
    desc:'Client approval & contract execution.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'deposit',
    title:'Deposit Received',
    desc:'Deposit posted to start procurement.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'ordering',
    title:'Materials Ordered',
    desc:'Lumber, hardware, and finishes ordered.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'fabrication',
    title:'Fabrication',
    desc:'Cutting, joinery, and assembly in shop.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'finishing',
    title:'Finishing',
    desc:'Sanding, stain/paint, and top coat.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'schedule',
    title:'Install Scheduled',
    desc:'Install date coordinated with client.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'install',
    title:'Installation',
    desc:'On-site installation and fit.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'punch',
    title:'Punch List',
    desc:'Final walk-through & touch-ups.',
    note:'',
    date:'',
    done:false
  },

  {
    id:'complete',
    title:'Complete',
    desc:'Handover & warranty information.',
    note:'',
    date:'',
    done:false
  }

];



/* =========================================================
   JSON HELPER
========================================================= */

function parseMaybeJson(value) {

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }

}



/* =========================================================
   NORMALIZE STEPS
========================================================= */

function normalizeSteps(input) {

  input =
    parseMaybeJson(input);

  const byId =
    Object.create(null);


  (
    Array.isArray(input)
      ? input
      : []
  ).forEach(step => {

    if (
      step &&
      typeof step.id === 'string'
    ) {
      byId[step.id] = step;
    }

  });


  return DEFAULT_STEPS.map(defaultStep => {

    const saved =
      byId[defaultStep.id] || {};

    return {

      id:
        defaultStep.id,

      title:
        saved.title ??
        defaultStep.title,

      desc:
        saved.desc ??
        saved.description ??
        defaultStep.desc ??
        '',

      note:
        saved.note ??
        '',

      date:
        saved.date ??
        '',

      done:
        !!saved.done

    };

  });

}



/* =========================================================
   NORMALIZE TAGS
========================================================= */

function normalizeTags(input) {

  input =
    parseMaybeJson(input);


  if (
    input === undefined ||
    input === null ||
    input === ''
  ) {
    return [];
  }


  let tags;


  if (Array.isArray(input)) {

    tags =
      input.map(tag =>
        String(tag).trim()
      );

  } else {

    tags =
      String(input)
        .split(',')
        .map(tag => tag.trim());

  }


  const seen =
    new Set();


  return tags.filter(tag => {

    if (!tag) {
      return false;
    }

    const key =
      tag.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;

  });

}



/* =========================================================
   GET /api/project/[id]
   PUBLIC PROJECT LOOKUP
========================================================= */

export async function GET(req, context) {

  const origin =
    req.headers.get('origin');


  try {

    const params =
      await context.params;

    const id =
      String(
        params?.id || ''
      ).trim();


    if (!id) {

      return json(
        {
          error:'Project ID is required'
        },
        400,
        origin
      );

    }


    const { rows } =
      await sql`

      SELECT
  project_id,
  client_name,
  client_email,
  client_phone,
  notify_via,
  status,
  steps_json,
  tags_json,
  updated_at
          

        FROM projects

        WHERE project_id = ${id}

        LIMIT 1

      `;


    if (!rows.length) {

      return json(
        {
          error:'Project not found'
        },
        404,
        origin
      );

    }


    const row =
      rows[0];


    const steps =
      normalizeSteps(
        row.steps_json
      );


    const tags =
      normalizeTags(
        row.tags_json
      );


    return json(
      {

        project_id:
          row.project_id,

   client_name:
  row.client_name,

client_email:
  row.client_email || '',

client_phone:
  row.client_phone || '',

notify_via:
  row.notify_via || 'email',

status:
  row.status,

        tags:
          tags,

        project_tags:
          tags,

        steps:
          steps,

        steps_json:
          steps,

        updated_at:
          row.updated_at

      },
      200,
      origin
    );


  } catch (err) {

    console.error(
      'GET project error:',
      err
    );


    return json(
      {
        error:'Database error',
        details:err.message
      },
      500,
      origin
    );

  }

}



/* =========================================================
   POST /api/project/[id]
   CREATE OR UPDATE SPECIFIC PROJECT
========================================================= */

export async function POST(req, context) {

  const origin =
    req.headers.get('origin');


  /* -------------------------
     Admin authentication
  ------------------------- */

  const key =
    req.headers.get('x-admin-key');


  if (
    key !==
    process.env.ADMIN_KEY
  ) {

    return json(
      {
        error:'Unauthorized'
      },
      401,
      origin
    );

  }


  /* -------------------------
     Project ID from URL
  ------------------------- */

  const params =
    await context.params;


  const id =
    String(
      params?.id || ''
    ).trim();


  if (!id) {

    return json(
      {
        error:'Project ID is required'
      },
      400,
      origin
    );

  }


  /* -------------------------
     Body
  ------------------------- */

  let body;


  try {

    body =
      await req.json();

  } catch {

    return json(
      {
        error:'Invalid JSON body'
      },
      400,
      origin
    );

  }


  /* -------------------------
     Fields
  ------------------------- */

const client_email =
  String(
    body.client_email ??
    ''
  ).trim();


const client_phone =
  String(
    body.client_phone ??
    ''
  ).trim();


const notify_via =
  String(
    body.notify_via ??
    'email'
  ).trim();
    String(
      body.status ??
      'On Track'
    ).trim();


  if (!client_name) {

    return json(
      {
        error:'Client name is required'
      },
      400,
      origin
    );

  }


  const steps =
    normalizeSteps(
      body.steps ??
      body.steps_json
    );


  const tags =
    normalizeTags(
      body.tags ??
      body.project_tags
    );


  /* -------------------------
     UPSERT
     Creates project if missing.
     Updates project if existing.
  ------------------------- */

  try {

    const { rows } =
  await sql`
    INSERT INTO projects
    (
      project_id,
      client_name,
      client_email,
      client_phone,
      notify_via,
      status,
      steps_json,
      tags_json,
      updated_at
    )

    VALUES
    (
      ${id},
      ${client_name},
      ${client_email || null},
      ${client_phone || null},
      ${notify_via},
      ${status},
      CAST(${JSON.stringify(steps)} AS jsonb),
      CAST(${JSON.stringify(tags)} AS jsonb),
      NOW()
    )

    ON CONFLICT (project_id)

    DO UPDATE SET

      client_name =
        EXCLUDED.client_name,

      client_email =
        EXCLUDED.client_email,

      client_phone =
        EXCLUDED.client_phone,

      notify_via =
        EXCLUDED.notify_via,

      status =
        EXCLUDED.status,

      steps_json =
        EXCLUDED.steps_json,

      tags_json =
        EXCLUDED.tags_json,

      updated_at =
        NOW()

    RETURNING
      project_id,
      client_name,
      client_email,
      client_phone,
      notify_via,
      status,
      steps_json,
      tags_json,
      updated_at
  `;


    const row =
      rows[0];


    const savedSteps =
      normalizeSteps(
        row.steps_json
      );


    const savedTags =
      normalizeTags(
        row.tags_json
      );


    return json(
      {

        ok:true,

        project_id:
          row.project_id,

    client_name:
  row.client_name,

client_email:
  row.client_email || '',

client_phone:
  row.client_phone || '',

notify_via:
  row.notify_via || 'email',

status:
  row.status,

        tags:
          savedTags,

        project_tags:
          savedTags,

        steps:
          savedSteps,

        steps_json:
          savedSteps,

        updated_at:
          row.updated_at

      },
      200,
      origin
    );


  } catch (err) {

    console.error(
      'POST project error:',
      err
    );


    return json(
      {

        error:
          'Database error',

        details:
          err.message

      },
      500,
      origin
    );

  }

}
