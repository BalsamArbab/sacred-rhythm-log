import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchDailyDuas, pickDailyDua } from "@/lib/duas";
import { formatHijriDate } from "@/lib/recurrence";

export const Route = createFileRoute("/_authenticated/splash")({
  component: SplashPage,
});

const SPLASH_KEY = "splash_seen";

function SplashPage() {
  const navigate = useNavigate();
  const duasQ = useQuery({
    queryKey: ["daily-duas"],
    queryFn: fetchDailyDuas,
    staleTime: 1000 * 60 * 60,
  });

  const now = new Date();
  const dua = duasQ.data ? pickDailyDua(duasQ.data, now) : null;
  const hijri = formatHijriDate(now);
  const gregorian = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function proceed() {
    sessionStorage.setItem(SPLASH_KEY, "1");
    navigate({ to: "/today", replace: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") proceed();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6 cursor-pointer select-none"
      onClick={proceed}
      role="button"
      aria-label="Continue to app"
    >
      <div className="text-center mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{gregorian}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{hijri}</p>
      </div>

      <div className="w-full max-w-sm space-y-5 text-center">
        {duasQ.isLoading ? (
          <p className="text-muted-foreground text-sm animate-pulse">Loading today's dua…</p>
        ) : dua ? (
          <>
            {dua.category && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {dua.category}
              </p>
            )}
            <p dir="rtl" lang="ar" className="font-arabic text-3xl leading-[2.1] text-foreground">
              {dua.arabic}
            </p>
            {dua.transliteration && (
              <p className="text-xs italic text-muted-foreground leading-relaxed">
                {dua.transliteration}
              </p>
            )}
            {dua.translation && (
              <p className="text-sm text-foreground/80 leading-relaxed">{dua.translation}</p>
            )}
            {dua.source && (
              <p className="text-[11px] text-muted-foreground">{dua.source}</p>
            )}
          </>
        ) : null}
      </div>

      <div className="mt-16 text-center space-y-1">
        <p className="text-sm text-muted-foreground/70 font-arabic">بِسْمِ اللَّهِ</p>
        <p className="text-[11px] text-muted-foreground/50 uppercase tracking-[0.2em]">
          tap to begin
        </p>
      </div>
    </div>
  );
}
