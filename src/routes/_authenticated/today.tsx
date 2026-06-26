import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NeuCard, NeuButton, NeuToggle } from "@/components/neu";
import {
  fetchHabits,
  fetchLogsForDate,
  upsertLog,
  todayStr,
  habitCompletionPct,
  type HabitWithItems,
  type HabitLog,
} from "@/lib/habits";

export const Route = createFileRoute("/_authenticated/today")({
  component: TodayPage,
});

function TodayPage() {
  const today = todayStr();
  const habitsQ = useQuery({ queryKey: ["habits"], queryFn: fetchHabits });
  const logsQ = useQuery({
    queryKey: ["logs", today],
    queryFn: () => fetchLogsForDate(today),
  });

  const habits = habitsQ.data ?? [];
  const logs = logsQ.data ?? [];

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const overallPct =
    habits.length === 0
      ? 0
      : Math.round(
          habits.reduce((sum, h) => {
            const log = logs.find((l) => l.habit_id === h.id);
            return sum + habitCompletionPct(h, log);
          }, 0) / habits.length,
        );

  return (
    <AppShell>
      <header className="mb-7">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dateLabel}
        </p>
        <h1 className="text-3xl font-semibold mt-1">As-salāmu ʿalaykum</h1>
      </header>

      <OverallRing pct={overallPct} count={habits.length} />

      <div className="mt-8 space-y-4">
        {habitsQ.isLoading && (
          <NeuCard className="text-center text-sm text-muted-foreground">
            Loading your habits…
          </NeuCard>
        )}
        {habits.map((h) => {
          const log = logs.find((l) => l.habit_id === h.id);
          return <HabitCard key={h.id} habit={h} log={log} date={today} />;
        })}
      </div>
    </AppShell>
  );
}

function OverallRing({ pct, count }: { pct: number; count: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  return (
    <NeuCard className="flex items-center gap-5">
      <div className="relative neu-pressed rounded-full p-3">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="var(--emerald-soft)"
            strokeWidth="10"
            opacity="0.5"
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="var(--emerald)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dasharray 400ms ease" }}
          />
          <text
            x="70"
            y="76"
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 26, fontWeight: 600 }}
          >
            {pct}%
          </text>
        </svg>
      </div>
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">Today</div>
        <div className="text-lg font-semibold">
          {count} {count === 1 ? "habit" : "habits"}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Small, consistent acts. May Allāh accept.
        </p>
      </div>
    </NeuCard>
  );
}

function HabitCard({
  habit,
  log,
  date,
}: {
  habit: HabitWithItems;
  log: HabitLog | undefined;
  date: string;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: upsertLog,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs", date] }),
  });

  const pct = habitCompletionPct(habit, log);

  return (
    <NeuCard className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <h3 className="text-base font-semibold">{habit.name}</h3>
            {habit.name_ar && (
              <span className="font-arabic text-lg text-[color:var(--emerald)]">
                {habit.name_ar}
              </span>
            )}
          </div>
          {habit.type === "counter" && habit.target && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Target: {habit.target} {habit.unit}
            </p>
          )}
        </div>
        <div className="text-xs font-semibold text-[color:var(--emerald)]">{pct}%</div>
      </div>

      {habit.type === "boolean" && (
        <NeuToggle
          label={habit.name}
          checked={!!log?.completed_bool}
          onToggle={() =>
            mut.mutate({
              habit_id: habit.id,
              log_date: date,
              completed_bool: !log?.completed_bool,
            })
          }
          className="h-16 w-full"
        >
          {log?.completed_bool ? (
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Check className="h-5 w-5" /> Done
            </span>
          ) : (
            <span className="text-sm">Mark complete</span>
          )}
        </NeuToggle>
      )}

      {habit.type === "counter" && (
        <div className="flex items-center justify-between gap-3">
          <NeuButton
            size="icon"
            onClick={() =>
              mut.mutate({
                habit_id: habit.id,
                log_date: date,
                value_num: Math.max(0, (log?.value_num ?? 0) - 1),
                completed_bool: Math.max(0, (log?.value_num ?? 0) - 1) >= (habit.target ?? 1),
              })
            }
          >
            <Minus className="h-5 w-5" />
          </NeuButton>
          <div className="neu-pressed rounded-2xl flex-1 py-4 text-center">
            <div className="text-3xl font-semibold tabular-nums">
              {log?.value_num ?? 0}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              {habit.unit ?? "count"}
            </div>
          </div>
          <NeuButton
            size="icon"
            onClick={() =>
              mut.mutate({
                habit_id: habit.id,
                log_date: date,
                value_num: (log?.value_num ?? 0) + 1,
                completed_bool: (log?.value_num ?? 0) + 1 >= (habit.target ?? 1),
              })
            }
          >
            <Plus className="h-5 w-5" />
          </NeuButton>
        </div>
      )}

      {habit.type === "checklist" && (
        <div className="grid grid-cols-5 gap-2">
          {habit.checklist.map((item) => {
            const done = log?.completed_items.includes(item.id) ?? false;
            return (
              <div key={item.id} className="flex flex-col items-center gap-1.5">
                <NeuToggle
                  label={item.label}
                  checked={done}
                  className="h-12 w-12"
                  onToggle={() => {
                    const current = log?.completed_items ?? [];
                    const next = done
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id];
                    mut.mutate({
                      habit_id: habit.id,
                      log_date: date,
                      completed_items: next,
                      completed_bool: next.length === habit.checklist.length,
                    });
                  }}
                >
                  {done && <Check className="h-4 w-4" />}
                </NeuToggle>
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </NeuCard>
  );
}
