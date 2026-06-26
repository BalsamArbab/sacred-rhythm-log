# Islamic Rituals Tracker — Plan

## Vibe & Visual Direction
Inspired by quran.com (calm, scholarly, generous whitespace, warm off-white background, deep teal/emerald accents, Amiri/Scheherazade for Arabic), Quranly (soft pastel cards, friendly progress rings, gentle gradients), and Dhikr & Dua (tap-to-count, large tactile buttons).

Combined with **Neumorphism**:
- Background: warm off-white `#ECECEE` light / deep slate `#1F2933` dark
- Accent: emerald/teal (Quran.com inspired) `#0E7C66`
- Soft dual shadows (light top-left, dark bottom-right) on all cards/buttons
- Inset shadows for "completed" / "pressed" states — perfect for habit checkmarks and tasbih counters
- Rounded-2xl everywhere, no hard borders
- Typography: Inter (UI) + Amiri (Arabic text like بِسْمِ ٱللَّٰهِ)

## Tech Foundation (built right from day one)
- **Lovable Cloud enabled now** — auth (email/password + Google), Postgres with RLS, user-scoped data. App works as soon as user signs in; same code path as future multi-device sync. No throwaway localStorage layer to migrate later.
- Routes: `/auth` (public sign-in), `/_authenticated/` (today, trends, settings)

## Core Features (v1)

### 1. Habits — flexible per-habit type
Seeded for each new user:
- **Prayer** — 5 sub-checks (Fajr, Dhuhr, Asr, Maghrib, Isha) — `type: checklist`
- **Quran** — counted (pages read today) — `type: counter`, unit "pages", target 1+
- **Adhkar (Morning)** — single check — `type: boolean`
- **Adhkar (Evening)** — single check — `type: boolean`

Habit types supported: `boolean` (done/not done), `counter` (numeric with target & unit), `checklist` (sub-items, % complete).

### 2. Today screen
Neumorphic card per habit. Prayer card shows 5 soft circular toggles inline. Quran card has − / [count] / + tactile buttons + target ring. Adhkar cards single big tap-to-toggle. Today's overall completion ring at top.

### 3. Trends screen (per habit + overall)
- **Streak** (current + best) — shown but de-emphasized
- **Heatmap** (last 12 weeks, GitHub-style, emerald intensity)
- **WoW & MoM deltas** — primary encouraging metric: "+12% vs last week", "+5% vs last month" with up-arrow when positive
- **7/30-day completion %** line
- Missed days don't break the encouraging tone — language is "you're trending up" not "streak lost"

### 4. Settings
- Add habit (name, type, unit, target, optional Arabic name)
- Edit / archive / reorder habits
- Account: email, sign out, delete account
- Theme: light / dark / system

## Data Model

```text
profiles (id → auth.users, display_name, created_at)
habits (id, user_id, name, name_ar, type, unit, target, sort_order, archived_at, created_at)
habit_checklist_items (id, habit_id, label, sort_order)   -- for Prayer's 5 items
habit_logs (id, habit_id, user_id, log_date, value_num, completed_items jsonb, completed_bool)
  unique (habit_id, log_date)
```
All tables: RLS scoped to `auth.uid()`, GRANTs to `authenticated` + `service_role`. Trigger on signup creates profile + seeds 4 starter habits.

## Implementation Order
1. Enable Lovable Cloud + auth (email/password + Google) + `_authenticated` gate
2. Migration: tables, RLS, signup trigger, seed habits
3. Design tokens in `src/styles.css` — neumorphic shadows, palette, fonts (@fontsource/inter, @fontsource/amiri)
4. Reusable neumorphic primitives: `<NeuCard>`, `<NeuButton>`, `<NeuToggle>`, `<NeuCounter>`
5. Today screen + server fns (`getTodayHabits`, `logHabit`)
6. Trends screen — heatmap, WoW/MoM, streak (recharts for line, custom grid for heatmap)
7. Settings — CRUD habits, account
8. Polish: dark mode, mobile viewport (this is a mobile-first app)

## Out of scope for v1 (note for later)
Prayer time calculation by location, Qibla, Quran reader integration, reminders/notifications, social/sharing, multiple languages. Easy to layer on later.

## Open question I'll proceed with a default on unless you object
- **Google sign-in alongside email/password** — yes by default (matches the iOS-app feel of your references). Say the word if you want email only.
