import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Minus, Check, BookOpen, ChevronDown, ChevronUp, PenLine } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NeuCard, NeuButton } from "@/components/neu";
import { AdhkarReader } from "@/components/adhkar-reader";
import { QuranReader } from "@/components/quran-reader";
import { isQuranHabit, getLockedSequence, hasFixedReader } from "@/lib/quran";
import { fetchDailyDuas, pickDailyDua } from "@/lib/duas";
import { formatHijriDate } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import {
  fetchHabits,
  fetchLogsForDate,
  upsertLog,
  todayStr,
  habitCompletionPct,
  getCompletedIds,
  displayHabitName,
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

  let completedCount = 0;
  const overallPct =
    habits.length === 0
      ? 0
      : Math.round(
          habits.reduce((sum, h) => {
            const log = logs.find((l) => l.habit_id === h.id);
            const pct = habitCompletionPct(h, log);
            if (pct >= 100) completedCount += 1;
            return sum + pct;
          }, 0) / habits.length,
        );

  return (
    <AppShell>
      <header className="mb-5 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">As-salāmu ʿalaykum</h1>
        <div className="text-right shrink-0 pt-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{dateLabel}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{hijriLabel}</p>
        </div>
      </header>

      <DailyDuaCard />

      <TodayProgressRow pct={overallPct} completed={completedCount} total={habits.length} />

      <div className="mt-6 space-y-4">
        {habitsQ.isLoading && (
          <NeuCard className="text-center text-sm text-muted-foreground">
            Loading your habits…
          </NeuCard>
        )}
        {habits.map((h) => {
          const log = logs.find((l) => l.habit_id === h.id);
          return <HabitCard key={h.id} habit={h} log={log} date={today} today={now} />;
        })}
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

function TodayProgressRow({
  pct,
  completed,
  total,
}: {
  pct: number;
  completed: number;
  total: number;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  return (
    <NeuCard className="flex items-center gap-4 py-4">
      <div className="relative neu-pressed rounded-full p-1.5 shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="var(--emerald-soft)"
            strokeWidth="6"
            opacity="0.5"
          />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="var(--emerald)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform="rotate(-90 32 32)"
            style={{ transition: "stroke-dasharray 400ms ease" }}
          />
          <text
            x="32"
            y="30"
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 13, fontWeight: 700 }}
          >
            {pct}%
          </text>
          <text
            x="32"
            y="41"
            textAnchor="middle"
            style={{ fontSize: 8.5, fontWeight: 500, fill: "var(--muted-foreground)" }}
          >
            {completed} of {total}
          </text>
        </svg>
      </div>
      <div className="text-sm font-medium text-muted-foreground">habits done today</div>
    </NeuCard>
  );
}

function HabitCard({
  habit,
  log,
  date,
  today,
}: {
  habit: HabitWithItems;
  log: HabitLog | undefined;
  date: string;
  today: Date;
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
 * Collapsed Qur'an habit row: tap to reveal two options — open the actual
 * reader (which tracks pages/verses/minutes itself as you read), or log
 * something you read outside the app. No standalone +/- stepper anymore,
 * since that duplicated exactly what the reader already tracks.
 */
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
