import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Minus, Check, BookOpen, ChevronDown, ChevronUp, PenLine } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NeuCard, NeuButton } from "@/components/neu";
import { AdhkarReader } from "@/components/adhkar-reader";
import { QuranReader } from "@/components/quran-reader";
import { PrayerBubble } from "@/components/prayer-bubble";
import { isQuranHabit, getLockedSequence, hasFixedReader } from "@/lib/quran";
import { fetchDailyDuas, pickDailyDua } from "@/lib/duas";
import { formatHijriDate } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import {
  fetchHabits,
  fetchLogsForDate,
  fetchProfile,
  fetchActiveCycle,
  upsertLog,
  todayStr,
  habitCompletionPct,
  displayHabitName,
  effectiveItemState,
  getItemState,
  withItemState,
  effectiveBooleanState,
  getBooleanState,
  nextPrayerState,
  prayerStateCounts,
  type HabitWithItems,
  type HabitLog,
} from "@/lib/habits";
import { isHabitDueOn } from "@/lib/recurrence";

export const Route = createFileRoute("/_authenticated/today")({
  component: TodayPage,
});

function TodayPage() {
  const today = todayStr();
  const now = new Date();
  const habitsQ = useQuery({ queryKey: ["habits"], queryFn: fetchHabits });
  const logsQ = useQuery({
    queryKey: ["logs", today],
    queryFn: () => fetchLogsForDate(today),
  });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const tracksMenstruation = !!profileQ.data?.tracks_menstruation;
  const cycleQ = useQuery({
    queryKey: ["active-cycle", today],
    queryFn: () => fetchActiveCycle(today),
    enabled: tracksMenstruation,
  });
  // Whether today qualifies for the menstruation "paused" prayer state at
  // all. Still gated per-habit by menstruation_behavior === "always_pause".
  const pauseEligible = tracksMenstruation && !!cycleQ.data;

  const habits = (habitsQ.data ?? []).filter((h) =>
    isHabitDueOn(h.recurrence_type ?? "daily", h.recurrence_data, now),
  );
  const logs = logsQ.data ?? [];

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hijriLabel = formatHijriDate(now);

  return (
    <AppShell>
      <header className="mb-5 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">As-salāmu ʿalaykum</h1>
        <div className="text-right shrink-0 pt-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{dateLabel}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{hijriLabel}</p>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        {habitsQ.isLoading && (
          <NeuCard className="text-center text-sm text-muted-foreground">
            Loading your habits…
          </NeuCard>
        )}
        {habits.map((h) => {
          const log = logs.find((l) => l.habit_id === h.id);
          return (
            <HabitCard
              key={h.id}
              habit={h}
              log={log}
              date={today}
              today={now}
              pauseEligible={pauseEligible}
            />
          );
        })}
      </div>

      <div className="mt-6">
        <DailyDuaCard />
      </div>
    </AppShell>
  );
}

function DailyDuaCard() {
  const duasQ = useQuery({
    queryKey: ["daily-duas"],
    queryFn: fetchDailyDuas,
    staleTime: 1000 * 60 * 60,
  });

  if (duasQ.isLoading) {
    return (
      <NeuCard className="mb-5 text-center text-sm text-muted-foreground">
        Loading today's dua…
      </NeuCard>
    );
  }

  const dua = duasQ.data ? pickDailyDua(duasQ.data, new Date()) : null;
  if (!dua) return null;

  return (
    <NeuCard className="mb-5 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Dua of the day · {dua.category}
      </div>
      <p dir="rtl" lang="ar" className="font-arabic text-xl leading-[2] text-foreground text-right">
        {dua.arabic}
      </p>
      {dua.translation && (
        <p className="text-sm text-foreground/80 leading-relaxed">{dua.translation}</p>
      )}
      {dua.source && <p className="text-[11px] text-muted-foreground">{dua.source}</p>}
    </NeuCard>
  );
}

