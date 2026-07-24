import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Languages,
  Rows,
  SquareStack,
  Loader2,
  Check,
} from "lucide-react";
import { NeuButton } from "@/components/neu";
import {
  fetchChapters,
  fetchSurahVerses,
  fetchReadingState,
  upsertReadingState,
  type Chapter,
  type Verse,
  type LockedSegment,
} from "@/lib/quran";
import { upsertLog, type HabitLog, type HabitWithItems } from "@/lib/habits";
import { cn } from "@/lib/utils";

type Mode = "verse" | "page";

export function QuranReader({
  habit,
  log,
  date,
  open,
  onClose,
  lockedSequence,
}: {
  habit: HabitWithItems;
  log: HabitLog | undefined;
  date: string;
  open: boolean;
  onClose: () => void;
  /**
   * When set, the reader is locked to this specific sequence of
   * surahs/ayah-ranges (e.g. Al-Kahf, or Ikhlas+Falaq+Nas+Ayat-al-Kursi in
   * order) instead of letting the user pick any surah. Used for habits
   * that are tied to fixed recitations rather than open-ended reading.
   */
  lockedSequence?: LockedSegment[];
}) {
  const qc = useQueryClient();
  const trackingMode = lockedSequence
    ? "verses"
    : ((habit as unknown as { quran_tracking_mode?: "pages" | "verses" | "minutes" })
        .quran_tracking_mode ?? "pages");

  const chaptersQ = useQuery({
    queryKey: ["quran-chapters"],
    queryFn: fetchChapters,
    enabled: open,
    staleTime: Infinity,
  });

  const stateQ = useQuery({
    queryKey: ["quran-state", habit.id],
    queryFn: () => fetchReadingState(habit.id),
    enabled: open,
  });

  // Local UI state, seeded from server state once it loads
  const [surah, setSurah] = useState(1);
  const [ayah, setAyah] = useState(1);
  const [segIndex, setSegIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("verse");
  const [showTranslation, setShowTranslation] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [picker, setPicker] = useState(false);

  // Time tracking
  const [sessionStart, setSessionStart] = useState<number | null>(null);

  const activeSeg = lockedSequence?.[segIndex] ?? null;

  // Hydrate from server reading state on first open
  useEffect(() => {
    if (!open) {
      setHydrated(false);
      setSessionStart(null);
      return;
    }
    if (hydrated || stateQ.isLoading) return;
    const s = stateQ.data;
    if (lockedSequence) {
      const foundIdx = s ? lockedSequence.findIndex((seg) => seg.surah === s.surah) : -1;
      if (foundIdx >= 0 && s) {
        setSegIndex(foundIdx);
        setSurah(s.surah);
        setAyah(s.ayah);
      } else {
        setSegIndex(0);
        setSurah(lockedSequence[0].surah);
        setAyah(lockedSequence[0].fromAyah ?? 1);
      }
      setMode("verse");
      setShowTranslation(s?.show_translation ?? true);
    } else if (s) {
      setSurah(s.surah);
      setAyah(s.ayah);
      setMode(s.view_mode);
      setShowTranslation(s.show_translation);
    }
    setHydrated(true);
    setSessionStart(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hydrated, stateQ.isLoading, stateQ.data]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const versesQ = useQuery({
    queryKey: ["quran-verses", surah, showTranslation],
    queryFn: () => fetchSurahVerses(surah, showTranslation),
    enabled: open && hydrated,
    staleTime: Infinity,
  });

  const verses = versesQ.data ?? [];
  const chapter = chaptersQ.data?.find((c) => c.id === surah);

  // When locked to a segment (e.g. just ayah 255 of Al-Baqarah), only that
  // ayah range is navigable/visible — not the whole surah.
  const scopedVerses = useMemo(() => {
    if (!activeSeg) return verses;
    const from = activeSeg.fromAyah ?? 1;
    const to = activeSeg.toAyah ?? Infinity;
    return verses.filter((v) => v.verse_number >= from && v.verse_number <= to);
  }, [verses, activeSeg]);

  // Clamp ayah to the valid range once verses load
  useEffect(() => {
    if (!activeSeg) {
      if (verses.length && ayah > verses.length) setAyah(verses.length);
      return;
    }
    const from = activeSeg.fromAyah ?? 1;
    const to = activeSeg.toAyah ?? (verses.length || from);
    if (ayah < from) setAyah(from);
    else if (ayah > to) setAyah(to);
  }, [verses.length, ayah, activeSeg]);

  const currentIdx = Math.max(
    0,
    scopedVerses.findIndex((v) => v.verse_number === ayah),
  );
  const current = scopedVerses[currentIdx];

  const persist = useMutation({
    mutationFn: (next: { surah: number; ayah: number; mode?: Mode; showTranslation?: boolean }) =>
      upsertReadingState({
        habit_id: habit.id,
        surah: next.surah,
        ayah: next.ayah,
        view_mode: next.mode ?? mode,
        show_translation: next.showTranslation ?? showTranslation,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quran-state", habit.id] }),
  });

  function savePosition(nextSurah: number, nextAyah: number) {
    setSurah(nextSurah);
    setAyah(nextAyah);
    persist.mutate({ surah: nextSurah, ayah: nextAyah });
  }

  function goToSegment(idx: number, fromStart: boolean) {
    if (!lockedSequence) return;
    const seg = lockedSequence[idx];
    setSegIndex(idx);
    const a = fromStart ? (seg.fromAyah ?? 1) : (seg.toAyah ?? seg.fromAyah ?? 1);
    savePosition(seg.surah, a);
  }

  // Increment habit counter in the relevant unit. For boolean habits (the
  // fixed-surah readers) "done" is a separate manual checkbox — reading
  // progress here is purely informational history, so we never recompute
  // completed_bool from a target for them.
  const logMut = useMutation({
    mutationFn: (delta: number) => {
      const nextVal = Math.max(0, (log?.value_num ?? 0) + delta);
      const completed_bool =
        habit.type === "boolean" ? (log?.completed_bool ?? false) : nextVal >= (habit.target ?? 1);
      return upsertLog({
        habit_id: habit.id,
        log_date: date,
        value_num: nextVal,
        completed_bool,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs", date] }),
  });

  function nextAyah() {
    if (lockedSequence) {
      if (!current) return;
      logMut.mutate(1);
      if (currentIdx + 1 < scopedVerses.length) {
        savePosition(surah, scopedVerses[currentIdx + 1].verse_number);
      } else if (segIndex + 1 < lockedSequence.length) {
        goToSegment(segIndex + 1, true);
      }
      return;
    }
    if (!current || !verses.length) return;
    // Count this ayah toward the goal (verses mode) or pages mode (when crossing a page)
    if (trackingMode === "verses") logMut.mutate(1);
    else if (trackingMode === "pages") {
      const nextV = verses[currentIdx + 1];
      if (nextV && nextV.page_number !== current.page_number) logMut.mutate(1);
    }

    if (currentIdx + 1 < verses.length) {
      savePosition(surah, verses[currentIdx + 1].verse_number);
    } else if (surah < 114) {
      // roll to next surah
      savePosition(surah + 1, 1);
    }
  }

  function prevAyah() {
    if (lockedSequence) {
      if (currentIdx > 0) {
        savePosition(surah, scopedVerses[currentIdx - 1].verse_number);
      } else if (segIndex > 0) {
        goToSegment(segIndex - 1, false);
      }
      return;
    }
    if (currentIdx > 0) savePosition(surah, verses[currentIdx - 1].verse_number);
    else if (surah > 1) savePosition(surah - 1, 1);
  }

  // Time tracking: log minutes when the reader closes
  function handleClose() {
    if (trackingMode === "minutes" && sessionStart) {
      const minutes = Math.round((Date.now() - sessionStart) / 60000);
      if (minutes > 0) logMut.mutate(minutes);
    }
    onClose();
  }

  if (!open) return null;

  const prevDisabled = lockedSequence
    ? segIndex === 0 && currentIdx === 0
    : surah === 1 && currentIdx === 0;
  const nextDisabled = lockedSequence
    ? segIndex === lockedSequence.length - 1 && currentIdx === scopedVerses.length - 1
    : surah === 114 && currentIdx === verses.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="bg-background w-full max-w-md max-h-[94vh] rounded-t-3xl sm:rounded-3xl neu-raised flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-border/60">
          <button
            onClick={() => !lockedSequence && setPicker(true)}
            disabled={!!lockedSequence}
            className="text-left flex-1 active:opacity-70 disabled:active:opacity-100"
          >
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {lockedSequence
                ? `${segIndex + 1} of ${lockedSequence.length}`
                : `Surah ${surah}${chapter ? ` · ${chapter.verses_count} ayāt` : ""}`}
            </div>
            <h2 className="text-lg font-semibold mt-0.5 flex items-center gap-1.5">
              {activeSeg?.label ?? chapter?.name_simple ?? "Loading…"}
              {!lockedSequence && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </h2>
            {chapter?.name_arabic && !activeSeg?.label && (
              <div className="font-arabic text-base text-[color:var(--emerald)]">
                {chapter.name_arabic}
              </div>
            )}
          </button>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="neu-raised-sm rounded-full h-9 w-9 flex items-center justify-center text-muted-foreground active:neu-pressed-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segment pager (locked, multi-part readers only) */}
        {lockedSequence && lockedSequence.length > 1 && (
          <div className="px-5 py-2 flex items-center justify-between gap-3 border-b border-border/60">
            <NeuButton
              size="icon"
              onClick={() => goToSegment(segIndex - 1, false)}
              disabled={segIndex === 0}
              aria-label="Previous part"
            >
              <ChevronLeft className="h-4 w-4" />
            </NeuButton>
            <div className="text-xs text-muted-foreground text-center flex-1">
              {activeSeg?.label ?? chapter?.name_simple}{" "}
              <span className="tabular-nums">
                ({segIndex + 1}/{lockedSequence.length})
              </span>
            </div>
            <NeuButton
              size="icon"
              onClick={() => goToSegment(segIndex + 1, true)}
              disabled={segIndex === lockedSequence.length - 1}
              aria-label="Next part"
            >
              <ChevronRight className="h-4 w-4" />
            </NeuButton>
          </div>
        )}

        {/* Mode + translation toggles */}
        <div className="px-5 py-3 flex items-center gap-2 border-b border-border/60">
          <ModeToggle
            active={mode === "verse"}
            onClick={() => {
              setMode("verse");
              persist.mutate({ surah, ayah, mode: "verse" });
            }}
            icon={<SquareStack className="h-3.5 w-3.5" />}
            label="Verse"
          />
          {!lockedSequence && (
            <ModeToggle
              active={mode === "page"}
              onClick={() => {
                setMode("page");
                persist.mutate({ surah, ayah, mode: "page" });
              }}
              icon={<Rows className="h-3.5 w-3.5" />}
              label="Page"
            />
          )}
          <div className="flex-1" />
          <button
            onClick={() => {
              const next = !showTranslation;
              setShowTranslation(next);
              persist.mutate({ surah, ayah, showTranslation: next });
            }}
            className={cn(
              "h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition",
              showTranslation
                ? "bg-[color:var(--emerald)] text-primary-foreground"
                : "neu-raised-sm text-muted-foreground",
            )}
            aria-pressed={showTranslation}
          >
            <Languages className="h-3.5 w-3.5" />
            EN
          </button>
        </div>

        {/* Counter strip */}
        <div className="px-5 py-2 text-xs text-muted-foreground flex items-center justify-between border-b border-border/60">
          <span>
            Progress:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {log?.value_num ?? 0}
            </span>
            {habit.target ? ` / ${habit.target}` : ""} {habit.unit ?? trackingMode}
          </span>
          {trackingMode === "minutes" && (
            <span className="text-[10px] uppercase tracking-widest">Time auto-tracked</span>
          )}
        </div>

        {/* Reading area */}
        <div className="flex-1 overflow-y-auto">
          {(versesQ.isLoading || !hydrated) && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading surah…
            </div>
          )}

          {!versesQ.isLoading && hydrated && mode === "verse" && current && (
            <VerseCard verse={current} showTranslation={showTranslation} />
          )}

          {!versesQ.isLoading && hydrated && !lockedSequence && mode === "page" && (
            <PageView
              verses={verses}
              showTranslation={showTranslation}
              activeVerse={ayah}
              onPickVerse={(n) => savePosition(surah, n)}
              trackingMode={trackingMode}
              onCountUp={() => logMut.mutate(1)}
            />
          )}
        </div>

        {/* Footer nav (verse mode) */}
        {mode === "verse" && (
          <div className="px-5 py-4 border-t border-border/60 flex items-center gap-3">
            <NeuButton
              size="icon"
              onClick={prevAyah}
              disabled={prevDisabled}
              aria-label="Previous ayah"
            >
              <ChevronLeft className="h-4 w-4" />
            </NeuButton>
            <div className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
              {surah}:{ayah}
            </div>
            <NeuButton variant="primary" size="sm" onClick={nextAyah} disabled={nextDisabled}>
              {trackingMode === "verses" ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" /> Next
                </>
              ) : (
                <>
                  Next <ChevronRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </NeuButton>
          </div>
        )}

        {!lockedSequence && mode === "page" && (
          <div className="px-5 py-4 border-t border-border/60 flex items-center gap-3">
            <NeuButton
              size="sm"
              onClick={() => surah > 1 && savePosition(surah - 1, 1)}
              disabled={surah === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev surah
            </NeuButton>
            <div className="flex-1" />
            <NeuButton
              variant="primary"
              size="sm"
              onClick={() => surah < 114 && savePosition(surah + 1, 1)}
              disabled={surah === 114}
            >
              Next surah <ChevronRight className="h-4 w-4 ml-1" />
            </NeuButton>
          </div>
        )}

        {/* Surah picker overlay */}
        {!lockedSequence && picker && chaptersQ.data && (
          <SurahPicker
            chapters={chaptersQ.data}
            current={surah}
            onPick={(id) => {
              savePosition(id, 1);
              setPicker(false);
            }}
            onClose={() => setPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

function ModeToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition",
        active
          ? "neu-pressed-sm text-[color:var(--emerald)]"
          : "neu-raised-sm text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function VerseCard({ verse, showTranslation }: { verse: Verse; showTranslation: boolean }) {
  return (
    <div className="p-5">
      <div className="neu-raised rounded-3xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Ayah {verse.verse_key}</span>
          {verse.page_number > 0 && <span>Page {verse.page_number}</span>}
        </div>
        <p dir="rtl" lang="ar" className="font-arabic text-3xl leading-[2.2] text-foreground">
          {verse.text_uthmani}
        </p>
        {showTranslation && verse.translation && (
          <p className="text-sm text-foreground/80 leading-relaxed border-t border-border/60 pt-3">
            {verse.translation}
          </p>
        )}
      </div>
    </div>
  );
}

function PageView({
  verses,
  showTranslation,
  activeVerse,
  onPickVerse,
  trackingMode,
  onCountUp,
}: {
  verses: Verse[];
  showTranslation: boolean;
  activeVerse: number;
  onPickVerse: (n: number) => void;
  trackingMode: "pages" | "verses" | "minutes";
  onCountUp: () => void;
}) {
  // Group verses by real mushaf page number so the layout mirrors an actual
  // printed page break, rather than one long undifferentiated scroll.
  const pages = useMemo(() => {
    const map = new Map<number, Verse[]>();
    for (const v of verses) {
      const key = v.page_number || 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [verses]);

  return (
    <div className="p-5 space-y-8">
      {pages.map(([pageNum, pageVerses]) => (
        <div key={pageNum}>
          {pageNum > 0 && (
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-3">
              Page {pageNum}
            </div>
          )}

          {/* Verses flow together as continuous text, like a real page,
              instead of stacking as separate cards. */}
          <p dir="rtl" lang="ar" className="font-arabic text-2xl leading-[2.4] text-foreground text-right">
            {pageVerses.map((v) => {
              const isActive = v.verse_number === activeVerse;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    onPickVerse(v.verse_number);
                    if (trackingMode === "verses") onCountUp();
                  }}
                  className={cn(
                    "rounded-lg transition-colors",
                    isActive ? "bg-[color:var(--emerald-soft)]" : "hover:bg-muted/60",
                  )}
                >
                  {v.text_uthmani}
                  <span className="mx-1 text-sm align-middle text-[color:var(--emerald)] font-sans">
                    ﴿{v.verse_number}﴾
                  </span>
                </button>
              );
            })}
          </p>

          {showTranslation && (
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              {pageVerses
                .filter((v) => v.translation)
                .map((v) => (
                  <p key={v.id} className="text-xs text-foreground/70 leading-relaxed">
                    <span className="font-semibold text-foreground/90">{v.verse_key}</span>{" "}
                    {v.translation}
                  </p>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SurahPicker({
  chapters,
  current,
  onPick,
  onClose,
}: {
  chapters: Chapter[];
  current: number;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return chapters;
    const needle = q.toLowerCase();
    return chapters.filter(
      (c) =>
        c.name_simple.toLowerCase().includes(needle) ||
        String(c.id).includes(needle) ||
        c.name_arabic.includes(q),
    );
  }, [chapters, q]);

  return (
    <div
      className="absolute inset-0 bg-background rounded-t-3xl sm:rounded-3xl flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-border/60">
        <button
          onClick={onClose}
          aria-label="Back"
          className="neu-raised-sm rounded-full h-9 w-9 flex items-center justify-center text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <BookOpen className="h-3 w-3 inline mr-1" /> Pick surah
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or number…"
            className="mt-1 bg-transparent w-full text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 gap-2">
        {filtered.map((c) => {
          const active = c.id === current;
          return (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={cn(
                "rounded-2xl p-3 flex items-center gap-3 text-left transition",
                active ? "neu-pressed-sm" : "neu-raised-sm",
              )}
            >
              <div className="neu-pressed-sm h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums">
                {c.id}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{c.name_simple}</div>
                <div className="text-[11px] text-muted-foreground">
                  {c.verses_count} ayāt · {c.revelation_place}
                </div>
              </div>
              <div className="font-arabic text-base text-[color:var(--emerald)]">
                {c.name_arabic}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
