import { Hono } from "hono";
import {
  LeadCreate,
  LeadListQuery,
  LeadUpdate,
  NoteInput,
  StatusChangeInput,
} from "@app/shared";
import type { AppBindings } from "../env.js";
import { insertActivity, listActivitiesForLead } from "../repos/activities.js";
import {
  createLead,
  deleteLead,
  distinctCities,
  getLeadById,
  listLeads,
  updateLead,
} from "../repos/leads.js";

function splitMulti(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

export const leadsRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const parsed = LeadListQuery.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) {
      return c.json({ error: "invalid_query", issues: parsed.error.issues }, 400);
    }
    const q = parsed.data;
    const result = await listLeads(c.env.DB, {
      status: splitMulti(q.status),
      website_status: splitMulti(q.website_status),
      city: q.city,
      search: q.search,
      page: q.page,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });
    return c.json(result);
  })

  .get("/cities", async (c) => {
    const cities = await distinctCities(c.env.DB);
    return c.json({ cities });
  })

  .post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = LeadCreate.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
    }
    const id = await createLead(c.env.DB, parsed.data);
    const lead = await getLeadById(c.env.DB, id);
    return c.json({ lead }, 201);
  })

  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const lead = await getLeadById(c.env.DB, id);
    if (!lead) return c.json({ error: "not_found" }, 404);
    const activities = await listActivitiesForLead(c.env.DB, id);
    return c.json({ lead, activities });
  })

  .patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const body = await c.req.json().catch(() => ({}));
    const parsed = LeadUpdate.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
    }
    const existing = await getLeadById(c.env.DB, id);
    if (!existing) return c.json({ error: "not_found" }, 404);

    // If status was patched directly, log a status_change activity.
    const patch = parsed.data;
    if (patch.status && patch.status !== existing.status) {
      await insertActivity(c.env.DB, {
        lead_id: id,
        type: "status_change",
        body: `Status: ${existing.status} → ${patch.status}`,
        metadata: { from: existing.status, to: patch.status },
      });
    }

    const updated = await updateLead(c.env.DB, id, patch);
    return c.json({ lead: updated });
  })

  .delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const ok = await deleteLead(c.env.DB, id);
    if (!ok) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  })

  .post("/:id/status", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const body = await c.req.json().catch(() => ({}));
    const parsed = StatusChangeInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

    const existing = await getLeadById(c.env.DB, id);
    if (!existing) return c.json({ error: "not_found" }, 404);

    if (existing.status !== parsed.data.status) {
      await insertActivity(c.env.DB, {
        lead_id: id,
        type: "status_change",
        body: parsed.data.note
          ? `Status: ${existing.status} → ${parsed.data.status}\n\n${parsed.data.note}`
          : `Status: ${existing.status} → ${parsed.data.status}`,
        metadata: { from: existing.status, to: parsed.data.status },
      });
    }
    const updated = await updateLead(c.env.DB, id, { status: parsed.data.status });
    return c.json({ lead: updated });
  })

  .post("/:id/note", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid_id" }, 400);
    const body = await c.req.json().catch(() => ({}));
    const parsed = NoteInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

    const existing = await getLeadById(c.env.DB, id);
    if (!existing) return c.json({ error: "not_found" }, 404);

    const activityId = await insertActivity(c.env.DB, {
      lead_id: id,
      type: "note",
      body: parsed.data.body,
    });
    return c.json({ ok: true, activity_id: activityId }, 201);
  })

  .post("/import-csv", async (c) => {
    return c.json({ error: "not_implemented", phase: 7 }, 501);
  });