function HabitCard({
  habit,
  log,
  date,
  today,
  pauseEligible,
}: {
  habit: HabitWithItems;
  log: HabitLog | undefined;
  date: string;
  today: Date;
  pauseEligible: boolean;
}) {
  const qc = useQueryClient();
  const [readerOpen, setReaderOpen] = useState(false);
  const [quranOpen, setQuranOpen] = useState(false);
  const mut = useMutation({
    mutationFn: upsertLog,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs", date] }),
  });

  const pct = habitCompletionPct(habit, log);
  const isAdhkar = habit.type === "counter" && habit.unit === "adhkar";
  const isQuran = isQuranHabit(habit);
  const fixedReader = hasFixedReader(habit) ? getLockedSequence(habit) : null;
  const displayName = displayHabitName(habit, today);
  // Only prayer-subcategory habits ever offer the "paused" state, and only
  // when a period is actually active today — see the migration backfilling
  // menstruation_behavior = 'always_pause' on Prayer, Sunnah Rawatib, Witr,
  // Tahajjud, and Duha.
  const canPause = habit.menstruation_behavior === "always_pause" && pauseEligible;
  const isPrayerHabit = habit.subcategory === "prayer";

  return (
    <NeuCard className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <h3 className="text-base font-semibold">{displayName}</h3>
            {habit.name_ar && (
              <span className="font-arabic text-lg text-[color:var(--emerald)]">
                {habit.name_ar}
              </span>
            )}
          </div>
          {habit.type === "counter" && habit.target && !isAdhkar && !isQuran && (
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
        <>
          {fixedReader && (
            <NeuButton onClick={() => setQuranOpen(true)} className="w-full" variant="primary">
              <BookOpen className="h-4 w-4 mr-2" />
              Read {displayName}
            </NeuButton>
          )}
          {isPrayerHabit ? (
            <PrayerBubble
              fullWidth
              label={displayName}
              state={effectiveBooleanState(log, canPause)}
              onCycle={() => {
                const next = nextPrayerState(getBooleanState(log), canPause);
                mut.mutate({
                  habit_id: habit.id,
                  log_date: date,
                  value_num: next,
                  completed_bool: prayerStateCounts(next),
                });
              }}
            />
          ) : (
            <PrayerFillButton
              checked={!!log?.completed_bool}
              label={displayName}
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
          {fixedReader && (
            <QuranReader
              habit={habit}
              log={log}
              date={date}
              open={quranOpen}
              onClose={() => setQuranOpen(false)}
              lockedSequence={fixedReader}
            />
          )}
        </>
      )}

      {isAdhkar && (
        <>
          <NeuButton onClick={() => setReaderOpen(true)} className="w-full" variant="primary">
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

      {isQuran && <QuranHabitControl habit={habit} log={log} date={date} mut={mut} />}

      {habit.type === "counter" && !isAdhkar && !isQuran && (
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
            <div className="text-3xl font-semibold tabular-nums">{log?.value_num ?? 0}</div>
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
          {habit.checklist.map((item) => (
            <div key={item.id} className="flex flex-col items-center gap-1.5">
              <PrayerBubble
                label={item.label}
                state={effectiveItemState(log, item.id, canPause)}
                onCycle={() => {
                  const next = nextPrayerState(getItemState(log, item.id), canPause);
                  const items = withItemState(log, item.id, next);
                  mut.mutate({
                    habit_id: habit.id,
                    log_date: date,
                    completed_items: items,
                    completed_bool: Object.keys(items).length === habit.checklist.length,
                  });
                }}
              />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </NeuCard>
  );
}

function QuranHabitControl({
  habit,
  log,
  date,
  mut,
}: {
  habit: HabitWithItems;
  log: HabitLog | undefined;
  date: string;
  mut: { mutate: (input: Parameters<typeof upsertLog>[0]) => void };
}) {
  const [expanded, setExpanded] = useState(false);
  const [quranOpen, setQuranOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const unit = habit.unit ?? "pages";
  const value = log?.value_num ?? 0;

  function submitExternalLog() {
    const n = Math.max(0, Math.round(Number(amount)));
    if (!n) return;
    mut.mutate({
      habit_id: habit.id,
      log_date: date,
      value_num: value + n,
      completed_bool: value + n >= (habit.target ?? 1),
    });
    setAmount("");
    setLogOpen(false);
    setExpanded(false);
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 neu-raised-sm rounded-2xl px-4 py-3"
      >
        <div className="text-left">
          <div className="text-sm font-semibold">Qur'ān</div>
          <div className="text-xs text-muted-foreground">
            {value}
            {habit.target ? ` / ${habit.target}` : ""} {unit} today
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <NeuButton onClick={() => setQuranOpen(true)} className="w-full" variant="primary">
            <BookOpen className="h-4 w-4 mr-2" />
            Continue reading
          </NeuButton>
          <NeuButton onClick={() => setLogOpen((v) => !v)} className="w-full">
            <PenLine className="h-4 w-4 mr-2" />
            Log outside the app
          </NeuButton>

          {logOpen && (
            <div className="flex items-center gap-2 neu-pressed rounded-2xl p-2">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${unit} read`}
                className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              <NeuButton size="sm" variant="primary" onClick={submitExternalLog}>
                Add
              </NeuButton>
            </div>
          )}
        </div>
      )}

      <QuranReader
        habit={habit}
        log={log}
        date={date}
        open={quranOpen}
        onClose={() => setQuranOpen(false)}
      />
    </div>
  );
}

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
