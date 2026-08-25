export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


/* =========================================================
   CORS
========================================================= */

const ALLOWED = [
  'https://harwoodcarpentry.pro',
  'https://www.harwoodcarpentry.pro'
];


function corsHeaders(origin) {

  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, x-admin-key',
    'Access-Control-Max-Age': '86400'
  };

  if (
    origin &&
    ALLOWED.includes(origin)
  ) {

    headers['Access-Control-Allow-Origin'] =
      origin;

  }

  return headers;
}


function json(
  body,
  status = 200,
  origin = null
) {

  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        'Content-Type':
          'application/json',

        ...corsHeaders(origin)
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
      status:204,
      headers:
        corsHeaders(origin)
    }
  );

}


/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


function getFirstName(name) {

  return (
    String(name || '')
      .trim()
      .split(/\s+/)[0] ||
    'there'
  );

}


function normalizeChanges(changes) {

  if (!Array.isArray(changes)) {

    return [
      'Your project information has been updated.'
    ];

  }

  const cleaned =
    changes
      .map(change =>
        String(change || '').trim()
      )
      .filter(Boolean)
      .slice(0, 10);

  return cleaned.length
    ? cleaned
    : [
        'Your project information has been updated.'
      ];

}


function normalizePhone(phone) {

  const raw =
    String(phone || '').trim();

  if (!raw) {
    return '';
  }

  if (raw.startsWith('+')) {
    return raw;
  }

  const digits =
    raw.replace(/\D/g, '');

  if (digits.length === 10) {
    return '+1' + digits;
  }

  if (
    digits.length === 11 &&
    digits.startsWith('1')
  ) {
    return '+' + digits;
  }

  return raw;

}


/* =========================================================
   SEND EMAIL USING RESEND
========================================================= */

async function sendEmail({
  email,
  clientName,
  projectId,
  changes
}) {

  const apiKey =
    process.env.RESEND_API_KEY;

  const from =
    process.env.EMAIL_FROM;

  if (!apiKey) {

    throw new Error(
      'RESEND_API_KEY is not configured in Vercel.'
    );

  }

  if (!from) {

    throw new Error(
      'EMAIL_FROM is not configured in Vercel.'
    );

  }


  const changeList =
    changes
      .map(
        change =>
          `<li>${escapeHtml(change)}</li>`
      )
      .join('');


  const trackerBase =
    process.env.PROJECT_TRACKER_URL || '';


  const trackerUrl =
    trackerBase
      ? (
          trackerBase +
          (
            trackerBase.includes('?')
              ? '&'
              : '?'
          ) +
          'project=' +
          encodeURIComponent(projectId)
        )
      : '';


  const trackerButton =
    trackerUrl
      ? `
        <p style="margin-top:24px;">
          <a
            href="${escapeHtml(trackerUrl)}"
            style="
              display:inline-block;
              padding:12px 18px;
              background:#111827;
              color:#ffffff;
              text-decoration:none;
              border-radius:8px;
              font-weight:600;
            "
          >
            View Project Tracker
          </a>
        </p>
      `
      : '';


  const html = `

    <div
      style="
        font-family:Arial,Helvetica,sans-serif;
        max-width:620px;
        margin:auto;
        color:#1f2937;
        line-height:1.6;
      "
    >

      <p>
        Hi ${escapeHtml(
          getFirstName(clientName)
        )},
      </p>

      <p>
        There has been an update to your
        Harwood Carpentry project
        <strong>
          ${escapeHtml(projectId)}
        </strong>.
      </p>

      <ul>
        ${changeList}
      </ul>

      ${trackerButton}

      <p>
        If you have any questions,
        simply reply to this email.
      </p>

      <p>
        Best,<br>
        <strong>
          Harwood Carpentry
        </strong>
      </p>

    </div>

  `;


  const response =
    await fetch(
      'https://api.resend.com/emails',
      {

        method:'POST',

        headers:{

          'Authorization':
            `Bearer ${apiKey}`,

          'Content-Type':
            'application/json'

        },

        body:
          JSON.stringify({

            from,

            to:[
              email
            ],

            subject:
              `Project Update – ${projectId}`,

            html

          })

      }
    );


  const result =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {

    throw new Error(
      result.message ||
      result.error ||
      `Email failed (${response.status})`
    );

  }


  return result;

}


