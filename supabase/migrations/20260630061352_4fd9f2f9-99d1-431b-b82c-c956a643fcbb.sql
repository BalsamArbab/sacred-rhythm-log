
DO $$ BEGIN
  CREATE TYPE public.quran_tracking_mode AS ENUM ('pages', 'verses', 'minutes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS quran_tracking_mode public.quran_tracking_mode;

UPDATE public.habits
SET quran_tracking_mode = 'pages'
WHERE quran_tracking_mode IS NULL
  AND subcategory = 'quran'
  AND type = 'counter';

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.quran_reading_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  surah INTEGER NOT NULL DEFAULT 1 CHECK (surah BETWEEN 1 AND 114),
  ayah INTEGER NOT NULL DEFAULT 1 CHECK (ayah >= 1),
  show_translation BOOLEAN NOT NULL DEFAULT TRUE,
  view_mode TEXT NOT NULL DEFAULT 'verse' CHECK (view_mode IN ('verse','page')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, habit_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quran_reading_state TO authenticated;
GRANT ALL ON public.quran_reading_state TO service_role;

ALTER TABLE public.quran_reading_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quran reading state"
  ON public.quran_reading_state
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_quran_reading_state_updated_at ON public.quran_reading_state;
CREATE TRIGGER update_quran_reading_state_updated_at
  BEFORE UPDATE ON public.quran_reading_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
