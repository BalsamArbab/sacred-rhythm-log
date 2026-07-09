import { supabase } from "@/integrations/supabase/client";

export type AdhkarItem = {
  id: string;
  user_id: string;
  habit_id: string;
  sort_order: number;
  arabic: string;
  transliteration: string | null;
  translation: string | null;
  source: string | null;
  repeat_count: number;
};

export async function fetchAdhkarItems(habitId: string): Promise<AdhkarItem[]> {
  const { data, error } = await supabase
    .from("adhkar_items")
    .select("*")
    .eq("habit_id", habitId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as AdhkarItem[];
}

/**
 * Adhkar progress is stored in habit_logs.completed_items as a JSON object:
 *   { [adhkar_item_id]: number_of_times_recited }
 * An item is "complete" when its recited count >= repeat_count.
 * habit_logs.value_num mirrors the number of fully-completed items so the
 * existing counter UI / trends keep working.
 */
export type AdhkarProgress = Record<string, number>;

export function parseAdhkarProgress(raw: unknown): AdhkarProgress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AdhkarProgress = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.max(0, Math.floor(v));
  }
  return out;
}

export function countCompletedAdhkar(items: AdhkarItem[], progress: AdhkarProgress): number {
  return items.reduce((n, it) => n + ((progress[it.id] ?? 0) >= it.repeat_count ? 1 : 0), 0);
}
