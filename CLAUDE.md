# Sacred Rhythm Log — project context for Claude Code

This file is auto-loaded by Claude Code at the start of every session in this
repo. It captures what was discussed and built in a Cowork conversation on
2026-07-06, before the project moved to Claude Code + GitHub as the primary
way of working on it.

## What this app is

A personal daily-habit tracker for Muslim religious practices (prayer,
Qur'an reading, adhkar/dhikr, sunnah fasting, etc). Repo:
`github.com/BalsamArbab/sacred-rhythm-log`. Built with React + TanStack
Start/Router, Tailwind, a neumorphic design system (`NeuCard`/`NeuButton` in
`src/components/neu.tsx`), and Supabase (Postgres + Auth) as the backend.

## Backend: migrated off Lovable Cloud to an owned Supabase project (2026-07-08)

The project was originally built through Lovable, which enabled **Lovable
Cloud** — Lovable's own fully-managed Supabase instance. Turns out Lovable
Cloud projects are owned and operated by Lovable internally and can **never**
be accessed directly: no dashboard access, no service-role key, no CLI link,
regardless of billing tier. (Confirmed via Supabase's own troubleshooting
docs: "Can't Access Supabase Project When Using Lovable Cloud.") So the
original plan of "get admin access to the project Lovable created" was a
dead end — there was no path to it.

The actual fix: created a new, separate Supabase project
(`rfuijwafgpmgutbmgbtl`) under Balsam's own account, and rebuilt the schema
there by concatenating every file in `supabase/migrations/` (chronological
order, one duplicate `daily_duas` migration skipped) into a single
transaction-wrapped script and running it once in the new project's SQL
Editor. `.env` and `supabase/config.toml` now point at this new project.

**Old data was not migrated.** The Lovable Cloud project only ever had test
accounts used to check what pages looked like — no real habit-tracking
history existed worth preserving, so this was a clean cutover rather than a
data migration. If that's ever not true in the future (real usage
accumulates on the wrong project again), the migration path is: export each
user-data table as CSV from Lovable's Cloud → Database → Table view, remap
the `user_id` column from the old account's ID to the new account's ID
(auth IDs differ across projects), then import in dependency order (`habits`
before `habit_checklist_items`/`habit_logs`/`quran_reading_state`). Lovable's
own docs cover this end-to-end: docs.lovable.dev/tips-tricks/external-deployment-hosting.

Remaining follow-up:
- Install the Supabase CLI locally and `supabase link --project-ref
  rfuijwafgpmgutbmgbtl` so future migrations can be applied with
  `supabase db push` instead of pasting SQL into the dashboard by hand.
- Consider stripping Lovable-specific integration code now that the backend
  no longer depends on it: `src/integrations/lovable/index.ts`,
  `src/lib/lovable-error-reporting.ts`, the `@lovable.dev/cloud-auth-js`
  dependency, and the Lovable banner in `AGENTS.md` — only do this after
  confirming hosting/deploy still works without Lovable in the loop (Lovable
  may currently also be handling hosting/deploy; that needs its own
  replacement, e.g. Cloudflare via the `wrangler.json`/nitro config already
  in the repo, before Lovable is fully dropped).

## Today page work completed in this session

A large batch of changes was designed, implemented, typechecked (`tsc
--noEmit`), linted (`eslint --fix`), and build-verified (`vite build`) —
all green — then delivered as a git patch (`today-page-changes.patch`) for
the user to apply themselves, since this environment only had read-only
clone access to the GitHub repo (no push credentials). The user has since
applied the patch. Summary of what changed:

1. **Today page header redesign.** Replaced the old single "Today · N habits
   · Goal X% · Y% of the way there" card with: a header row (greeting left,
   Gregorian + Hijri date right), a "Daily Dua" card below it (Arabic RTL,
   translation, source reference, rotates daily from a curated pool), and a
   slim progress row (small ring showing `pct%` + `completed of total`
   inside it, "habits done today" label beside it). Implemented in
   `src/routes/_authenticated/today.tsx` (`DailyDuaCard`, `TodayProgressRow`).
   Hijri formatting added as `formatHijriDate()` in `src/lib/recurrence.ts`.

