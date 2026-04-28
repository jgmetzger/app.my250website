import { z } from "zod";
import { BUSINESS_TYPES, LEAD_STATUSES, WEBSITE_STATUSES } from "./types.js";

export const LoginInput = z.object({
  password: z.string().min(1).max(200),
});

export const LeadStatusEnum = z.enum(LEAD_STATUSES as [string, ...string[]]);
export const WebsiteStatusEnum = z.enum(WEBSITE_STATUSES as [string, ...string[]]);
export const BusinessTypeEnum = z.enum(BUSINESS_TYPES as [string, ...string[]]);

// Empty string -> null for the email field (HTML inputs send "" for cleared fields).
const NullableEmail = z
  .union([z.literal(""), z.string().email().max(200), z.null()])
  .transform((v) => (v === "" ? null : v));

// PATCH /api/leads/:id — every field optional (and most are nullable).
export const LeadUpdate = z
  .object({
    business_name: z.string().min(1).max(300).optional(),
    business_type: BusinessTypeEnum.nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    region: z.string().max(120).nullable().optional(),
    postcode: z.string().max(20).nullable().optional(),
    country: z.string().max(120).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    website_url: z.string().max(500).nullable().optional(),
    website_status: WebsiteStatusEnum.nullable().optional(),
    social_handles: z.string().max(2000).nullable().optional(),
    google_rating: z.number().min(0).max(5).nullable().optional(),
    google_review_count: z.number().int().min(0).nullable().optional(),
    email: NullableEmail.optional(),
    email_source: z.string().max(120).nullable().optional(),
    notes: z.string().max(20000).nullable().optional(),
    status: LeadStatusEnum.optional(),
  })
  .strict();

// POST /api/leads — manual create. business_name is required; everything else optional.
export const LeadCreate = z
  .object({
    business_name: z.string().min(1).max(300),
    business_type: BusinessTypeEnum.nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    region: z.string().max(120).nullable().optional(),
    postcode: z.string().max(20).nullable().optional(),
    country: z.string().max(120).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    website_url: z.string().max(500).nullable().optional(),
    google_rating: z.number().min(0).max(5).nullable().optional(),
    google_review_count: z.number().int().min(0).nullable().optional(),
    email: NullableEmail.optional(),
    email_source: z.string().max(120).nullable().optional(),
    notes: z.string().max(20000).nullable().optional(),
  })
  .strict();

export const StatusChangeInput = z.object({
  status: LeadStatusEnum,
  note: z.string().max(2000).optional(),
});

export const NoteInput = z.object({
  body: z.string().min(1).max(20000),
});

export const ScrapeRunInput = z.object({
  query: z.string().min(1).max(300),
  city: z.string().max(120).optional(),
  business_type: BusinessTypeEnum.optional(),
  min_reviews: z.number().int().min(0).max(100000).default(10),
  min_rating: z.number().min(0).max(5).default(4.0),
});

export const EmailTemplateInput = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  is_default: z.boolean().optional(),
});

export const SendEmailInput = z.object({
  lead_id: z.number().int().positive(),
  template_id: z.number().int().positive(),
  subject_override: z.string().max(300).optional(),
  body_override: z.string().max(20000).optional(),
});

export const CallLogInput = z.object({
  lead_id: z.number().int().positive(),
  duration_seconds: z.number().int().min(0).max(60 * 60 * 4),
  outcome: z.enum([
    "no_answer",
    "voicemail",
    "interested",
    "not_interested",
    "callback",
    "wrong_number",
  ]),
  notes: z.string().max(5000).optional(),
});

export const LeadListQuery = z.object({
  status: z.string().optional(),
  city: z.string().optional(),
  website_status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(["created_at", "rating", "last_activity"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type LoginInputT = z.infer<typeof LoginInput>;
export type LeadUpdateT = z.infer<typeof LeadUpdate>;
export type LeadCreateT = z.infer<typeof LeadCreate>;
export type StatusChangeInputT = z.infer<typeof StatusChangeInput>;
export type NoteInputT = z.infer<typeof NoteInput>;
export type ScrapeRunInputT = z.infer<typeof ScrapeRunInput>;
export type EmailTemplateInputT = z.infer<typeof EmailTemplateInput>;
export type SendEmailInputT = z.infer<typeof SendEmailInput>;
export type CallLogInputT = z.infer<typeof CallLogInput>;
export type LeadListQueryT = z.infer<typeof LeadListQuery>;
