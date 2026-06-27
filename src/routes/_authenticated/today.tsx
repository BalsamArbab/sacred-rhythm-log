import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Minus, Check, BookOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NeuCard, NeuButton } from "@/components/neu";
import { AdhkarReader } from "@/components/adhkar-reader";
import { cn } from "@/lib/utils";
import {
  fetchHabits,
  fetchLogsForDate,
  fetchProfile,
  upsertLog,
  todayStr,
  habitCompletionPct,
  getCompletedIds,
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
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });

  const habits = habitsQ.data ?? [];
  const logs = logsQ.data ?? [];
  const goal = profileQ.data?.daily_goal_pct ?? 80;

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

  const goalProgress = Math.min(100, Math.round((overallPct / goal) * 100));

  return (
    <AppShell>
      <header className="mb-7">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dateLabel}
        </p>
        <h1 className="text-3xl font-semibold mt-1">As-salāmu ʿalaykum</h1>
      </header>

      <OverallRing pct={overallPct} goal={goal} goalProgress={goalProgress} count={habits.length} />

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

function OverallRing({
  pct,
  goal,
  goalProgress,
  count,
}: {
  pct: number;
  goal: number;
  goalProgress: number;
  count: number;
}) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const dash = c * (goalProgress / 100);
  const reached = pct >= goal;
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
          {reached
            ? `Daily goal of ${goal}% reached. Alhamdulillāh.`
            : `Goal ${goal}% · ${goalProgress}% of the way there.`}
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
  const [readerOpen, setReaderOpen] = useState(false);
  const mut = useMutation({
    mutationFn: upsertLog,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs", date] }),
  });

  const pct = habitCompletionPct(habit, log);
  const isAdhkar = habit.type === "counter" && habit.unit === "adhkar";

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
          {habit.type === "counter" && habit.target && !isAdhkar && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Target: {habit.target} {habit.unit}
            </p>
          )}
          {isAdhkar && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {log?.value_num ?? 0} of {habit.target ?? 0} completed
            </p>
          )}
        </div>
        <div className="text-xs font-semibold text-[color:var(--emerald)]">{pct}%</div>
      </div>

      {habit.type === "boolean" && (
        <PrayerFillButton
          checked={!!log?.completed_bool}
          label={habit.name}
          fullWidth
          onToggle={() =>
            mut.mutate({
              habit_id: habit.id,
              log_date: date,
              completed_bool: !log?.completed_bool,
            })
          }
        >
          {log?.completed_bool ? "Done" : "Mark complete"}
        </PrayerFillButton>
      )}

      {isAdhkar && (
        <>
          <NeuButton
            onClick={() => setReaderOpen(true)}
            className="w-full"
            variant="primary"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Open adhkar
          </NeuButton>
          <AdhkarReader
            habit={habit}
            log={log}
            date={date}
            open={readerOpen}
            onClose={() => setReaderOpen(false)}
          />
        </>
      )}

      {habit.type === "counter" && !isAdhkar && (
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
            const completedIds = getCompletedIds(log);
            const done = completedIds.includes(item.id);
            return (
              <div key={item.id} className="flex flex-col items-center gap-1.5">
                <PrayerFillButton
                  checked={done}
                  label={item.label}
                  onToggle={() => {
                    const next = done
                      ? completedIds.filter((id) => id !== item.id)
                      : [...completedIds, item.id];
                    mut.mutate({
                      habit_id: habit.id,
                      log_date: date,
                      completed_items: next,
                      completed_bool: next.length === habit.checklist.length,
                    });
                  }}
                />
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </NeuCard>
  );
}

/**
 * Prayer-style button: fills with the accent color when checked
 * (no checkmark icon), uses neumorphic raised state when unchecked.
 */
function PrayerFillButton({
  checked,
  label,
  onToggle,
  fullWidth = false,
  children,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  fullWidth?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={checked}
      aria-label={label}
      className={cn(
        "rounded-2xl flex items-center justify-center transition-all duration-200 select-none active:scale-[0.97]",
        fullWidth ? "h-16 w-full text-sm font-semibold" : "h-12 w-12",
        checked
          ? "bg-[color:var(--emerald)] text-primary-foreground neu-flat"
          : "neu-raised-sm text-muted-foreground",
      )}
    >
      {children ?? (checked ? <Check className="h-4 w-4 opacity-0" /> : null)}
    </button>
  );
}
