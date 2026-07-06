import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Minus, Check, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { NeuButton } from "@/components/neu";
import {
  fetchAdhkarItems,
  parseAdhkarProgress,
  countCompletedAdhkar,
  type AdhkarItem,
  type AdhkarProgress,
} from "@/lib/adhkar";
import { upsertLog, type HabitLog, type HabitWithItems } from "@/lib/habits";
import { cn } from "@/lib/utils";

export function AdhkarReader({
  habit,
  log,
  date,
  open,
  onClose,
}: {
  habit: HabitWithItems;
  log: HabitLog | undefined;
  date: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const itemsQ = useQuery({
    queryKey: ["adhkar-items", habit.id],
    queryFn: () => fetchAdhkarItems(habit.id),
    enabled: open,
  });

  const items = itemsQ.data ?? [];
  const progress: AdhkarProgress = parseAdhkarProgress(log?.completed_items as unknown);

  const mut = useMutation({
    mutationFn: (next: AdhkarProgress) => {
      const completed = countCompletedAdhkar(items, next);
      return upsertLog({
        habit_id: habit.id,
        log_date: date,
        value_num: completed,
        completed_items: next as unknown as string[], // jsonb accepts object
        completed_bool: items.length > 0 && completed >= items.length,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs", date] }),
  });

  // Which card is currently front-and-center. Starts at the first not-yet-done item.
  const [index, setIndex] = useState(0);

  const firstUnfinished = useMemo(() => {
    const i = items.findIndex((it) => (progress[it.id] ?? 0) < it.repeat_count);
    return i === -1 ? Math.max(0, items.length - 1) : i;
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to the right starting card whenever the reader is (re)opened or items load.
  useEffect(() => {
    if (open) setIndex(firstUnfinished);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const completed = countCompletedAdhkar(items, progress);
  const total = items.length || 1;
  const pct = Math.round((completed / total) * 100);
  const allDone = items.length > 0 && completed >= items.length;

  function bump(itemId: string, delta: number, max: number) {
    const cur = progress[itemId] ?? 0;
    const nextVal = Math.max(0, Math.min(max, cur + delta));
    const wasComplete = cur >= max;
    const next = { ...progress, [itemId]: nextVal };
    mut.mutate(next);

    // Auto-advance to the next card the moment this one is completed
    if (delta > 0 && !wasComplete && nextVal >= max) {
      setTimeout(() => {
        setIndex((i) => Math.min(items.length - 1, i + 1));
      }, 280);
    }
  }

  function reset() {
    mut.mutate({});
    setIndex(0);
  }

  const current = items[index];

  return (
    <div
      className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl neu-raised flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-border/60">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Adhkar reader
            </div>
            <h2 className="text-lg font-semibold mt-0.5">{habit.name}</h2>
            {habit.name_ar && (
              <div className="font-arabic text-base text-[color:var(--emerald)]">
                {habit.name_ar}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="neu-raised-sm rounded-full h-9 w-9 flex items-center justify-center text-muted-foreground active:neu-pressed-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 py-3 flex items-center gap-3 border-b border-border/60">
          <div className="flex-1 neu-pressed-sm h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[color:var(--emerald)] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs font-semibold tabular-nums">
            {completed}/{items.length}
          </div>
        </div>

        {/* Card stack */}
        <div className="flex-1 overflow-hidden px-4 py-5 flex flex-col">
          {itemsQ.isLoading && (
            <div className="text-center text-sm text-muted-foreground py-10">Loading adhkar…</div>
          )}
          {!itemsQ.isLoading && items.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              No adhkar yet for this habit.
            </div>
          )}

          {!itemsQ.isLoading && items.length > 0 && (
            <>
              {allDone ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10">
                  <div className="h-14 w-14 rounded-full bg-[color:var(--emerald)] text-primary-foreground flex items-center justify-center">
                    <Check className="h-7 w-7" />
                  </div>
                  <p className="font-semibold">All done for today</p>
                  <p className="text-xs text-muted-foreground">
                    {items.length} of {items.length} completed. Alhamdulillāh.
                  </p>
                </div>
              ) : (
                <div className="relative flex-1 min-h-[280px]">
                  {/* Peek cards behind the active one, for the "stack" feel */}
                  {items[index + 2] && (
                    <div className="absolute inset-x-4 top-4 bottom-0 rounded-3xl neu-flat opacity-40 scale-[0.93]" />
                  )}
                  {items[index + 1] && (
                    <div className="absolute inset-x-2 top-2 bottom-0 rounded-3xl neu-flat opacity-70 scale-[0.97]" />
                  )}
                  <AdhkarCard
                    key={current.id}
                    item={current}
                    index={index}
                    total={items.length}
                    count={progress[current.id] ?? 0}
                    onBump={(d) => bump(current.id, d, current.repeat_count)}
                  />
                </div>
              )}

              {/* Manual navigation */}
              <div className="flex items-center justify-between gap-3 mt-4">
                <NeuButton
                  size="icon"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  aria-label="Previous dhikr"
                >
                  <ChevronLeft className="h-4 w-4" />
                </NeuButton>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {Math.min(index + 1, items.length)} of {items.length}
                </div>
                <NeuButton
                  size="icon"
                  onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
                  disabled={index >= items.length - 1}
                  aria-label="Next dhikr"
                >
                  <ChevronRight className="h-4 w-4" />
                </NeuButton>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/60 flex items-center gap-3">
          <NeuButton size="sm" onClick={reset} className="text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset day
          </NeuButton>
          <div className="flex-1" />
          <NeuButton variant="primary" size="sm" onClick={onClose}>
            Done
          </NeuButton>
        </div>
      </div>
    </div>
  );
}

function AdhkarCard({
  item,
  index,
  total,
  count,
  onBump,
}: {
  item: AdhkarItem;
  index: number;
  total: number;
  count: number;
  onBump: (delta: number) => void;
}) {
  const done = count >= item.repeat_count;
  return (
    <div
      className={cn(
        "relative h-full neu-raised rounded-3xl p-5 flex flex-col gap-3 transition-all duration-200",
        "animate-in fade-in slide-in-from-right-4",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {index + 1} of {total}
          {item.source ? ` · ${item.source}` : ""}
        </div>
        {done && (
          <span className="text-[color:var(--emerald)] flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest">
            <Check className="h-3 w-3" /> Done
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        <p dir="rtl" lang="ar" className="font-arabic text-2xl leading-[2.1] text-foreground">
          {item.arabic}
        </p>

        {item.transliteration && (
          <p className="text-xs italic text-muted-foreground leading-relaxed">
            {item.transliteration}
          </p>
        )}
        {item.translation && (
          <p className="text-sm text-foreground/80 leading-relaxed">{item.translation}</p>
        )}
      </div>

      {/* Counter */}
      <div className="flex items-center gap-3 pt-1">
        <NeuButton
          size="icon"
          onClick={() => onBump(-1)}
          disabled={count <= 0}
          aria-label="Decrease count"
        >
          <Minus className="h-4 w-4" />
        </NeuButton>

        <button
          onClick={() => onBump(+1)}
          className={cn(
            "relative flex-1 rounded-2xl py-3 text-center transition-all overflow-hidden",
            done ? "bg-[color:var(--emerald)] text-primary-foreground neu-flat" : "neu-pressed",
          )}
        >
          {!done && (
            <div
              className="absolute inset-y-0 left-0 bg-[color:var(--emerald)] opacity-25 transition-all duration-300"
              style={{ width: `${Math.floor((count / item.repeat_count) * 100)}%` }}
              aria-hidden="true"
            />
          )}
          <div className="relative text-2xl font-semibold tabular-nums leading-none">
            {count}
            <span className="text-sm font-normal opacity-70"> / {item.repeat_count}</span>
          </div>
          <div className="relative text-[10px] uppercase tracking-widest mt-1 opacity-80">
            tap to count
          </div>
        </button>

        <NeuButton size="icon" onClick={() => onBump(+1)} aria-label="Increase count">
          <Plus className="h-4 w-4" />
        </NeuButton>
      </div>
    </div>
  );
}
