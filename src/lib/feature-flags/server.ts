import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export const FEATURE_FLAG_KEYS = [
  "radar_enabled",
  "research_enabled",
  "advertising_enabled",
  "featured_partners_enabled",
  "booking_enabled",
  "newsletter_enabled",
  "maintenance_mode",
  "radar_auto_publish",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
export type FeatureFlagState = {
  key: FeatureFlagKey;
  enabled: boolean;
};
export type FeatureFlagValues = Partial<Record<FeatureFlagKey, boolean>>;

const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  radar_enabled: false,
  research_enabled: false,
  advertising_enabled: false,
  featured_partners_enabled: false,
  booking_enabled: false,
  newsletter_enabled: false,
  maintenance_mode: true,
  radar_auto_publish: false,
};

type FeatureFlagRow = {
  key: unknown;
  enabled: unknown;
  configuration: unknown;
};

let featureFlagClient: SupabaseClient | null | undefined;

function isFeatureFlagKey(value: unknown): value is FeatureFlagKey {
  return typeof value === "string" && (FEATURE_FLAG_KEYS as readonly string[]).includes(value);
}

function isValidConfiguration(value: unknown) {
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

function getFeatureFlagClient() {
  if (featureFlagClient !== undefined) {
    return featureFlagClient;
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    featureFlagClient = null;
    return featureFlagClient;
  }

  featureFlagClient = createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return featureFlagClient;
}

async function readFeatureFlagRows(keys: readonly FeatureFlagKey[]) {
  const client = getFeatureFlagClient();
  if (!client || keys.length === 0) {
    return null;
  }

  const { data, error } = await client
    .from("feature_flags")
    .select("key, enabled, configuration")
    .in("key", [...keys]);

  if (error || !Array.isArray(data)) {
    return null;
  }

  const values: FeatureFlagValues = {};
  for (const row of data as FeatureFlagRow[]) {
    if (
      isFeatureFlagKey(row.key) &&
      typeof row.enabled === "boolean" &&
      isValidConfiguration(row.configuration)
    ) {
      values[row.key] = row.enabled;
    }
  }

  return values;
}

export async function getFeatureFlag(key: FeatureFlagKey): Promise<FeatureFlagState | null> {
  if (!isFeatureFlagKey(key)) {
    return null;
  }

  const values = await readFeatureFlagRows([key]);
  return {
    key,
    enabled: values?.[key] ?? FEATURE_FLAG_DEFAULTS[key],
  };
}

export async function isFeatureEnabled(key: FeatureFlagKey) {
  const flag = await getFeatureFlag(key);
  return flag?.enabled ?? false;
}

export async function getFeatureFlags(keys: readonly FeatureFlagKey[]): Promise<FeatureFlagValues> {
  const knownKeys = [...new Set(keys.filter(isFeatureFlagKey))];
  const values = await readFeatureFlagRows(knownKeys);

  return Object.fromEntries(
    knownKeys.map((key) => [key, values?.[key] ?? FEATURE_FLAG_DEFAULTS[key]]),
  ) as FeatureFlagValues;
}

export function getSystemFeatureFlags() {
  return getFeatureFlags(FEATURE_FLAG_KEYS);
}
