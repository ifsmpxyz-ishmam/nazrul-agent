/* ============================================================
 * netlify/edge-functions/contact.js
 *
 * Replaces Web3Forms. Accepts the existing contact form's
 * multipart/form-data submission (fields + up to 4 file
 * attachments), validates everything server-side, and sends
 * ONE email via Resend with all files as real attachments.
 *
 * Runs as a Netlify EDGE Function (Deno runtime), not a
 * standard serverless Function — this matters because standard
 * Functions cap requests at 6MB (≈4.5MB once binary data is
 * base64-decoded), which is too small for 4 files at 10MB each.
 * Edge Functions use the native Request/FormData Web APIs and
 * are not subject to that ceiling.
 *
 * Required environment variables (set in Netlify dashboard ->
 * Site settings -> Environment variables -> scope: Functions):
 *   RESEND_API_KEY   - your Resend API key (secret)
 *   EMAIL_TO         - the Gmail address that should receive submissions
 *   EMAIL_FROM       - optional, defaults to onboarding@resend.dev
 * ============================================================ */

const REQUIRED_FIELDS = ['name', 'phone', 'email', 'service', 'message'];

const ALLOWED_FILE_TYPES = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
};
const ALLOWED_EXTENSIONS = new Set(Object.values(ALLOWED_FILE_TYPES).flat());

const MAX_FILES       = 4;
const MAX_FILE_BYTES  = 10 * 1024 * 1024; // 10 MB per file — matches the spec
// Combined safety cap: Gmail rejects incoming mail over ~25MB total, and
// base64 transport encoding inflates raw attachment bytes by ~37%. Capping
// the RAW combined total at 15MB keeps the final MIME message safely under
// ~20.5MB, comfortably inside Gmail's ceiling. Per-file 10MB cap is untouched.
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getExtension(filename) {
  const parts = String(filename).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function extractFormData(formData) {
  const fields = {};
  const files  = [];

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (!value.name) continue; // skip empty file inputs
      const buffer = new Uint8Array(await value.arrayBuffer());
      files.push({
        filename: value.name,
        contentType: value.type || 'application/octet-stream',
        size: buffer.length,
        bytes: buffer,
      });
    } else {
      fields[key] = String(value);
    }
  }

  return { fields, files };
}

function validateFields(fields) {
  if (fields['bot-field'] && fields['bot-field'].trim() !== '') {
    return { ok: false, isBot: true };
  }

  for (const key of REQUIRED_FIELDS) {
    if (!fields[key] || !fields[key].trim()) {
      return { ok: false, error: `Missing required field: ${key}.` };
    }
  }

  if (!/^[0-9]{11}$/.test(fields.phone.trim())) {
    return { ok: false, error: 'Phone number must be exactly 11 digits.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  return { ok: true };
}

function validateFiles(files) {
  if (files.length > MAX_FILES) {
    return { ok: false, error: `Maximum ${MAX_FILES} files allowed (received ${files.length}).` };
  }

  let totalBytes = 0;

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: `"${file.filename}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 10MB per file.` };
    }

    const ext = getExtension(file.filename);
    const typeOk = ALLOWED_FILE_TYPES[file.contentType] !== undefined;
    const extOk  = ALLOWED_EXTENSIONS.has(ext);

    if (!typeOk && !extOk) {
      return { ok: false, error: `"${file.filename}" has an unsupported file type. Allowed: PDF, JPG, PNG, DOC, DOCX.` };
    }

    totalBytes += file.size;
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error: `Combined attachments are ${(totalBytes / 1024 / 1024).toFixed(1)}MB — please keep the total under ${MAX_TOTAL_BYTES / 1024 / 1024}MB so the email can be delivered.`,
    };
  }

  return { ok: true };
}

function buildEmailHtml(fields) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <h2 style="color:#0a193c; border-bottom: 2px solid #c9a84c; padding-bottom: 8px;">
        New Contact Form Submission
      </h2>
      <table cellpadding="8" style="width:100%; border-collapse: collapse;">
        <tr><td style="font-weight:bold; width:120px;">Name</td><td>${escapeHtml(fields.name)}</td></tr>
        <tr><td style="font-weight:bold;">Phone</td><td>${escapeHtml(fields.phone)}</td></tr>
        <tr><td style="font-weight:bold;">Email</td><td>${escapeHtml(fields.email)}</td></tr>
        <tr><td style="font-weight:bold;">Service</td><td>${escapeHtml(fields.service)}</td></tr>
        <tr><td style="font-weight:bold; vertical-align:top;">Message</td><td style="white-space:pre-wrap;">${escapeHtml(fields.message)}</td></tr>
      </table>
    </div>
  `;
}

/** Converts a Uint8Array to base64 without blowing the call stack on large files. */
function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export default async (request, context) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed.' });
  }

  const RESEND_API_KEY = Netlify.env.get('RESEND_API_KEY');
  const EMAIL_TO        = Netlify.env.get('EMAIL_TO');
  const EMAIL_FROM       = Netlify.env.get('EMAIL_FROM') || 'Global Logistics Network <onboarding@resend.dev>';

  if (!RESEND_API_KEY || !EMAIL_TO) {
    console.error('[contact] Missing RESEND_API_KEY or EMAIL_TO environment variable.');
    return jsonResponse(500, { success: false, error: 'Server is not configured correctly. Please contact us via WhatsApp instead.' });
  }

  let fields, files;
  try {
    const formData = await request.formData();
    ({ fields, files } = await extractFormData(formData));
  } catch (err) {
    console.error('[contact] Failed to parse form data:', err);
    return jsonResponse(400, { success: false, error: 'Could not read the submitted form. Please try again.' });
  }

  const fv = validateFields(fields);
  if (!fv.ok) {
    if (fv.isBot) {
      // Pretend success so bots don't learn the honeypot was detected.
      return jsonResponse(200, { success: true });
    }
    return jsonResponse(400, { success: false, error: fv.error });
  }

  const filev = validateFiles(files);
  if (!filev.ok) {
    return jsonResponse(400, { success: false, error: filev.error });
  }

  const payload = {
    from: EMAIL_FROM,
    to: [EMAIL_TO],
    reply_to: fields.email.trim(),
    subject: `New Inquiry — ${fields.service} — ${fields.name}`,
    html: buildEmailHtml(fields),
    attachments: files.map(f => ({
      filename: f.filename,
      content: bytesToBase64(f.bytes),
    })),
  };

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('[contact] Resend API error:', resendRes.status, errBody);
      return jsonResponse(502, {
        success: false,
        error: 'Could not send your message right now. Please try again shortly or contact us via WhatsApp.',
      });
    }

    const data = await resendRes.json();
    return jsonResponse(200, { success: true, id: data.id });

  } catch (err) {
    console.error('[contact] Unexpected error calling Resend:', err);
    return jsonResponse(500, { success: false, error: 'Server error. Please try again later.' });
  }
};