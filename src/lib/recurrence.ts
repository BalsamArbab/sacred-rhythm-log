import type { RecurrenceData, RecurrenceType } from "@/lib/habits";

/**
 * Hijri (Islamic) calendar day/month for a given date, using the
 * browser/runtime's built-in Intl calendar support (Umm al-Qura algorithm).
 * This is a calculated calendar and can occasionally land a day off from
 * local moon-sighting announcements — normal for any calculated Hijri date,
 * and not worth a separate dependency to "fix."
 */
export function getHijriDate(date: Date): { day: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    calendar: "islamic-umalqura",
    day: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? 0);
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  return { day, month };
}

/** ISO weekday for a date: Monday = 1 ... Sunday = 7 */
function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

/**
 * Human-readable Hijri date, e.g. "21 Muharram 1448 AH", using the
 * runtime's built-in Umm al-Qura calendar (same source as getHijriDate).
 */
export function formatHijriDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    calendar: "islamic-umalqura",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${day} ${month} ${year} AH`;
}

/**
 * Whether a habit with the given recurrence is due on `date`.
 * Daily habits are always due; weekly/hijri habits only show up on their
 * matching day(s), so e.g. Surah Al-Kahf only appears on Fridays and
 * Monday/Thursday fasting only appears on Mondays and Thursdays.
 */
export function isHabitDueOn(
  recurrenceType: RecurrenceType,
  recurrenceData: RecurrenceData | null | undefined,
  date: Date,
): boolean {
  const data = recurrenceData ?? {};
  switch (recurrenceType) {
    case "daily":
      return true;
    case "weekly":
      return (data.weekdays ?? []).includes(isoWeekday(date));
    case "hijri_monthly": {
      const { day } = getHijriDate(date);
      return (data.hijri_days ?? []).includes(day);
    }
    case "hijri_annual": {
      const { day, month } = getHijriDate(date);
      return month === data.hijri_month && (data.hijri_days ?? []).includes(day);
    }
    default:
      return true;
  }
}
