const { Resend } = require('resend');
const logger = require('../utils/logger');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://psych1cparr0t-dev.github.io/hantaview/';
const API_BASE      = process.env.API_BASE_URL  || 'https://hantaview-backend.onrender.com';
const FROM_EMAIL    = process.env.ALERTS_FROM_EMAIL || 'Hantaview Alerts <alerts@resend.dev>';

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function buildCaseRows(cases) {
  return cases.map(c => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #1a3333;color:#c8e6e6;">${c.location || c.country || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #1a3333;color:#c8e6e6;">${c.confirmed ?? '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #1a3333;color:${c.strain === 'andes' ? '#e85a30' : '#20c9c9'};">${(c.strain || '—').toUpperCase()}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #1a3333;color:#c8e6e6;">${c.date ?? '—'}</td>
    </tr>
  `).join('');
}

/**
 * Send a zone alert email via Resend.
 * @param {object} opts
 * @param {string}   opts.to           — recipient email
 * @param {object[]} opts.cases        — array of case objects that hit the zone
 * @param {object}   opts.zone         — subscription row {north,south,east,west}
 * @param {string}   opts.unsubscribeId — subscription id for the unsubscribe link
 */
async function sendAlertEmail({ to, cases, zone, unsubscribeId }) {
  const resend = getResend();
  const count  = cases.length;
  const unsubUrl = `${API_BASE}/api/alerts/${unsubscribeId}?action=unsubscribe`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1a1a;font-family:'Courier New',Courier,monospace;color:#c8e6e6;">
<div style="max-width:580px;margin:0 auto;padding:28px 16px;">
<div style="border:1px solid #20c9c9;border-radius:4px;overflow:hidden;">

  <!-- Header -->
  <div style="background:#0d2222;padding:18px 24px;border-bottom:1px solid #20c9c9;">
    <div style="font-size:10px;letter-spacing:3px;color:#20c9c9;margin-bottom:6px;text-transform:uppercase;">Hantaview · Surveillance Alert</div>
    <div style="font-size:18px;font-weight:bold;color:#e8f4f4;">
      ⚠&nbsp; ${count} New Case${count > 1 ? 's' : ''} in Your Monitored Zone
    </div>
  </div>

  <!-- Zone summary -->
  <div style="background:#0d2222;padding:16px 24px 0;">
    <p style="margin:0 0 4px;font-size:11px;color:#3a6666;letter-spacing:1px;text-transform:uppercase;">Monitoring Zone</p>
    <p style="margin:0 0 16px;font-size:12px;color:#99c0c0;">
      N&nbsp;${zone.north.toFixed(2)}°&nbsp;&nbsp;S&nbsp;${zone.south.toFixed(2)}°&nbsp;&nbsp;
      E&nbsp;${zone.east.toFixed(2)}°&nbsp;&nbsp;W&nbsp;${zone.west.toFixed(2)}°
    </p>
  </div>

  <!-- Case table -->
  <div style="background:#0d2222;padding:0 24px 20px;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#143333;">
          <th style="padding:8px 10px;text-align:left;color:#20c9c9;font-weight:600;letter-spacing:.5px;">Location</th>
          <th style="padding:8px 10px;text-align:left;color:#20c9c9;font-weight:600;letter-spacing:.5px;">Confirmed</th>
          <th style="padding:8px 10px;text-align:left;color:#20c9c9;font-weight:600;letter-spacing:.5px;">Strain</th>
          <th style="padding:8px 10px;text-align:left;color:#20c9c9;font-weight:600;letter-spacing:.5px;">Date</th>
        </tr>
      </thead>
      <tbody>
        ${buildCaseRows(cases)}
      </tbody>
    </table>
  </div>

  <!-- Disclaimer -->
  <div style="background:#0d2222;padding:0 24px 20px;">
    <div style="background:#0a1a1a;border-left:3px solid #e85a30;padding:11px 14px;font-size:11px;line-height:1.75;color:#7aacac;">
      <strong style="color:#e85a30;">Secondary indicator only.</strong>&nbsp;
      Case data is sourced from CDC&nbsp;NNDSS, WHO&nbsp;Disease Outbreak News, and ECDC published reports.
      All datasets carry inherent reporting delays of days to weeks and counts are subject to revision.
      This alert does not replace guidance from your national or regional health authority.
      Continue standard infection-control measures regardless of alert status.
    </div>
  </div>

  <!-- CTA -->
  <div style="background:#0d2222;padding:0 24px 24px;">
    <a href="${DASHBOARD_URL}"
       style="display:inline-block;background:#20c9c9;color:#0a1a1a;text-decoration:none;
              padding:10px 22px;font-size:11px;font-weight:bold;letter-spacing:1.5px;
              border-radius:3px;text-transform:uppercase;">
      Open Dashboard
    </a>
  </div>

  <!-- Footer -->
  <div style="background:#071414;padding:12px 24px;border-top:1px solid #1a3333;font-size:10px;color:#3a5858;line-height:1.7;">
    You are receiving this alert because you registered a monitoring zone at hantaview-backend.onrender.com.<br>
    <a href="${unsubUrl}" style="color:#20c9c9;text-decoration:none;">Unsubscribe</a>
    &mdash; removes your address and zone permanently, no questions asked.
  </div>

</div>
</div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[Hantaview] ${count} case${count > 1 ? 's' : ''} detected in your alert zone`,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);

  logger.info({ message: 'Alert email dispatched', to, messageId: data.id, caseCount: count });
  return data;
}

module.exports = { sendAlertEmail };
