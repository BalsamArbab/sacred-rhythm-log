import { supabase } from "@/integrations/supabase/client";

/**
 * "Dua of the day" data layer.
 *
 * Source text: Hisn al-Muslim ("Fortress of the Muslim") by Sa'id bin Ali
 * bin Wahf Al-Qahtani — the same widely-used reference collection the
 * morning/evening adhkar in this app are drawn from. `daily_duas` is a
 * read-only reference table (like habit_templates) seeded via migration;
 * it currently holds a curated first batch spanning ~10 chapters of the
 * book (waking, sleeping, ablution, home, mosque, athan, dressing, prayer).
 * More chapters can be added later with the same INSERT shape.
 */

export type DailyDua = {
  id: string;
  category: string;
  arabic: string;
  transliteration: string | null;
  translation: string | null;
  source: string | null;
  sort_order: number;
};

export async function fetchDailyDuas(): Promise<DailyDua[]> {
  const { data, error } = await supabase.from("daily_duas").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as DailyDua[];
}

/**
 * Deterministic "dua of the day": everyone sees the same dua on the same
 * calendar date, and the pool is cycled through in order before repeating,
 * rather than picked at random (so it doesn't feel repetitive within a
 * cycle or skip entries).
 */
export function pickDailyDua(duas: DailyDua[], date: Date): DailyDua | null {
  if (duas.length === 0) return null;
  const epoch = Date.UTC(2026, 0, 1);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceEpoch = Math.floor((today - epoch) / 86400000);
  const idx = ((daysSinceEpoch % duas.length) + duas.length) % duas.length;
  return duas[idx];
}
