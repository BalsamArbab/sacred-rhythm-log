import { supabase } from "@/integrations/supabase/client";

/**
 * Quran data layer.
 *
 * Source: quran.com public API v4 (https://api.quran.com/api/v4).
 * Offline: every fetched surah + translation is cached to localStorage
 * keyed by `quran:surah:<id>` and `quran:translation:<id>:<resId>`.
 * Once a user reads a surah online, it's available offline forever
 * (until they clear browser storage).
 */

const API = "https://api.quran.com/api/v4";

// Sahih International translation resource id on quran.com
const TRANSLATION_ID = 131;

export type Chapter = {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
  revelation_place: string;
};

export type Verse = {
  id: number;
  verse_number: number;
  verse_key: string; // "2:255"
  text_uthmani: string;
  page_number: number;
  translation?: string | null;
};

const CHAPTERS_KEY = "quran:chapters";

export async function fetchChapters(): Promise<Chapter[]> {
  const cached = readLS<Chapter[]>(CHAPTERS_KEY);
  if (cached) return cached;
  const res = await fetch(`${API}/chapters?language=en`);
  if (!res.ok) throw new Error("Could not load surah list");
  const json = (await res.json()) as { chapters: Chapter[] };
  writeLS(CHAPTERS_KEY, json.chapters);
  return json.chapters;
}

export async function fetchSurahVerses(
  surahId: number,
  withTranslation: boolean,
): Promise<Verse[]> {
  const arabicKey = `quran:surah:${surahId}`;
  const translationKey = `quran:translation:${surahId}:${TRANSLATION_ID}`;

  let arabic = readLS<Omit<Verse, "translation">[]>(arabicKey);
  if (!arabic) {
    const res = await fetch(
      `${API}/quran/verses/uthmani?chapter_number=${surahId}`,
    );
    if (!res.ok) throw new Error("Could not load surah");
    const json = (await res.json()) as {
      verses: { id: number; verse_key: string; text_uthmani: string }[];
    };
    // Also pull verse metadata (page number, verse_number) in one call
    const metaRes = await fetch(
      `${API}/verses/by_chapter/${surahId}?language=en&words=false&per_page=300&fields=page_number`,
    );
    const meta = metaRes.ok
      ? ((await metaRes.json()) as {
          verses: { id: number; verse_number: number; verse_key: string; page_number: number }[];
        }).verses
      : [];
    const metaByKey = new Map(meta.map((m) => [m.verse_key, m]));
    arabic = json.verses.map((v) => {
      const m = metaByKey.get(v.verse_key);
      return {
        id: v.id,
        verse_key: v.verse_key,
        text_uthmani: v.text_uthmani,
        verse_number: m?.verse_number ?? Number(v.verse_key.split(":")[1]),
        page_number: m?.page_number ?? 0,
      };
    });
    writeLS(arabicKey, arabic);
  }

  let translations: Record<string, string> | null = null;
  if (withTranslation) {
    translations = readLS<Record<string, string>>(translationKey);
    if (!translations) {
      const res = await fetch(
        `${API}/quran/translations/${TRANSLATION_ID}?chapter_number=${surahId}`,
      );
      if (res.ok) {
        const json = (await res.json()) as {
          translations: { verse_key: string; text: string }[];
        };
        translations = {};
        for (const t of json.translations) {
          // strip basic html tags (footnote markers) so we can render as text
          translations[t.verse_key] = t.text.replace(/<[^>]+>/g, "").trim();
        }
        writeLS(translationKey, translations);
      }
    }
  }

  return arabic.map((v) => ({
    ...v,
    translation: translations?.[v.verse_key] ?? null,
  }));
}

// ---------- Reading state ----------

export type ReadingState = {
  id: string;
  user_id: string;
  habit_id: string;
  surah: number;
  ayah: number;
  show_translation: boolean;
  view_mode: "verse" | "page";
};

export async function fetchReadingState(habitId: string): Promise<ReadingState | null> {
  const { data, error } = await supabase
    .from("quran_reading_state")
    .select("*")
    .eq("habit_id", habitId)
    .maybeSingle();
  if (error) throw error;
  return (data as ReadingState | null) ?? null;
}

export async function upsertReadingState(input: {
  habit_id: string;
  surah: number;
  ayah: number;
  show_translation?: boolean;
  view_mode?: "verse" | "page";
}) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("quran_reading_state")
    .upsert(
      {
        user_id: uid,
        habit_id: input.habit_id,
        surah: input.surah,
        ayah: input.ayah,
        show_translation: input.show_translation ?? true,
        view_mode: input.view_mode ?? "verse",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,habit_id" },
    );
  if (error) throw error;
}

// ---------- LocalStorage helpers ----------

function readLS<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded — silently skip
  }
}

export function isQuranHabit(h: {
  type: string;
  subcategory?: string | null;
  unit?: string | null;
  name?: string | null;
}): boolean {
  if (h.type !== "counter") return false;
  if (h.subcategory === "quran") return true;
  if (h.unit === "pages" || h.unit === "verses" || h.unit === "minutes") return true;
  return /qur'?an/i.test(h.name ?? "");
}
