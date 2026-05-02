import { Hono } from "hono";
import { EmailTemplateInput, SendEmailInput } from "@app/shared";
import type { AppBindings } from "../env.js";
import { insertActivity } from "../repos/activities.js";
import {
  countEmailsSentToday,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from "../repos/email_templates.js";
import { getLeadById, updateLead } from "../repos/leads.js";
import { resendSend } from "../lib/resend.js";
import { leadVars, renderTemplate } from "../lib/template.js";
import { appendTextSignature, buildEmailHtml } from "../lib/email_html.js";

export const emailRoutes = new Hono<AppBindings>()
  .get("/templates", async (c) => {
    const templates = await listTemplates(c.env.DB);
    return c.json({ templates });
  })

  .post("/templates", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = EmailTemplateInput.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
    }
    const id = await createTemplate(c.env.DB, parsed.data);
    const tmpl = await getTemplate(c.env.DB, id);
    return c.json({ template: tmpl }, 201);
  })

  .put("/templates/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const body = await c.req.json().catch(() => ({}));
    const parsed = EmailTemplateInput.partial().safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
    }
    const tmpl = await updateTemplate(c.env.DB, id, parsed.data);
    if (!tmpl) return c.json({ error: "not_found" }, 404);
    return c.json({ template: tmpl });
  })

  .delete("/templates/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const ok = await deleteTemplate(c.env.DB, id);
    if (!ok) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  })

  .get("/quota", async (c) => {
    const cap = Number(c.env.DAILY_EMAIL_CAP) || 15;
    const sentToday = await countEmailsSentToday(c.env.DB);
    return c.json({ sent_today: sentToday, daily_cap: cap, remaining: Math.max(0, cap - sentToday) });
  })

  .post("/send", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = SendEmailInput.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
    }
    const cap = Number(c.env.DAILY_EMAIL_CAP) || 15;
    const sentToday = await countEmailsSentToday(c.env.DB);
    if (sentToday >= cap) {
      return c.json({ error: "daily_cap_reached", sent_today: sentToday, daily_cap: cap }, 429);
    }

    const lead = await getLeadById(c.env.DB, parsed.data.lead_id);
    if (!lead) return c.json({ error: "lead_not_found" }, 404);
    if (!lead.email) return c.json({ error: "lead_has_no_email" }, 400);

    const template = await getTemplate(c.env.DB, parsed.data.template_id);
    if (!template) return c.json({ error: "template_not_found" }, 404);

    const vars = leadVars(lead);
    const subject = parsed.data.subject_override ?? renderTemplate(template.subject, vars);
    const bodyText = parsed.data.body_override ?? renderTemplate(template.body, vars);
    const text = appendTextSignature(bodyText);
    const html = buildEmailHtml(bodyText);

    if (!c.env.RESEND_API_KEY) return c.json({ error: "resend_not_configured" }, 503);

    let resendId: string;
    try {
      const result = await resendSend({
        apiKey: c.env.RESEND_API_KEY,
        from: `${c.env.SENDER_NAME} <${c.env.SENDER_EMAIL}>`,
        to: lead.email,
        subject,
        text,
        html,
        tags: [
          { name: "lead_id", value: String(lead.id) },
          { name: "template_id", value: String(template.id) },
        ],
      });
      resendId = result.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: "send_failed", message }, 502);
    }

    await insertActivity(c.env.DB, {
      lead_id: lead.id,
      type: "email_sent",
      direction: "outbound",
      subject,
      body: text,
      metadata: { resend_id: resendId, template_id: template.id },
    });

    // Auto-bump status: researched -> contacted on first send.
    if (lead.status === "researched") {
      await updateLead(c.env.DB, lead.id, { status: "contacted" });
      await insertActivity(c.env.DB, {
        lead_id: lead.id,
        type: "status_change",
        body: "Status: researched → contacted (auto, first email)",
        metadata: { from: "researched", to: "contacted", auto: true },
      });
    }

    return c.json({ ok: true, resend_id: resendId, sent_today: sentToday + 1, daily_cap: cap });
  });
