
CREATE TABLE public.adhkar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  arabic TEXT NOT NULL,
  transliteration TEXT,
  translation TEXT,
  source TEXT,
  repeat_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adhkar_items TO authenticated;
GRANT ALL ON public.adhkar_items TO service_role;

ALTER TABLE public.adhkar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own adhkar items all" ON public.adhkar_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_adhkar_items_habit ON public.adhkar_items(habit_id, sort_order);

-- Seed function for standard morning/evening adhkar for a given user/habit
CREATE OR REPLACE FUNCTION public.seed_morning_adhkar(_user_id UUID, _habit_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.adhkar_items (user_id, habit_id, sort_order, arabic, transliteration, translation, source, repeat_count) VALUES
  (_user_id, _habit_id, 0, 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ. اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...', 'Allāhu lā ilāha illā Huwa, al-Ḥayyu-l-Qayyūm...', 'Ayat al-Kursi — Whoever recites this in the morning is protected from jinn until evening.', 'Al-Baqarah 2:255', 1),
  (_user_id, _habit_id, 1, 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ. قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ', 'Qul Huwa Allāhu Aḥad...', 'Surah Al-Ikhlas — Whoever recites this three times suffices him from everything.', 'Al-Ikhlas 112', 3),
  (_user_id, _habit_id, 2, 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ. قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ...', 'Qul aʿūdhu bi-Rabbi-l-falaq...', 'Surah Al-Falaq — Seeking refuge in the Lord of daybreak.', 'Al-Falaq 113', 3),
  (_user_id, _habit_id, 3, 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ. قُلْ أَعُوذُ بِرَبِّ النَّاسِ...', 'Qul aʿūdhu bi-Rabbi-n-nās...', 'Surah An-Nas — Seeking refuge in the Lord of mankind.', 'An-Nas 114', 3),
  (_user_id, _habit_id, 4, 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', 'Aṣbaḥnā wa aṣbaḥa-l-mulku lillāh...', 'We have entered the morning and the dominion belongs to Allah. All praise is for Allah.', 'Muslim', 1),
  (_user_id, _habit_id, 5, 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ', 'Allāhumma bika aṣbaḥnā, wa bika amsaynā...', 'O Allah, by You we enter the morning and by You we enter the evening. By You we live and die, and to You is the resurrection.', 'Tirmidhi', 1),
  (_user_id, _habit_id, 6, 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ...', 'Allāhumma anta Rabbī lā ilāha illā ant...', 'Sayyid al-Istighfar — The master of seeking forgiveness.', 'Bukhari', 1),
  (_user_id, _habit_id, 7, 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا', 'Raḍītu billāhi Rabban, wa bil-Islāmi dīnan, wa bi-Muḥammadin nabiyyan', 'I am pleased with Allah as Lord, Islam as religion, and Muhammad ﷺ as Prophet.', 'Abu Dawud', 3),
  (_user_id, _habit_id, 8, 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ', 'Ḥasbiya-llāhu lā ilāha illā Huwa, ʿalayhi tawakkaltu, wa Huwa Rabbu-l-ʿArshi-l-ʿAẓīm', 'Allah is sufficient for me; there is no deity except Him. Upon Him I rely.', 'Abu Dawud', 7),
  (_user_id, _habit_id, 9, 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ', 'Bismillāhi-lladhī lā yaḍurru maʿa-smihi shay''un fī-l-arḍi wa lā fī-s-samā''i, wa Huwa-s-Samīʿu-l-ʿAlīm', 'In the name of Allah, with whose name nothing on earth or in heaven can cause harm. He is the All-Hearing, All-Knowing.', 'Abu Dawud, Tirmidhi', 3),
  (_user_id, _habit_id, 10, 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', 'SubḥānAllāhi wa biḥamdih', 'Glory and praise be to Allah.', 'Muslim', 100),
  (_user_id, _habit_id, 11, 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', 'Lā ilāha illa-llāh waḥdahu lā sharīka lah, lahu-l-mulku wa lahu-l-ḥamd, wa Huwa ʿalā kulli shay''in qadīr', 'None has the right to be worshipped except Allah, alone, with no partner.', 'Bukhari, Muslim', 10),
  (_user_id, _habit_id, 12, 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', 'Allāhumma ṣalli wa sallim ʿalā nabiyyinā Muḥammad', 'O Allah, send prayers and peace upon our Prophet Muhammad ﷺ.', 'Tabarani', 10);
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_evening_adhkar(_user_id UUID, _habit_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.adhkar_items (user_id, habit_id, sort_order, arabic, transliteration, translation, source, repeat_count) VALUES
  (_user_id, _habit_id, 0, 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ. اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...', 'Allāhu lā ilāha illā Huwa, al-Ḥayyu-l-Qayyūm...', 'Ayat al-Kursi — Whoever recites this in the evening is protected from jinn until morning.', 'Al-Baqarah 2:255', 1),
  (_user_id, _habit_id, 1, 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ. قُلْ هُوَ اللَّهُ أَحَدٌ...', 'Qul Huwa Allāhu Aḥad...', 'Surah Al-Ikhlas — Whoever recites this three times suffices him from everything.', 'Al-Ikhlas 112', 3),
  (_user_id, _habit_id, 2, 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ. قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ...', 'Qul aʿūdhu bi-Rabbi-l-falaq...', 'Surah Al-Falaq.', 'Al-Falaq 113', 3),
  (_user_id, _habit_id, 3, 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ. قُلْ أَعُوذُ بِرَبِّ النَّاسِ...', 'Qul aʿūdhu bi-Rabbi-n-nās...', 'Surah An-Nas.', 'An-Nas 114', 3),
  (_user_id, _habit_id, 4, 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', 'Amsaynā wa amsa-l-mulku lillāh...', 'We have entered the evening and the dominion belongs to Allah.', 'Muslim', 1),
  (_user_id, _habit_id, 5, 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ', 'Allāhumma bika amsaynā, wa bika aṣbaḥnā...', 'O Allah, by You we enter the evening and by You we enter the morning. To You is the final return.', 'Tirmidhi', 1),
  (_user_id, _habit_id, 6, 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ...', 'Allāhumma anta Rabbī lā ilāha illā ant...', 'Sayyid al-Istighfar.', 'Bukhari', 1),
  (_user_id, _habit_id, 7, 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا', 'Raḍītu billāhi Rabban, wa bil-Islāmi dīnan, wa bi-Muḥammadin nabiyyan', 'I am pleased with Allah as Lord, Islam as religion, and Muhammad ﷺ as Prophet.', 'Abu Dawud', 3),
  (_user_id, _habit_id, 8, 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ', 'Ḥasbiya-llāhu lā ilāha illā Huwa, ʿalayhi tawakkaltu, wa Huwa Rabbu-l-ʿArshi-l-ʿAẓīm', 'Allah is sufficient for me; there is no deity except Him.', 'Abu Dawud', 7),
  (_user_id, _habit_id, 9, 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ', 'Bismillāhi-lladhī lā yaḍurru...', 'In the name of Allah, with whose name nothing can cause harm.', 'Abu Dawud, Tirmidhi', 3),
  (_user_id, _habit_id, 10, 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', 'Aʿūdhu bi-kalimāti-llāhi-t-tāmmāti min sharri mā khalaq', 'I seek refuge in the perfect words of Allah from the evil of what He has created.', 'Muslim', 3),
  (_user_id, _habit_id, 11, 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', 'SubḥānAllāhi wa biḥamdih', 'Glory and praise be to Allah.', 'Muslim', 100),
  (_user_id, _habit_id, 12, 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', 'Allāhumma ṣalli wa sallim ʿalā nabiyyinā Muḥammad', 'O Allah, send prayers and peace upon our Prophet Muhammad ﷺ.', 'Tabarani', 10);
END;
$$;

-- Updated trigger that seeds adhkar items and sets habit target to item count
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

  INSERT INTO public.habits (user_id, name, name_ar, type, sort_order)
  VALUES (NEW.id, 'Prayer', 'الصلاة', 'checklist', 0)
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
