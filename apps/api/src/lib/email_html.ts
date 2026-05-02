// HTML rendering for outbound emails. We accept the template body as plain
// text (easier to edit in the Templates UI) and convert to HTML at send time,
// then append the brand signature. Resend ships both `text` and `html` in the
// same request, so plain-text clients see the text version and HTML clients
// see this prettified version.

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const PARAGRAPH_STYLE =
  'font-family: Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111; margin: 0 0 1em;';

/**
 * Convert a rendered plain-text body to inline-styled HTML paragraphs. Blank
 * lines split paragraphs; single newlines become <br>. URLs that look like
 * http(s)://… are auto-linked.
 */
function textToHtmlBody(text: string): string {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map((p) => {
      const linked = autoLink(escapeHtml(p)).replace(/\n/g, "<br>");
      return `<p style="${PARAGRAPH_STYLE}">${linked}</p>`;
    })
    .join("");
}

function autoLink(escapedText: string): string {
  // Operates on already-escaped HTML — safe to insert <a> tags.
  return escapedText.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color: #7c3aed;">${url}</a>`,
  );
}

const SIGNATURE_HTML = `
<table style="border-width: 0; width: 600px; max-width: 100%; margin-top: 24px;" cellpadding="0" cellspacing="0">
  <tr>
    <td style="border-width: 0; width: 130px; vertical-align: top;">
      <img src="https://jgmetzger.com/email/email-james-wfc.png"
           alt="James Metzger"
           width="122" height="119"
           style="height: auto; margin: 10px 0 0.7em; max-width: 100%; display: block;">
    </td>
    <td style="border-width: 0; vertical-align: top;">
      <p style="color: #666; font-family: Helvetica, Arial, 'Gill Sans', 'Gill Sans MT', 'Myriad Pro', 'DejaVu Sans Condensed', sans-serif; font-size: 12px; line-height: 1.6em; margin: 0;">
        <span style="color: #7c3aed; font-size: 1.2em;"><strong>James Metzger</strong></span><br>
        <i>Websites for Bars &amp; Restaurants</i><br>
        <br>
        <a href="https://my250website.com" target="_blank" rel="noopener noreferrer"
           style="color: #666; font-family: Helvetica, Arial, 'Gill Sans', 'Gill Sans MT', 'Myriad Pro', 'DejaVu Sans Condensed', sans-serif; font-size: 12px; text-decoration: none;">
          <strong>my250website.com</strong>
        </a>
      </p>
    </td>
  </tr>
</table>
`.trim();

/** Plain-text fallback signature. Sent in the `text` part for clients that don't render HTML. */
const SIGNATURE_TEXT = `
--
James Metzger
Websites for Bars & Restaurants
my250website.com
`.trimStart();

export function buildEmailHtml(textBody: string): string {
  return `<!doctype html><html><body style="margin: 0; padding: 0; background: #fff;">
<div style="max-width: 600px; margin: 0 auto; padding: 16px;">
${textToHtmlBody(textBody)}
${SIGNATURE_HTML}
</div></body></html>`;
}

export function appendTextSignature(textBody: string): string {
  return `${textBody.trimEnd()}\n\n${SIGNATURE_TEXT}`;
}
