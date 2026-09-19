import "server-only";

import { createClient } from "@/lib/supabase/server";
import { mapPublicRadarRow, type PublicRadarFeed, type PublicRadarRecord } from "@/lib/radar/public-contract";
export type { PublicRadarFeed, PublicRadarRecord } from "@/lib/radar/public-contract";

export async function getPublicRadarList(): Promise<PublicRadarFeed> {
  try { const supabase = await createClient(); const { data, error } = await supabase.rpc("get_public_radar_list", { p_limit: 20, p_before: null }); if (error || !Array.isArray(data)) return { state: "UNAVAILABLE", records: [] }; const records = data.map(mapPublicRadarRow).filter((record): record is PublicRadarRecord => record !== null); return { state: records.length ? "READY" : "EMPTY", records }; } catch { return { state: "UNAVAILABLE", records: [] }; }
}

export async function getPublicRadarDetail(tokenId: string): Promise<PublicRadarRecord | null> {
  try { const supabase = await createClient(); const { data, error } = await supabase.rpc("get_public_radar_detail", { p_token_id: tokenId }); if (error || !Array.isArray(data)) return null; return mapPublicRadarRow(data[0]); } catch { return null; }
}
