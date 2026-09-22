export const PROJECT_STATUSES = ["DRAFT", "ACTIVE", "SUSPENDED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PROVENANCE = [
  "PROJECT_PROVIDED",
  "INDEPENDENTLY_VERIFIED",
  "PROVIDER_DERIVED",
  "AI_INFERENCE",
  "UNKNOWN",
] as const;
export type ProjectProvenance = (typeof PROJECT_PROVENANCE)[number];

export const PROJECT_MEMBER_ROLES = [
  "project_owner",
  "project_editor",
  "project_viewer",
] as const;
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

export const PROJECT_WORKFLOW_STATES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;
export type ProjectWorkflowState = (typeof PROJECT_WORKFLOW_STATES)[number];

export const PROJECT_FIELD_KEYS = [
  "website",
  "x_url",
  "telegram_url",
  "discord_url",
  "short_description",
  "logo_url",
  "contact_email",
  "contact_note",
] as const;
export type ProjectFieldKey = (typeof PROJECT_FIELD_KEYS)[number];

export const PROJECT_FIELD_LABELS: Record<ProjectFieldKey, string> = {
  website: "Website",
  x_url: "X (Twitter)",
  telegram_url: "Telegram",
  discord_url: "Discord",
  short_description: "Short description",
  logo_url: "Logo URL",
  contact_email: "Contact email",
  contact_note: "Contact note",
};

export type Project = {
  id: string;
  slug: string;
  displayName: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  createdAt: string;
  updatedAt: string;
};

export type ProjectFieldValue = {
  id: string;
  projectId: string;
  fieldKey: ProjectFieldKey;
  value: unknown;
  provenance: ProjectProvenance;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
};

export type ProjectClaim = {
  id: string;
  projectId: string | null;
  claimantUserId: string;
  proposedSlug: string;
  proposedDisplayName: string;
  payload: Record<string, unknown>;
  state: ProjectWorkflowState;
  reviewerUserId: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type ProjectCorrection = {
  id: string;
  projectId: string;
  submitterUserId: string;
  fieldKey: string;
  proposedValue: unknown;
  rationale: string;
  state: ProjectWorkflowState;
  reviewerUserId: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export function isProjectMemberRole(value: unknown): value is ProjectMemberRole {
  return typeof value === "string" && (PROJECT_MEMBER_ROLES as readonly string[]).includes(value);
}

export function isProjectProvenance(value: unknown): value is ProjectProvenance {
  return typeof value === "string" && (PROJECT_PROVENANCE as readonly string[]).includes(value);
}

export function isProjectFieldKey(value: unknown): value is ProjectFieldKey {
  return typeof value === "string" && (PROJECT_FIELD_KEYS as readonly string[]).includes(value);
}

export function isProjectWorkflowState(value: unknown): value is ProjectWorkflowState {
  return typeof value === "string" && (PROJECT_WORKFLOW_STATES as readonly string[]).includes(value);
}
