import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Minus, Check, RotateCcw } from "lucide-react";
import { NeuButton, NeuCard } from "@/components/neu";
import {
  fetchAdhkarItems,
  parseAdhkarProgress,
  countCompletedAdhkar,
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

  function bump(itemId: string, delta: number, max: number) {
    const cur = progress[itemId] ?? 0;
    const nextVal = Math.max(0, Math.min(max, cur + delta));
    const next = { ...progress, [itemId]: nextVal };
    mut.mutate(next);
  }

  function reset() {
    mut.mutate({});
  }

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

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {itemsQ.isLoading && (
            <div className="text-center text-sm text-muted-foreground py-10">
              Loading adhkar…
            </div>
          )}
          {!itemsQ.isLoading && items.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              No adhkar yet for this habit.
            </div>
          )}
          {items.map((it, idx) => {
            const count = progress[it.id] ?? 0;
            const done = count >= it.repeat_count;
            return (
              <NeuCard
                key={it.id}
                className={cn(
                  "space-y-3 transition-all",
                  done && "opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {idx + 1} of {items.length}
                    {it.source ? ` · ${it.source}` : ""}
                  </div>
                  {done && (
                    <span className="text-[color:var(--emerald)] flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest">
                      <Check className="h-3 w-3" /> Done
                    </span>
                  )}
                </div>

                <p
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-xl leading-[2.1] text-foreground"
                >
                  {it.arabic}
                </p>

                {it.transliteration && (
                  <p className="text-xs italic text-muted-foreground leading-relaxed">
                    {it.transliteration}
                  </p>
                )}
                {it.translation && (
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {it.translation}
                  </p>
                )}

                {/* Counter */}
                <div className="flex items-center gap-3 pt-1">
                  <NeuButton
                    size="icon"
                    onClick={() => bump(it.id, -1, it.repeat_count)}
                    disabled={count <= 0}
                    aria-label="Decrease count"
                  >
                    <Minus className="h-4 w-4" />
                  </NeuButton>

                  <button
                    onClick={() => bump(it.id, +1, it.repeat_count)}
                    className={cn(
                      "flex-1 rounded-2xl py-3 text-center transition-all",
                      done
                        ? "bg-[color:var(--emerald)] text-primary-foreground neu-flat"
                        : "neu-pressed",
                    )}
                  >
                    <div className="text-2xl font-semibold tabular-nums leading-none">
                      {count}
                      <span className="text-sm font-normal opacity-70"> / {it.repeat_count}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-widest mt-1 opacity-80">
                      tap to count
                    </div>
                  </button>

                  <NeuButton
                    size="icon"
                    onClick={() => bump(it.id, +1, it.repeat_count)}
                    aria-label="Increase count"
                  >
                    <Plus className="h-4 w-4" />
                  </NeuButton>
                </div>
              </NeuCard>
            );
          })}
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
