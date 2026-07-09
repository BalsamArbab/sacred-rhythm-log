import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus as MinusIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NeuCard } from "@/components/neu";
import {
  fetchHabits,
  fetchLogsRange,
  habitCompletionPct,
  todayStr,
  type HabitWithItems,
  type HabitLog,
} from "@/lib/habits";

export const Route = createFileRoute("/_authenticated/trends")({
  component: TrendsPage,
});

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function TrendsPage() {
  const today = new Date();
  const start = addDays(today, -83); // 12 weeks
  const startStr = todayStr(start);
  const endStr = todayStr(today);

  const habitsQ = useQuery({ queryKey: ["habits"], queryFn: fetchHabits });
  const logsQ = useQuery({
    queryKey: ["logs-range", startStr, endStr],
    queryFn: () => fetchLogsRange(startStr, endStr),
  });

  const habits = habitsQ.data ?? [];
  const logs = logsQ.data ?? [];

  return (
    <AppShell>
      <header className="mb-7">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last 12 weeks</p>
        <h1 className="text-3xl font-semibold mt-1">Trends</h1>
      </header>

      <div className="space-y-5">
        {habits.map((h) => (
          <HabitTrend key={h.id} habit={h} logs={logs.filter((l) => l.habit_id === h.id)} />
        ))}
        {habits.length === 0 && !habitsQ.isLoading && (
          <NeuCard className="text-center text-sm text-muted-foreground">
            Add a habit in Settings to start seeing trends.
          </NeuCard>
        )}
      </div>
    </AppShell>
  );
}

function buildDailyPct(habit: HabitWithItems, logs: HabitLog[], days: number) {
  const today = new Date();
  const map = new Map(logs.map((l) => [l.log_date, l]));
  const result: { date: string; pct: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = todayStr(d);
    result.push({ date: key, pct: habitCompletionPct(habit, map.get(key)) });
  }
  return result;
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function HabitTrend({ habit, logs }: { habit: HabitWithItems; logs: HabitLog[] }) {
  const daily = buildDailyPct(habit, logs, 84);

  // streak: count back from today while pct > 0
  let current = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].pct > 0) current++;
    else break;
  }
  let best = 0;
  let run = 0;
  for (const d of daily) {
    if (d.pct > 0) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  const last7 = daily.slice(-7).map((d) => d.pct);
  const prev7 = daily.slice(-14, -7).map((d) => d.pct);
  const last30 = daily.slice(-30).map((d) => d.pct);
  const prev30 = daily.slice(-60, -30).map((d) => d.pct);
  const wow = Math.round(avg(last7) - avg(prev7));
  const mom = Math.round(avg(last30) - avg(prev30));

  return (
    <NeuCard className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <h3 className="text-base font-semibold">{habit.name}</h3>
            {habit.name_ar && (
              <span className="font-arabic text-base text-[color:var(--emerald)]">
                {habit.name_ar}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {Math.round(avg(last30))}% completion · last 30 days
          </p>
        </div>
      </div>

      <Heatmap daily={daily} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Streak" value={`${current}d`} hint={`best ${best}d`} />
        <Delta label="WoW" value={wow} />
        <Delta label="MoM" value={mom} />
      </div>
    </NeuCard>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="neu-pressed-sm rounded-2xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Delta({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  const negative = value < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : MinusIcon;
  const color = positive
    ? "text-[color:var(--emerald)]"
    : negative
      ? "text-muted-foreground"
      : "text-muted-foreground";
  return (
    <div className="neu-pressed-sm rounded-2xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 inline-flex items-center gap-1 ${color}`}>
        <Icon className="h-4 w-4" />
        {positive && "+"}
        {value}%
      </div>
    </div>
  );
}

function Heatmap({ daily }: { daily: { date: string; pct: number }[] }) {
  // 12 cols (weeks) x 7 rows (days, Sun..Sat). Pad start to align weeks.
  const first = new Date(daily[0].date);
  const padStart = first.getDay(); // 0 Sun
  const padded: ({ pct: number } | null)[] = [
    ...Array(padStart).fill(null),
    ...daily.map((d) => ({ pct: d.pct })),
  ];
  const cols: ({ pct: number } | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    cols.push(padded.slice(i, i + 7));
  }
  return (
    <div className="neu-pressed rounded-2xl p-3 overflow-x-auto">
      <div className="flex gap-1.5">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1.5">
            {Array.from({ length: 7 }).map((_, ri) => {
              const cell = col[ri];
              const pct = cell?.pct ?? 0;
              const op = pct === 0 ? 0.12 : pct < 34 ? 0.35 : pct < 67 ? 0.6 : pct < 100 ? 0.8 : 1;
              return (
                <div
                  key={ri}
                  className="h-3 w-3 rounded-[4px]"
                  style={{
                    background:
                      cell == null
                        ? "transparent"
                        : `color-mix(in oklab, var(--emerald) ${op * 100}%, var(--background))`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
