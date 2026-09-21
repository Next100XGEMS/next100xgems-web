import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireAdminAccess } from "@/lib/auth/authorization";

export const AUDIT_ACTIONS = [
  "feature_flag.updated",
  "article.published",
  "article.updated",
  "radar.reviewed",
  "radar.published",
  "radar.rejected",
  "partner.updated",
  "campaign.updated",
  "role.assigned",
  "project.claim.submitted",
  "project.claim.reviewed",
  "project.field.updated",
  "project.correction.submitted",
  "project.correction.reviewed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditResourceType =
  | "feature_flag"
  | "article"
  | "radar_analysis"
  | "radar_review"
  | "partner"
  | "campaign"
  | "role"
  | "project_claim"
  | "project_field"
  | "project_correction";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AuditEventInput = {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  previousState?: unknown;
  resultingState?: unknown;
  metadata?: unknown;
};

export type AuditEventReceipt = {
  id: string;
  actorId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
};

export class AuditWriteError extends Error {
  constructor(message = "Audit persistence is temporarily unavailable.") {
    super(message);
    this.name = "AuditWriteError";
  }
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /(?:password|passwd|secret|token|authorization|api[_-]?key|private[_-]?key|client[_-]?secret|database[_-]?password|refresh[_-]?token|access[_-]?token|cookie)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let auditClient: SupabaseClient | null | undefined;

function getAuditClient() {
  if (auditClient !== undefined) {
    return auditClient;
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    auditClient = null;
    return auditClient;
  }

  auditClient = createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return auditClient;
}

function sanitizeValue(value: unknown, seen: WeakSet<object>, depth = 0): JsonValue {
  if (depth > 8) {
    throw new AuditWriteError("Audit snapshot is too deeply nested.");
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new AuditWriteError("Audit snapshot contains an invalid number.");
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new AuditWriteError("Audit snapshot contains a cycle.");
    }
    seen.add(value);
    const result = value.map((item) => sanitizeValue(item, seen, depth + 1));
    seen.delete(value);
    return result;
  }

  if (typeof value !== "object" || value === undefined) {
    throw new AuditWriteError("Audit snapshot contains an unsupported value.");
  }

  if (seen.has(value)) {
    throw new AuditWriteError("Audit snapshot contains a cycle.");
  }
  seen.add(value);

  const result: { [key: string]: JsonValue } = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : sanitizeValue(item, seen, depth + 1);
  }

  seen.delete(value);
  return result;
}

function sanitizeObject(value: unknown, label: string, fallback: Record<string, JsonValue>) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const sanitized = sanitizeValue(value, new WeakSet<object>());
  if (typeof sanitized !== "object" || Array.isArray(sanitized)) {
    throw new AuditWriteError(`${label} must be an object.`);
  }

  return sanitized;
}

async function getTrustedAuditActor() {
  const context = await requireAdminAccess();
  return { userId: context.userId } as const;
}

export async function writeAuditEvent(event: AuditEventInput): Promise<AuditEventReceipt> {
  const actor = await getTrustedAuditActor();

  if (!UUID_PATTERN.test(event.resourceId)) {
    throw new AuditWriteError("Audit resource identifiers must be UUIDs.");
  }

  const client = getAuditClient();
  if (!client) {
    throw new AuditWriteError();
  }

  const { data, error } = await client.rpc("write_audit_event", {
    p_actor_kind: "USER",
    p_actor_id: actor.userId,
    p_action: event.action,
    p_resource_type: event.resourceType,
    p_resource_id: event.resourceId,
    p_previous_state: sanitizeObject(event.previousState, "previousState", {}),
    p_resulting_state: sanitizeObject(event.resultingState, "resultingState", {}),
    p_metadata: sanitizeObject(event.metadata, "metadata", {}),
  });

  if (error || typeof data !== "string") {
    throw new AuditWriteError();
  }

  return {
    id: data,
    actorId: actor.userId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
  };
}
