/*
  # Profil: təhsil və məşğulluq vəziyyəti

  1. Yeni sütunlar (profiles)
     - `education` (text, boş ola bilər) — təhsil səviyyəsi
     - `employment_status` (text, boş ola bilər) — hazırkı məşğulluq vəziyyəti

  2. Qeydlər
     - Köhnə hesablar üçün dəyər boş qalır (NULL).
     - Yalnız razılaşdırılmış dəyərlər qəbul olunur (CHECK).
     - Mövcud RLS siyasətlərinə toxunulmur.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS employment_status text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_education_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_education_check
      CHECK (education IS NULL OR education = ANY (ARRAY[
        'Orta təhsil',
        'Peşə təhsili',
        'Orta ixtisas təhsili',
        'Ali təhsil (bakalavriat)',
        'Ali təhsil (magistratura)',
        'Formal təhsil almamışam'
      ]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_employment_status_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_employment_status_check
      CHECK (employment_status IS NULL OR employment_status = ANY (ARRAY[
        'İşləyirəm',
        'Sahibkaram',
        'İşləmirəm'
      ]));
  END IF;
END $$;
