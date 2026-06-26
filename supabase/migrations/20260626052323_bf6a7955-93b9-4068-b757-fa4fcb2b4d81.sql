
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Habit type enum
CREATE TYPE public.habit_type AS ENUM ('boolean', 'counter', 'checklist');

-- Habits
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  type public.habit_type NOT NULL DEFAULT 'boolean',
  unit TEXT,
  target INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX habits_user_idx ON public.habits(user_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits all" ON public.habits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Checklist items
CREATE TABLE public.habit_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX habit_checklist_items_habit_idx ON public.habit_checklist_items(habit_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_checklist_items TO authenticated;
GRANT ALL ON public.habit_checklist_items TO service_role;
ALTER TABLE public.habit_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist items all" ON public.habit_checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.habits h WHERE h.id = habit_id AND h.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.habits h WHERE h.id = habit_id AND h.user_id = auth.uid()));

-- Habit logs (one per habit per day)
CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  value_num INTEGER NOT NULL DEFAULT 0,
  completed_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_bool BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (habit_id, log_date)
);
CREATE INDEX habit_logs_user_date_idx ON public.habit_logs(user_id, log_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs all" ON public.habit_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed function: creates profile + 4 starter habits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (NEW.id, 'Morning Adhkar', 'أذكار الصباح', 'boolean', NULL, NULL, 2),
    (NEW.id, 'Evening Adhkar', 'أذكار المساء', 'boolean', NULL, NULL, 3);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
