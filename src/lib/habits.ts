import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export async function fetchProfile(): Promise<{ id: string; display_name: string | null; daily_goal_pct: number } | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, daily_goal_pct")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDailyGoal(pct: number) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const clamped = Math.max(1, Math.min(100, Math.round(pct)));
  const { error } = await supabase
    .from("profiles")
    .update({ daily_goal_pct: clamped })
    .eq("id", uid);
  if (error) throw error;
}

export type HabitCategory = "fard" | "sunnah";
export type HabitSubcategory = "prayer" | "dhikr" | "quran" | "fasting" | "character";
export type RecurrenceType = "daily" | "weekly" | "hijri_monthly" | "hijri_annual";
export type MenstruationBehavior = "always_pause" | "never_pause" | "depends_on_madhab";

export type RecurrenceData = {
  weekdays?: number[]; // ISO weekday: Monday=1 ... Sunday=7
  hijri_days?: number[];
  hijri_month?: number;
};

export type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  name_ar: string | null;
  type: "boolean" | "counter" | "checklist";
  unit: string | null;
  target: number | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  template_id: string | null;
  category: HabitCategory | null;
  subcategory: HabitSubcategory | null;
  recurrence_type: RecurrenceType;
  recurrence_data: RecurrenceData;
  menstruation_behavior: MenstruationBehavior | null;
};

export type HabitTemplate = {
  id: string;
  key: string;
  name: string;
  name_ar: string | null;
  category: HabitCategory;
  subcategory: HabitSubcategory;
  type: "boolean" | "counter" | "checklist";
  unit: string | null;
  target: number | null;
  recurrence_type: RecurrenceType;
  recurrence_data: RecurrenceData;
  menstruation_behavior: MenstruationBehavior;
  description: string | null;
  source_url: string | null;
  sort_order: number;
  is_default: boolean;
  checklist_labels: string[];
};

export type ChecklistItem = {
  id: string;
  habit_id: string;
  label: string;
  sort_order: number;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  value_num: number;
  /** jsonb — either string[] (checklist) or Record<string, number> (adhkar progress) */
  completed_items: unknown;
  completed_bool: boolean;
};

export type HabitWithItems = HabitRow & { checklist: ChecklistItem[] };

export function getCompletedIds(log: HabitLog | undefined): string[] {
  if (!log) return [];
  return Array.isArray(log.completed_items) ? (log.completed_items as string[]) : [];
}

export function todayStr(d = new Date()): string {
  // local YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchHabits(): Promise<HabitWithItems[]> {
  const { data: habits, error } = await supabase
    .from("habits")
    .select("*")
    .is("archived_at", null)
    .order("sort_order");
  if (error) throw error;
  const { data: items, error: e2 } = await supabase
    .from("habit_checklist_items")
    .select("*")
    .order("sort_order");
  if (e2) throw e2;
  return (habits ?? []).map((h) => ({
    ...(h as HabitRow),
    checklist: (items ?? []).filter((i) => i.habit_id === h.id) as ChecklistItem[],
  }));
}

export async function fetchLogsForDate(date: string): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("log_date", date);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as unknown as HabitLog),
    completed_items: (r as { completed_items: unknown }).completed_items ?? [],
  }));
}

export async function fetchLogsRange(startDate: string, endDate: string): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .gte("log_date", startDate)
    .lte("log_date", endDate);
  if (error) throw error;
  return (data ?? []) as unknown as HabitLog[];
}