2. **Daily Dua feature.** New `daily_duas` table (migration
   `supabase/migrations/20260706120010_daily_duas.sql`), read-only reference
   data like `habit_templates`. Seeded with 21 duas across 10 chapters of
   Hisn al-Muslim ("Fortress of the Muslim") — waking up, before sleeping,
   restroom, ablution, leaving/entering home, mosque, athan response,
   dressing, beginning of prayer. **This is a first batch, not the full
   267/268-dua collection** — more chapters can be appended later using the
   same INSERT shape (see the migration file for the pattern; source data
   was pulled from `raw.githubusercontent.com/wafaaelmaandy/Hisn-Muslim-Json/master/husn_en.json`,
   an open JSON transcription of the book, cross-checked against api.quran.com
   for the Qur'anic portions and against sunnah.com for hadith text).
   Data layer: `src/lib/duas.ts` (`fetchDailyDuas`, `pickDailyDua` —
   deterministic day-based rotation, not random, so it cycles the whole pool
   before repeating).

3. **Qur'an habit card restructured.** The counter-type "Qur'an" habit used
   to show an "Open reader" button *and* a manual +/- stepper at the same
   time — redundant, since the reader already auto-increments
   pages/verses/minutes as you read. Now it's a single collapsible row
   (`QuranHabitControl` in `today.tsx`) that expands to two options:
   "Continue reading" (opens the existing `QuranReader`, unchanged
   auto-tracking) and "Log outside the app" (a small number input that adds
   to today's tally for reading done elsewhere).

4. **Full adhkar text.** All 13 morning + 13 evening adhkar were previously
   truncated with "..." for several entries (Ayat al-Kursi, Al-Falaq,
   An-Nas, Sayyid al-Istighfar, and their transliterations). Migration
   `supabase/migrations/20260706120000_full_adhkar_text.sql` replaces the
   `seed_morning_adhkar`/`seed_evening_adhkar` functions with full text (for
   future signups) *and* backfills existing `adhkar_items` rows matched by
   `(habit name, sort_order)`. Arabic for Qur'anic portions matches the
   Uthmani text served by api.quran.com (same source the in-app reader
   uses, for visual/textual consistency). Short surahs (Al-Ikhlas, Al-Falaq,
   An-Nas) now have numbered ayah-end marks (۝١ ۝٢ …) instead of bare ۝.

5. **Per-item adhkar progress fill.** The tap-counter on each adhkar card
   (in `src/components/adhkar-reader.tsx`, `AdhkarCard`) now fills with
   color proportional to `count / repeat_count`, using `Math.floor` so a
   3x-repeat dhikr like Al-Ikhlas fills exactly 33% → 66% → 100% (not
   33/67/100, which `Math.round` would have produced — this was a deliberate
   choice to match what the user asked for).

6. **Fixed-surah Qur'an habits got real readers.** "Surah Al-Kahf",
   "Surah Al-Mulk & As-Sajdah (night)", and "Protective Surahs Before Sleep"
   are boolean habits (fixed recitations, not open-ended reading) that
   previously had no reading content at all — just a checkbox. Added a
   `LockedSegment`/`getLockedSequence`/`hasFixedReader` system in
   `src/lib/quran.ts` mapping habit name → an ordered list of
   surah/ayah-range segments (e.g. Protective Surahs → Ayat al-Kursi
   (2:255 only) → Al-Ikhlas → Al-Falaq → An-Nas, in sequence).
   `src/components/quran-reader.tsx` gained a `lockedSequence` prop that
   locks the surah picker, scopes navigation/verse display to the segment's
   ayah range, and provides a segment pager UI when there's more than one
   part. Reading through a locked sequence still increments `value_num`
   (verse count) for future trends use, **but the boolean habit's
   "done"/`completed_bool` stays a fully separate manual checkbox tap** —
   reading progress never auto-completes these habits. (This required
   fixing a latent bug in the reader's log mutation: it used to recompute
   `completed_bool` from `habit.target` on every ayah advance, which would
   have incorrectly auto-marked a boolean habit "done" after just one verse
   once wired up to boolean habits with `target: null`.)

7. **Monday & Thursday Fasting relabeled per-day.** Confirmed via the data
   model that Monday's and Thursday's completion are already stored as
   separate `habit_logs` rows (unique on `habit_id, log_date`) — marking one
   day never touches the other. The only actual gap was cosmetic: the card
   showed the combined name "Monday & Thursday Fasting" on both days. Added
   `displayHabitName(habit, date)` in `src/lib/habits.ts`, which swaps in
   just the current day's name (e.g. "Thursday Fasting") when a habit
   recurs on 2+ specific weekdays.

## Flagged but not yet built (raised for future review)

These were surfaced during the session as related opportunities but
explicitly deferred — bring them up again before starting work on any of
them, since none were scoped or agreed to in detail:

- **Menstruation-pause logic isn't wired in anywhere.** The schema already
  has `profiles.tracks_menstruation`, `profiles.madhab`, a
  `menstrual_cycle_logs` table, and a `menstruation_behavior` enum
  (`always_pause` / `never_pause` / `depends_on_madhab`) per habit — but
  nothing on the Today page actually reads any of this to hide/pause habits
  during a tracked cycle. This would be a real feature to design and build,
  not a small fix.
- **Default "Quran" habit target is 1 page/day** for new signups — quite
  low, may be worth raising as a friendlier default.
- **Trends page has no UI yet for the new verse-tracking data** from the
  fixed-surah readers (#6 above) or from the Qur'an habit's "log outside
  the app" additions. The data is being captured (`habit_logs.value_num`);
  building charts/breakdowns on the Trends page is future work.
- **Hijri dates use the browser's calculated Umm al-Qura calendar**
  (`Intl` with `calendar: "islamic-umalqura"`), which can occasionally land
  a day off from local moon-sighting announcements. There's already a code
  comment in `src/lib/recurrence.ts` acknowledging this as an accepted
  tradeoff, not a bug to fix reflexively.
- **Daily Dua pool is 21 of ~267/268 duas** from Hisn al-Muslim, covering 10
  of ~70+ chapters. Extending it is straightforward (same INSERT shape,
  same source JSON) but wasn't done in full — deliberately paced in
  batches per the user's request ("I can only do so much in one go").

## Working conventions established in this session

- This app's religious/quotable text (Qur'an, adhkar, duas) should be
  sourced accurately, not written from memory-confidence alone — cross-check
  against api.quran.com (for Qur'anic Arabic/verse structure, matching what
  the in-app reader already fetches) and known hadith/dua reference
  collections (Hisn al-Muslim, sunnah.com) before inserting into a migration.
- Before implementing any non-trivial UI/UX change, confirm the plan in
  chat first — several items in this session were explicitly "show me the
  plan before implementing."
- After any code change here, verify with `npx tsc --noEmit`,
  `npx eslint --fix .`, and `npx vite build` before considering it done.
