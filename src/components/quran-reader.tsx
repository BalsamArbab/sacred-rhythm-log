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
}: {
  habit: HabitWithItems;
  log: HabitLog | undefined;
  date: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const trackingMode =
    (habit as unknown as { quran_tracking_mode?: "pages" | "verses" | "minutes" })
      .quran_tracking_mode ?? "pages";

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
  const [mode, setMode] = useState<Mode>("verse");
  const [showTranslation, setShowTranslation] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [picker, setPicker] = useState(false);

  // Time tracking
  const [sessionStart, setSessionStart] = useState<number | null>(null);

  // Hydrate from server reading state on first open
  useEffect(() => {
    if (!open) {
      setHydrated(false);
      setSessionStart(null);
      return;
    }
    if (hydrated || stateQ.isLoading) return;
    const s = stateQ.data;
    if (s) {
      setSurah(s.surah);
      setAyah(s.ayah);
      setMode(s.view_mode);
      setShowTranslation(s.show_translation);
    }
    setHydrated(true);
    setSessionStart(Date.now());
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

  // Clamp ayah to the surah length once it loads
  useEffect(() => {
    if (verses.length && ayah > verses.length) setAyah(verses.length);
  }, [verses.length, ayah]);

  const currentIdx = Math.max(0, verses.findIndex((v) => v.verse_number === ayah));
  const current = verses[currentIdx];

  const persist = useMutation({
    mutationFn: (next: {
      surah: number;
      ayah: number;
      mode?: Mode;
      showTranslation?: boolean;
    }) =>
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

  // Increment habit counter in the relevant unit
  const logMut = useMutation({
    mutationFn: (delta: number) => {
      const target = habit.target ?? 1;
      const nextVal = Math.max(0, (log?.value_num ?? 0) + delta);
      return upsertLog({
        habit_id: habit.id,
        log_date: date,
        value_num: nextVal,
        completed_bool: nextVal >= target,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs", date] }),
  });

  function nextAyah() {
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
            onClick={() => setPicker(true)}
            className="text-left flex-1 active:opacity-70"
          >
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Surah {surah}
              {chapter ? ` · ${chapter.verses_count} ayāt` : ""}
            </div>
            <h2 className="text-lg font-semibold mt-0.5 flex items-center gap-1.5">
              {chapter?.name_simple ?? "Loading…"}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </h2>
            {chapter?.name_arabic && (
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
          <ModeToggle
            active={mode === "page"}
            onClick={() => {
              setMode("page");
              persist.mutate({ surah, ayah, mode: "page" });
            }}
            icon={<Rows className="h-3.5 w-3.5" />}
            label="Page"
          />
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
            Progress: <span className="font-semibold text-foreground tabular-nums">
              {log?.value_num ?? 0}
            </span>
            {habit.target ? ` / ${habit.target}` : ""} {habit.unit ?? trackingMode}
          </span>
          {trackingMode === "minutes" && (
            <span className="text-[10px] uppercase tracking-widest">
              Time auto-tracked
            </span>
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

          {!versesQ.isLoading && hydrated && mode === "page" && (
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
              disabled={surah === 1 && currentIdx === 0}
              aria-label="Previous ayah"
            >
              <ChevronLeft className="h-4 w-4" />
            </NeuButton>
            <div className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
              {surah}:{ayah}
            </div>
            <NeuButton
              variant="primary"
              size="sm"
              onClick={nextAyah}
              disabled={surah === 114 && currentIdx === verses.length - 1}
            >
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

        {mode === "page" && (
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
        {picker && chaptersQ.data && (
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

function VerseCard({
  verse,
  showTranslation,
}: {
  verse: Verse;
  showTranslation: boolean;
}) {
  return (
    <div className="p-5">
      <div className="neu-raised rounded-3xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Ayah {verse.verse_key}</span>
          {verse.page_number > 0 && <span>Page {verse.page_number}</span>}
        </div>
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-3xl leading-[2.2] text-foreground"
        >
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
  return (
    <div className="p-5 space-y-4">
      {verses.map((v) => {
        const isActive = v.verse_number === activeVerse;
        return (
          <button
            key={v.id}
            onClick={() => {
              onPickVerse(v.verse_number);
              if (trackingMode === "verses") onCountUp();
            }}
            className={cn(
              "w-full text-left rounded-2xl p-4 transition-all",
              isActive ? "neu-pressed-sm" : "neu-raised-sm",
            )}
          >
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              <span>{v.verse_key}</span>
              {v.page_number > 0 && <span>p. {v.page_number}</span>}
            </div>
            <p
              dir="rtl"
              lang="ar"
              className="font-arabic text-xl leading-[2] text-foreground"
            >
              {v.text_uthmani}
            </p>
            {showTranslation && v.translation && (
              <p className="text-xs text-foreground/70 leading-relaxed mt-2">
                {v.translation}
              </p>
            )}
          </button>
        );
      })}
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
