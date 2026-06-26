
-- Add daily completion goal to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_goal_pct integer NOT NULL DEFAULT 80;
ALTER TABLE public.profiles ADD CONSTRAINT daily_goal_pct_range CHECK (daily_goal_pct BETWEEN 1 AND 100);

-- Convert any existing Adhkar habits from boolean to counter with a default target
UPDATE public.habits
SET type = 'counter', unit = COALESCE(unit, 'adhkar'), target = COALESCE(target, 20)
WHERE type = 'boolean' AND (name ILIKE '%adhkar%' OR name ILIKE '%adkar%' OR name ILIKE '%dhikr%');

-- Update the new-user trigger so Adhkar habits seed as counter (percentage tracking)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prayer_id UUID;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.habits (user_id, name, name_ar, type, sort_order)
  VALUES (NEW.id, 'Prayer', 'الصلاة', 'checklist', 0)
  RETURNING id INTO prayer_id;

  INSERT INTO public.habit_checklist_items (habit_id, label, sort_order) VALUES
    (prayer_id, 'Fajr', 0),
    (prayer_id, 'Dhuhr', 1),
    (prayer_id, 'Asr', 2),
    (prayer_id, 'Maghrib', 3),
    (prayer_id, 'Isha', 4);

  INSERT INTO public.habits (user_id, name, name_ar, type, unit, target, sort_order) VALUES
    (NEW.id, 'Quran', 'القرآن', 'counter', 'pages', 1, 1),
    (NEW.id, 'Morning Adhkar', 'أذكار الصباح', 'counter', 'adhkar', 20, 2),
    (NEW.id, 'Evening Adhkar', 'أذكار المساء', 'counter', 'adhkar', 20, 3);

  RETURN NEW;
END;
$function$;
