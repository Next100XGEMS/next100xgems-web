import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { sha256 } from "@/lib/radar/hash";
import type { AnalyzerInput, AnalyzerResolution } from "./contracts";

let trustedClient: SupabaseClient | null | undefined;

function getTrustedClient(): SupabaseClient {
  if (trustedClient) return trustedClient;
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Trusted Analyzer resolution is not configured.");
  trustedClient = createSupabaseClient(url, secret, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return trustedClient;
}

export async function attestAnalyzerResolution(args: { deliveryKey: string; input: AnalyzerInput; resolution: AnalyzerResolution; providerResponse: unknown }) {
  const providerResponseFingerprint = sha256({ providerResponse: args.providerResponse });
  const { data, error } = await getTrustedClient().rpc("analyzer_attest_resolution", {
    p_delivery_key: args.deliveryKey,
    p_input: args.input,
    p_resolution: args.resolution,
    p_provider_response_fingerprint: providerResponseFingerprint,
    p_collector_version: "token-analyzer-live-collector-v2",
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data) || typeof (data as { id?: unknown }).id !== "string") throw new Error("Trusted Analyzer resolution could not be attested.");
  return data as { id: string; resolution: AnalyzerResolution };
}
