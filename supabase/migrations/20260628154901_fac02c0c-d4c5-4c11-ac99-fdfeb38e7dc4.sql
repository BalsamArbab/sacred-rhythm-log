
-- 1. Enums
CREATE TYPE public.habit_category AS ENUM ('fard', 'sunnah');
CREATE TYPE public.habit_subcategory AS ENUM ('prayer', 'dhikr', 'quran', 'fasting', 'character');
CREATE TYPE public.recurrence_type AS ENUM ('daily', 'weekly', 'hijri_monthly', 'hijri_annual');
CREATE TYPE public.menstruation_behavior AS ENUM ('always_pause', 'never_pause', 'depends_on_madhab');

-- 2. habit_templates (global reference)
CREATE TABLE public.habit_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  name_ar text,
  category public.habit_category NOT NULL,
  subcategory public.habit_subcategory NOT NULL,
  type public.habit_type NOT NULL,
  unit text,
  target integer,
  recurrence_type public.recurrence_type NOT NULL DEFAULT 'daily',
  recurrence_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  menstruation_behavior public.menstruation_behavior NOT NULL DEFAULT 'never_pause',
  description text,
  source_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  checklist_labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.habit_templates TO authenticated;
GRANT ALL ON public.habit_templates TO service_role;

ALTER TABLE public.habit_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates readable by authenticated"
  ON public.habit_templates FOR SELECT
  TO authenticated
  USING (true);

-- 3. Extend habits
ALTER TABLE public.habits
  ADD COLUMN template_id uuid REFERENCES public.habit_templates(id) ON DELETE SET NULL,
  ADD COLUMN category public.habit_category,
  ADD COLUMN subcategory public.habit_subcategory,
  ADD COLUMN recurrence_type public.recurrence_type NOT NULL DEFAULT 'daily',
  ADD COLUMN recurrence_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN menstruation_behavior public.menstruation_behavior;

-- Backfill existing seeded habits
UPDATE public.habits SET category = 'fard', subcategory = 'prayer'
  WHERE name = 'Prayer';
UPDATE public.habits SET category = 'sunnah', subcategory = 'quran', menstruation_behavior = 'depends_on_madhab'
  WHERE name = 'Quran';
UPDATE public.habits SET category = 'sunnah', subcategory = 'dhikr', menstruation_behavior = 'never_pause'
  WHERE name IN ('Morning Adhkar', 'Evening Adhkar');

-- 4. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN tracks_menstruation boolean NOT NULL DEFAULT false,
  ADD COLUMN madhab text CHECK (madhab IN ('hanafi','shafi','maliki','hanbali'));

-- 5. menstrual_cycle_logs
CREATE TABLE public.menstrual_cycle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menstrual_cycle_logs TO authenticated;
GRANT ALL ON public.menstrual_cycle_logs TO service_role;

ALTER TABLE public.menstrual_cycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cycle logs all"
  ON public.menstrual_cycle_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX menstrual_cycle_logs_user_date_idx
  ON public.menstrual_cycle_logs (user_id, start_date DESC);

-- 6. Seed habit_templates
INSERT INTO public.habit_templates
  (key, name, name_ar, category, subcategory, type, unit, target, recurrence_type, recurrence_data, menstruation_behavior, description, sort_order, is_default, checklist_labels)
VALUES
-- PRAYER (sunnah)
('sunnah_rawatib', 'Sunnah Rawatib', 'السنن الرواتب', 'sunnah', 'prayer', 'checklist', NULL, NULL, 'daily', '{}'::jsonb, 'always_pause',
 'The 12 confirmed sunnah prayers tied to the daily fard prayers.', 100, false,
 '["2 before Fajr","4 before Dhuhr","2 after Dhuhr","2 after Maghrib","2 after Isha"]'::jsonb),
('witr', 'Witr', 'الوتر', 'sunnah', 'prayer', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'always_pause',
 'Odd-numbered night prayer concluding the night.', 101, false, '[]'::jsonb),
('tahajjud', 'Tahajjud', 'التهجد', 'sunnah', 'prayer', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'always_pause',
 'Night prayer offered after sleep.', 102, false, '[]'::jsonb),
('duha', 'Duha', 'الضحى', 'sunnah', 'prayer', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'always_pause',
 'Forenoon prayer.', 103, false, '[]'::jsonb),

-- DHIKR (sunnah)
('post_prayer_tasbih', 'Post-Prayer Tasbih', 'تسبيح بعد الصلاة', 'sunnah', 'dhikr', 'counter', 'tasbih', 100, 'daily', '{}'::jsonb, 'never_pause',
 'SubhanAllah 33, Alhamdulillah 33, Allahu Akbar 34 after each fard prayer.', 200, false, '[]'::jsonb),
('istighfar', 'Istighfar', 'الاستغفار', 'sunnah', 'dhikr', 'counter', 'count', 100, 'daily', '{}'::jsonb, 'never_pause',
 'Seeking forgiveness from Allah.', 201, false, '[]'::jsonb),
