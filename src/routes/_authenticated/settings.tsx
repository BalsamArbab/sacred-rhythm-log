import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, LogOut, Sun, Moon, Monitor, Pencil, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NeuCard, NeuButton, NeuInset } from "@/components/neu";
import { Switch } from "@/components/ui/switch";
import {
  fetchHabits,
  createHabit,
  updateHabit,
  archiveHabit,
  fetchProfile,
  updateDailyGoal,
  fetchHabitTemplates,
  addHabitFromTemplate,
  type HabitWithItems,
  type HabitTemplate,
} from "@/lib/habits";
import { useTheme, type Theme } from "@/components/theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const habitsQ = useQuery({ queryKey: ["habits"], queryFn: fetchHabits });
  const templatesQ = useQuery({ queryKey: ["habit-templates"], queryFn: fetchHabitTemplates });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const goal = profileQ.data?.daily_goal_pct ?? 80;

  const addFromTemplate = useMutation({
    mutationFn: addHabitFromTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Added to your habits");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const goalMut = useMutation({
    mutationFn: updateDailyGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const [editingId, setEditingId] = useState<string | null>(null); // null = closed, "new" = creating, else habit id
  const [form, setForm] = useState({
    name: "",
    name_ar: "",
    type: "boolean" as "boolean" | "counter" | "checklist",
    unit: "",
    target: "",
    checklist: "",
  });
  const open = editingId !== null;

  function resetForm() {
    setForm({ name: "", name_ar: "", type: "boolean", unit: "", target: "", checklist: "" });
  }

  function startCreate() {
    if (open) {
      setEditingId(null);
      resetForm();
    } else {
      resetForm();
      setEditingId("new");
    }
  }

  function startEdit(h: HabitWithItems) {
    setForm({
      name: h.name,
      name_ar: h.name_ar ?? "",
      type: h.type,
      unit: h.unit ?? "",
      target: h.target ? String(h.target) : "",
      checklist: h.checklist.map((c) => c.label).join(", "),
    });
    setEditingId(h.id);
  }

  const create = useMutation({
    mutationFn: () =>
      createHabit({
        name: form.name,
        name_ar: form.name_ar || undefined,
        type: form.type,
        unit: form.unit || undefined,
        target: form.target ? Number(form.target) : undefined,
        checklist_labels:
          form.type === "checklist"
            ? form.checklist.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      setEditingId(null);
      resetForm();
      toast.success("Habit added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const update = useMutation({
    mutationFn: () =>
      updateHabit({
        id: editingId as string,
        name: form.name,
        name_ar: form.name_ar || undefined,
        unit: form.unit || undefined,
        target: form.target ? Number(form.target) : undefined,
        checklist_labels:
          form.type === "checklist"
            ? form.checklist.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      setEditingId(null);
      resetForm();
      toast.success("Habit updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const archive = useMutation({
    mutationFn: archiveHabit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit removed");
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <header className="mb-7">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Manage
        </p>
        <h1 className="text-3xl font-semibold mt-1">Settings</h1>
      </header>

      <section className="mb-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Appearance
        </h2>
        <ThemePicker />
      </section>

      <section className="mb-8 space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Daily goal
          </h2>
          <span className="text-sm font-semibold text-[color:var(--emerald)] tabular-nums">
            {goal}%
          </span>
        </div>
        <NeuCard className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            How much of your daily routine counts as a "good day." The Today ring
            fills up as you get closer to this threshold — at {goal}%, hitting{" "}
            {goal}% of your combined habit work fills the ring completely. Set it
            lower for a more forgiving target on busy days; set to 100% to require
            everything.
          </p>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={goal}
            onChange={(e) => goalMut.mutate(Number(e.target.value))}
            aria-label="Daily completion goal percentage"
            className="w-full accent-[color:var(--emerald)]"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>10%</span>
            <span>55%</span>
            <span>100%</span>
          </div>
        </NeuCard>
      </section>


      <section className="space-y-4">

        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Habits
          </h2>
          <NeuButton size="sm" variant="primary" onClick={startCreate}>
            {open ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {open ? "Cancel" : "Add"}
          </NeuButton>
        </div>

        {open && (
          <NeuCard className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {editingId === "new" ? "New habit" : "Edit habit"}
            </p>
            <Field label="Name">
              <NeuInset className="px-3 py-2">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-transparent outline-none text-sm"
                  placeholder="e.g. Tahajjud"
                />
              </NeuInset>
            </Field>
            <Field label="Arabic name (optional)">
              <NeuInset className="px-3 py-2">
                <input
                  value={form.name_ar}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                  className="w-full bg-transparent outline-none text-sm font-arabic text-right"
                  dir="rtl"
                  placeholder="التهجد"
                />
              </NeuInset>
            </Field>
            <Field label="Type">
              <div className="neu-pressed-sm rounded-2xl p-1 flex">
                {(["boolean", "counter", "checklist"] as const).map((t) => (
                  <button
                    key={t}
                    disabled={editingId !== "new"}
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex-1 py-2 text-xs rounded-xl capitalize transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      form.type === t
                        ? "neu-raised-sm text-[color:var(--emerald)] font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {editingId !== "new" && (
                <p className="text-[10px] text-muted-foreground px-1">
                  Habit type can't be changed after creation — delete and re-add instead.
                </p>
              )}
            </Field>
            {form.type === "counter" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit">
                  <div className="neu-pressed-sm rounded-2xl p-1 flex">
                    {(["pages", "verses", "minutes"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setForm({ ...form, unit: u })}
                        className={`flex-1 py-2 text-xs rounded-xl capitalize transition-all ${
                          form.unit === u
                            ? "neu-raised-sm text-[color:var(--emerald)] font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <NeuInset className="px-3 py-2 mt-1.5">
                    <input
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      className="w-full bg-transparent outline-none text-sm"
                      placeholder="or type a custom unit…"
                    />
                  </NeuInset>
                </Field>
                <Field label="Daily target">
                  <NeuInset className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={form.target}
                      onChange={(e) => setForm({ ...form, target: e.target.value })}
                      className="w-full bg-transparent outline-none text-sm"
                      placeholder="1"
                    />
                  </NeuInset>
                </Field>
              </div>
            )}
            {form.type === "checklist" && (
              <Field label="Items (comma-separated)">
                <NeuInset className="px-3 py-2">
                  <input
                    value={form.checklist}
                    onChange={(e) => setForm({ ...form, checklist: e.target.value })}
                    className="w-full bg-transparent outline-none text-sm"
                    placeholder="Fajr, Dhuhr, Asr…"
                  />
                </NeuInset>
              </Field>
            )}
            <NeuButton
              variant="primary"
              className="w-full"
              disabled={!form.name || create.isPending || update.isPending}
              onClick={() => (editingId === "new" ? create.mutate() : update.mutate())}
            >
              {editingId === "new" ? "Save habit" : "Save changes"}
            </NeuButton>
          </NeuCard>
        )}

        <div className="space-y-3">
          {(() => {
            const activeTemplateIds = new Set(
              (habitsQ.data ?? []).filter((h) => h.template_id).map((h) => h.template_id as string),
            );
            type Row =
              | { kind: "habit"; sort: number; habit: HabitWithItems }
              | { kind: "template"; sort: number; template: HabitTemplate };
            const rows: Row[] = [
              ...(habitsQ.data ?? []).map(
                (h): Row => ({ kind: "habit", sort: h.sort_order, habit: h }),
              ),
              ...(templatesQ.data ?? [])
                .filter((t) => !activeTemplateIds.has(t.id))
                .map((t): Row => ({ kind: "template", sort: t.sort_order, template: t })),
            ].sort((a, b) => a.sort - b.sort);

            if (!rows.length && !habitsQ.isLoading && !templatesQ.isLoading) {
              return (
                <NeuCard className="text-center text-sm text-muted-foreground">
                  No habits yet.
                </NeuCard>
              );
            }

            return rows.map((row) => {
              if (row.kind === "habit") {
                const h = row.habit;
                return (
                  <NeuCard key={`h-${h.id}`} className="flex items-center justify-between py-4">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3">
                        <div className="font-semibold">{h.name}</div>
                        {h.name_ar && (
                          <div className="font-arabic text-[color:var(--emerald)]">
                            {h.name_ar}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {h.type}
                        {h.type === "counter" && h.target ? ` · ${h.target} ${h.unit ?? ""}` : ""}
                        {h.type === "checklist" ? ` · ${h.checklist.length} items` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <NeuButton size="icon" onClick={() => startEdit(h)} aria-label={`Edit ${h.name}`}>
                        <Pencil className="h-4 w-4" />
                      </NeuButton>
                      <Switch
                        checked={true}
                        onCheckedChange={() => {
                          if (confirm(`Turn off "${h.name}"? Your past logs are kept.`)) {
                            archive.mutate(h.id);
                          }
                        }}
                        aria-label={`Disable ${h.name}`}
                      />
                    </div>

                  </NeuCard>
                );
              }
              const t = row.template;
              return (
                <NeuCard key={`t-${t.id}`} className="flex items-center justify-between py-4 opacity-70">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <div className="font-semibold">{t.name}</div>
                      {t.name_ar && (
                        <div className="font-arabic text-[color:var(--emerald)]">{t.name_ar}</div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {t.type}
                      {t.type === "counter" && t.target ? ` · ${t.target} ${t.unit ?? ""}` : ""}
                      {t.type === "checklist" ? ` · ${t.checklist_labels.length} items` : ""}
                      {" · not added"}
                    </div>
                  </div>
                  <Switch
                    checked={false}
                    disabled={addFromTemplate.isPending}
                    onCheckedChange={() => addFromTemplate.mutate(t)}
                    aria-label={`Add ${t.name}`}
                    className="shrink-0"
                  />
                </NeuCard>
              );
            });
          })()}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3">
          Account
        </h2>
        <NeuButton onClick={signOut} className="w-full">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </NeuButton>
      </section>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground px-1">{label}</label>
      {children}
    </div>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "system", label: "System", Icon: Monitor },
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
  ];
  return (
    <NeuCard className="p-2">
      <div className="neu-pressed-sm rounded-2xl p-1 flex">
        {options.map(({ value, label, Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                active
                  ? "neu-raised-sm text-[color:var(--emerald)] font-semibold"
                  : "text-muted-foreground"
              }`}
              aria-pressed={active}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </NeuCard>
  );
}