export async function upsertLog(input: {
  habit_id: string;
  log_date: string;
  value_num?: number;
  completed_items?: string[];
  completed_bool?: boolean;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");
  type Insert = Database["public"]["Tables"]["habit_logs"]["Insert"];
  const row: Insert = {
    habit_id: input.habit_id,
    user_id: uid,
    log_date: input.log_date,
    value_num: input.value_num ?? 0,
    completed_items: (input.completed_items ?? []) as unknown as Database["public"]["Tables"]["habit_logs"]["Insert"]["completed_items"],
    completed_bool: input.completed_bool ?? false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("habit_logs")
    .upsert(row, { onConflict: "habit_id,log_date" });
  if (error) throw error;
}

export async function createHabit(input: {
  name: string;
  name_ar?: string;
  type: "boolean" | "counter" | "checklist";
  unit?: string;
  target?: number;
  checklist_labels?: string[];
}) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: maxRow } = await supabase
    .from("habits")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  const { data: habit, error } = await supabase
    .from("habits")
    .insert({
      user_id: uid,
      name: input.name,
      name_ar: input.name_ar || null,
      type: input.type,
      unit: input.unit || null,
      target: input.target ?? null,
      sort_order: nextSort,
    })
    .select()
    .single();
  if (error) throw error;
  if (input.type === "checklist" && input.checklist_labels?.length) {
    const items = input.checklist_labels.map((label, i) => ({
      habit_id: habit.id,
      label,
      sort_order: i,
    }));
    const { error: e2 } = await supabase.from("habit_checklist_items").insert(items);
    if (e2) throw e2;
  }
  return habit;
}

export async function archiveHabit(id: string) {
  const { error } = await supabase
    .from("habits")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function updateHabit(input: {
  id: string;
  name: string;
  name_ar?: string;
  unit?: string;
  target?: number;
  checklist_labels?: string[];
}) {
  const { error } = await supabase
    .from("habits")
    .update({
      name: input.name,
      name_ar: input.name_ar || null,
      unit: input.unit || null,
      target: input.target ?? null,
    })
    .eq("id", input.id);
  if (error) throw error;

  if (input.checklist_labels) {
    const { error: delErr } = await supabase
      .from("habit_checklist_items")
      .delete()
      .eq("habit_id", input.id);
    if (delErr) throw delErr;
    if (input.checklist_labels.length) {
      const items = input.checklist_labels.map((label, i) => ({
        habit_id: input.id,
        label,
        sort_order: i,
      }));
      const { error: insErr } = await supabase.from("habit_checklist_items").insert(items);
      if (insErr) throw insErr;
    }
  }
}

export async function fetchHabitTemplates(): Promise<HabitTemplate[]> {
  const { data, error } = await supabase
    .from("habit_templates")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...t,
    recurrence_data: (t.recurrence_data ?? {}) as RecurrenceData,
    checklist_labels: (t.checklist_labels ?? []) as unknown as string[],
  })) as HabitTemplate[];
}

/** Adds a habit to the current user's list from a catalog template. */
export async function addHabitFromTemplate(template: HabitTemplate) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: habit, error } = await supabase
    .from("habits")
    .insert({
      user_id: uid,
      template_id: template.id,
      name: template.name,
      name_ar: template.name_ar,
      type: template.type,
      unit: template.unit,
      target: template.target,
      category: template.category,
      subcategory: template.subcategory,
      recurrence_type: template.recurrence_type,
      recurrence_data: template.recurrence_data as unknown as Database["public"]["Tables"]["habits"]["Insert"]["recurrence_data"],
      menstruation_behavior: template.menstruation_behavior,
      // Use the catalog's own ordering rather than "end of list" — keeps the
      // habit in its intended place (e.g. all Prayer-subcategory items
      // together) no matter what order the user toggled things on.
      sort_order: template.sort_order,
    })
    .select()
    .single();
  if (error) throw error;

  if (template.type === "checklist" && template.checklist_labels.length) {
    const items = template.checklist_labels.map((label, i) => ({
      habit_id: habit.id,
      label,
      sort_order: i,
    }));
    const { error: e2 } = await supabase.from("habit_checklist_items").insert(items);
    if (e2) throw e2;
  }
  return habit;
}

export function habitCompletionPct(habit: HabitWithItems, log: HabitLog | undefined): number {
  if (!log) return 0;
  if (habit.type === "boolean") return log.completed_bool ? 100 : 0;
  if (habit.type === "counter") {
    const target = habit.target ?? 1;
    if (target <= 0) return log.value_num > 0 ? 100 : 0;
    return Math.min(100, Math.round((log.value_num / target) * 100));
  }
  // checklist
  const total = habit.checklist.length || 1;
  return Math.round((getCompletedIds(log).length / total) * 100);
}