('salawat', 'Salawat', 'الصلاة على النبي', 'sunnah', 'dhikr', 'counter', 'count', 100, 'daily', '{}'::jsonb, 'never_pause',
 'Sending prayers upon the Prophet ﷺ.', 202, false, '[]'::jsonb),

-- QURAN (sunnah)
('surah_kahf', 'Surah Al-Kahf', 'سورة الكهف', 'sunnah', 'quran', 'boolean', NULL, NULL, 'weekly', '{"weekdays":[5]}'::jsonb, 'depends_on_madhab',
 'Recited on Fridays — a light between the two Fridays.', 300, false, '[]'::jsonb),
('mulk_sajdah_night', 'Surah Al-Mulk & As-Sajdah (night)', 'سورة الملك والسجدة', 'sunnah', 'quran', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'depends_on_madhab',
 'Recited before sleeping each night.', 301, false, '[]'::jsonb),
('protective_surahs_sleep', 'Protective Surahs Before Sleep', 'المعوذات قبل النوم', 'sunnah', 'quran', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'depends_on_madhab',
 'Ikhlas, Falaq, Nas, and Ayat al-Kursi before sleeping.', 302, false, '[]'::jsonb),

-- FASTING (sunnah)
('mon_thu_fasting', 'Monday & Thursday Fasting', 'صيام الإثنين والخميس', 'sunnah', 'fasting', 'boolean', NULL, NULL, 'weekly', '{"weekdays":[1,4]}'::jsonb, 'always_pause',
 'Voluntary fast on Mondays and Thursdays.', 400, false, '[]'::jsonb),
('ayyam_al_bid', 'Ayyam al-Bid (White Days)', 'أيام البيض', 'sunnah', 'fasting', 'boolean', NULL, NULL, 'hijri_monthly', '{"hijri_days":[13,14,15]}'::jsonb, 'always_pause',
 'Fasting the 13th, 14th, and 15th of each Hijri month.', 401, false, '[]'::jsonb),
('six_shawwal', 'Six Days of Shawwal', 'ست من شوال', 'sunnah', 'fasting', 'boolean', NULL, NULL, 'hijri_annual', '{"hijri_month":10,"hijri_days":[1,2,3,4,5,6]}'::jsonb, 'always_pause',
 'Six voluntary fasts in the month of Shawwal.', 402, false, '[]'::jsonb),
('day_of_arafah', 'Day of Arafah', 'يوم عرفة', 'sunnah', 'fasting', 'boolean', NULL, NULL, 'hijri_annual', '{"hijri_month":12,"hijri_days":[9]}'::jsonb, 'always_pause',
 'Fasting the 9th of Dhul-Hijjah expiates the sins of two years.', 403, false, '[]'::jsonb),
('ashura', 'Ashura', 'عاشوراء', 'sunnah', 'fasting', 'boolean', NULL, NULL, 'hijri_annual', '{"hijri_month":1,"hijri_days":[9,10]}'::jsonb, 'always_pause',
 'Fasting the 9th and 10th of Muharram.', 404, false, '[]'::jsonb),
('first_nine_dhul_hijjah', 'First 9 Days of Dhul-Hijjah', 'العشر الأوائل من ذي الحجة', 'sunnah', 'fasting', 'boolean', NULL, NULL, 'hijri_annual', '{"hijri_month":12,"hijri_days":[1,2,3,4,5,6,7,8,9]}'::jsonb, 'always_pause',
 'The first nine days of Dhul-Hijjah are especially beloved to Allah.', 405, false, '[]'::jsonb),

-- CHARACTER (sunnah)
('miswak', 'Miswak', 'السواك', 'sunnah', 'character', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'never_pause',
 'Using the miswak — beloved sunnah of dental care.', 500, false, '[]'::jsonb),
('sleep_sunnah', 'Sleep Sunnah', 'سنن النوم', 'sunnah', 'character', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'never_pause',
 'Wudu before sleep, sleeping on the right side, facing the Qiblah.', 501, false, '[]'::jsonb),
('dua_home', 'Dua Entering/Leaving Home', 'دعاء دخول وخروج المنزل', 'sunnah', 'character', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'never_pause',
 'Saying the prophetic duas when entering and leaving the home.', 502, false, '[]'::jsonb),
('smile_salam', 'Smile & Give Salam First', 'التبسم وإفشاء السلام', 'sunnah', 'character', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'never_pause',
 'Smiling is charity; spreading salam strengthens love between believers.', 503, false, '[]'::jsonb),
('daily_sadaqah', 'Daily Sadaqah', 'صدقة يومية', 'sunnah', 'character', 'boolean', NULL, NULL, 'daily', '{}'::jsonb, 'never_pause',
 'Give something in charity every day, even a small amount.', 504, false, '[]'::jsonb);
