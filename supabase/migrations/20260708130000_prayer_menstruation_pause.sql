-- Prayer buttons are getting an on-time/late/missed/paused state (built in
-- the app layer via the existing habit_logs.completed_items jsonb and
-- value_num columns — no new columns needed here). The "paused" state is
-- only ever reachable for habits where menstruation_behavior = 'always_pause',
-- which is correct fiqh for the five daily prayers, Sunnah Rawatib, Witr,
-- Tahajjud, and Duha across all four madhabs (menstruating women neither
-- pray nor make up missed prayers).
--
-- habit_templates already has 'always_pause' seeded correctly for
-- sunnah_rawatib / witr / tahajjud / duha (see the 20260628154901
-- migration). The one gap is the original "Prayer" (fard) habit, which is
-- created directly by the handle_new_user() trigger rather than from a
-- template, and never had menstruation_behavior set.

-- 1. Backfill existing users' rows.
UPDATE public.habits
SET menstruation_behavior = 'always_pause'
WHERE subcategory = 'prayer' AND menstruation_behavior IS NULL;

-- Prayer itself predates the category/subcategory backfill in some very
-- early accounts too — catch it by name as a belt-and-suspenders fallback.
UPDATE public.habits
SET category = 'fard', subcategory = 'prayer', menstruation_behavior = 'always_pause'
WHERE name = 'Prayer' AND menstruation_behavior IS NULL;

-- 2. Fix the signup trigger so future accounts get this set from the start.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prayer_id UUID;
  morning_id UUID;
  evening_id UUID;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.habits
    (user_id, name, name_ar, type, sort_order, category, subcategory, menstruation_behavior)
  VALUES
    (NEW.id, 'Prayer', 'الصلاة', 'checklist', 0, 'fard', 'prayer', 'always_pause')
  RETURNING id INTO prayer_id;

  INSERT INTO public.habit_checklist_items (habit_id, label, sort_order) VALUES
    (prayer_id, 'Fajr', 0),
    (prayer_id, 'Dhuhr', 1),
    (prayer_id, 'Asr', 2),
    (prayer_id, 'Maghrib', 3),
    (prayer_id, 'Isha', 4);

  INSERT INTO public.habits (user_id, name, name_ar, type, unit, target, sort_order)
  VALUES (NEW.id, 'Quran', 'القرآن', 'counter', 'pages', 1, 1);

  INSERT INTO public.habits (user_id, name, name_ar, type, unit, target, sort_order)
  VALUES (NEW.id, 'Morning Adhkar', 'أذكار الصباح', 'counter', 'adhkar', 13, 2)
  RETURNING id INTO morning_id;
  PERFORM public.seed_morning_adhkar(NEW.id, morning_id);

  INSERT INTO public.habits (user_id, name, name_ar, type, unit, target, sort_order)
  VALUES (NEW.id, 'Evening Adhkar', 'أذكار المساء', 'counter', 'adhkar', 13, 3)
  RETURNING id INTO evening_id;
  PERFORM public.seed_evening_adhkar(NEW.id, evening_id);

  RETURN NEW;
END;
$$;