/* =========================================================
   SEND SMS USING TWILIO
========================================================= */

async function sendSms({
  phone,
  clientName,
  projectId,
  changes
}) {

  const sid =
    process.env.TWILIO_ACCOUNT_SID;

  const token =
    process.env.TWILIO_AUTH_TOKEN;

  const from =
    process.env.TWILIO_FROM_NUMBER;


  if (
    !sid ||
    !token ||
    !from
  ) {

    throw new Error(
      'Twilio environment variables are not configured in Vercel.'
    );

  }


  const normalizedPhone =
    normalizePhone(phone);


  const summary =
    changes
      .slice(0, 4)
      .map(
        change =>
          `• ${change}`
      )
      .join('\n');


  const message =
    [
      `Hi ${getFirstName(clientName)}, your Harwood Carpentry project ${projectId} has been updated.`,
      summary
    ]
      .filter(Boolean)
      .join('\n\n');


  const form =
    new URLSearchParams({

      To:
        normalizedPhone,

      From:
        from,

      Body:
        message

    });


  const auth =
    Buffer
      .from(
        `${sid}:${token}`
      )
      .toString('base64');


  const response =
    await fetch(

      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,

      {

        method:'POST',

        headers:{

          'Authorization':
            `Basic ${auth}`,

          'Content-Type':
            'application/x-www-form-urlencoded'

        },

        body:
          form.toString()

      }

    );


  const result =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {

    throw new Error(
      result.message ||
      `SMS failed (${response.status})`
    );

  }


  return result;

}


/* =========================================================
   POST /api/notify-project-update
========================================================= */

export async function POST(req) {

  const origin =
    req.headers.get('origin');


  /* -------------------------
     Admin Authentication
  ------------------------- */

  const key =
    req.headers.get(
      'x-admin-key'
    );


  if (
    !process.env.ADMIN_KEY ||
    key !== process.env.ADMIN_KEY
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
     Read Body
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


  const projectId =
    String(
      body.project_id || ''
    ).trim();


  const clientName =
    String(
      body.client_name || ''
    ).trim();


  const clientEmail =
    String(
      body.client_email || ''
    ).trim();


  const clientPhone =
    String(
      body.client_phone || ''
    ).trim();


  const notifyVia =
    String(
      body.notify_via ||
      'email'
    )
      .trim()
      .toLowerCase();


  const changes =
    normalizeChanges(
      body.changes
    );


  /* -------------------------
     Validation
  ------------------------- */

  if (!projectId) {

    return json(
      {
        error:
          'Project ID is required.'
      },
      400,
      origin
    );

  }


  if (
    ![
      'email',
      'sms',
      'both',
      'none'
    ].includes(notifyVia)
  ) {

    return json(
      {
        error:
          'Invalid notification method.'
      },
      400,
      origin
    );

  }


  if (notifyVia === 'none') {

    return json(
      {
        ok:true,
        skipped:true
      },
      200,
      origin
    );

  }


  if (
    (
      notifyVia === 'email' ||
      notifyVia === 'both'
    ) &&
    !clientEmail
  ) {

    return json(
      {
        error:
          'Client email is required.'
      },
      400,
      origin
    );

  }


  if (
    (
      notifyVia === 'sms' ||
      notifyVia === 'both'
    ) &&
    !clientPhone
  ) {

    return json(
      {
        error:
          'Client phone is required.'
      },
      400,
      origin
    );

  }


  /* -------------------------
     Send Notification
  ------------------------- */

  try {

    const results = {
      email:null,
      sms:null
    };


    if (
      notifyVia === 'email' ||
      notifyVia === 'both'
    ) {

      results.email =
        await sendEmail({

          email:
            clientEmail,

          clientName,

          projectId,

          changes

        });

    }


    if (
      notifyVia === 'sms' ||
      notifyVia === 'both'
    ) {

      results.sms =
        await sendSms({

          phone:
            clientPhone,

          clientName,

          projectId,

          changes

        });

    }


    return json(
      {

        ok:true,

        channels:
          notifyVia,

        results

      },
      200,
      origin
    );


  } catch (err) {

    console.error(
      'Notification error:',
      err
    );


    return json(
      {

        error:
          err instanceof Error
            ? err.message
            : String(err)

      },
      502,
      origin
    );

  }

}
