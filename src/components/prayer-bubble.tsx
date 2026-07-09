import { useId } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRAYER_ON_TIME,
  PRAYER_LATE,
  PRAYER_MISSED,
  PRAYER_PAUSED,
  type PrayerState,
} from "@/lib/habits";

const STATE_VAR: Record<PrayerState, string | null> = {
  0: null,
  1: "--emerald",
  2: "--amber",
  3: "--destructive",
  4: "--paused",
};

const STATE_TEXT: Record<PrayerState, string> = {
  0: "Mark complete",
  1: "On time",
  2: "Prayed late",
  3: "Missed",
  4: "Paused",
};

/** iOS-style "fat" crescent moon — a circle with an offset circle cut out, not a thin sliver. */
function CrescentIcon({ className }: { className?: string }) {
  const maskId = useId();
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <mask id={maskId}>
        <rect width="20" height="20" fill="white" />
        <circle cx="13.5" cy="6.5" r="6.4" fill="black" />
      </mask>
      <circle cx="10" cy="10" r="7.2" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <rect x="6" y="4.5" width="3" height="11" rx="1.2" fill="currentColor" />
      <rect x="11" y="4.5" width="3" height="11" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function StateIcon({ state, className }: { state: PrayerState; className?: string }) {
  if (state === PRAYER_ON_TIME) return <Check className={className} strokeWidth={3} />;
  if (state === PRAYER_LATE) return <CrescentIcon className={className} />;
  if (state === PRAYER_MISSED) return <X className={className} strokeWidth={3} />;
  if (state === PRAYER_PAUSED) return <PauseGlyph className={className} />;
  return null;
}

/**
 * A neumorphic "pop-it" bubble: raised and neutral until tapped, then
 * inverts into a filled, pressed-in crater colored by state. Used for the
 * five daily prayers / Sunnah Rawatib (circular) and Witr/Tahajjud/Duha
 * (full-width bar). Cycling logic lives in the caller — this component just
 * renders a state and reports taps.
 */
export function PrayerBubble({
  state,
  onCycle,
  label,
  fullWidth = false,
}: {
  state: PrayerState;
  onCycle: () => void;
  label: string;
  fullWidth?: boolean;
}) {
  const colorVar = STATE_VAR[state];
  const style = colorVar
    ? ({
        background: `radial-gradient(circle at 66% 72%, color-mix(in oklab, black 18%, var(${colorVar})) 0%, var(${colorVar}) 45%, color-mix(in oklab, white 20%, var(${colorVar})) 100%)`,
      } as React.CSSProperties)
    : undefined;

  return (
    <button
      type="button"
      onClick={onCycle}
      aria-pressed={state !== 0}
      aria-label={`${label} — ${STATE_TEXT[state]}`}
      style={style}
      className={cn(
        "relative flex items-center justify-center select-none",
        "transition-transform duration-150 active:scale-[0.88]",
        fullWidth
          ? "h-16 w-full rounded-2xl gap-2 text-sm font-semibold"
          : "h-[52px] w-[52px] rounded-full",
        colorVar ? "neu-pressed text-primary-foreground" : "neu-raised-sm text-muted-foreground",
      )}
    >
      {state !== 0 && (
        <span key={state} className="prayer-icon-pop inline-flex items-center justify-center">
          <StateIcon state={state} className={fullWidth ? "h-5 w-5" : "h-4 w-4"} />
        </span>
      )}
      {fullWidth && <span>{STATE_TEXT[state]}</span>}
    </button>
  );
}
