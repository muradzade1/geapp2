/*
# Linking young people to their centre

## 1. Problem
A young person picks their centre by name during registration, but that name
is stored as free text in `profiles.youth_house_name`. When the centre later
registers and is approved, nothing connects the two — `profiles.youth_house_id`
stays empty, so the centre's member count and every per-centre report read as
zero.

## 2. Solution
Two triggers, each covering one order of events:

- A young person registers (or edits their profile) while their centre already
  exists: the link is set as the row is written.
- A centre is approved afterwards: every young person who named it is linked in
  one pass.

Matching is on the trimmed, lower-cased name, so "Mingəçevir Gənclər Evi" and
"Mingəçevir Gənclər evi" resolve to the same centre.

## 3. Notes
1. Existing rows are linked once by the backfill at the end of this migration.
2. `youth_house_name` is kept as written by the young person — it records what
   they chose even if no centre with that name ever registers.
3. Only approved and active centres are matched.
*/

-- ============================================================
-- 1. Resolve a centre by name
-- ============================================================

CREATE OR REPLACE FUNCTION public.find_house_by_name(house_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id
    FROM public.youth_houses h
   WHERE lower(trim(h.name)) = lower(trim(house_name))
     AND h.status = 'approved'
     AND h.is_active
   ORDER BY h.created_at
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.find_house_by_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_house_by_name(text) TO authenticated;

-- ============================================================
-- 2. Young person written -> link if the centre exists
-- ============================================================

CREATE OR REPLACE FUNCTION public.link_profile_to_house()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role <> 'youth' OR NEW.youth_house_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only resolve when unlinked, or when the chosen name changed.
  IF NEW.youth_house_id IS NULL
     OR NEW.youth_house_name IS DISTINCT FROM OLD.youth_house_name THEN
    NEW.youth_house_id := public.find_house_by_name(NEW.youth_house_name);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_link_house ON public.profiles;
CREATE TRIGGER profiles_link_house
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_profile_to_house();

-- ============================================================
-- 3. Centre approved -> link everyone who named it
-- ============================================================

CREATE OR REPLACE FUNCTION public.link_youths_on_house_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'approved' OR NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles p
     SET youth_house_id = NEW.id,
         updated_at = now()
   WHERE p.role = 'youth'
     AND p.youth_house_id IS DISTINCT FROM NEW.id
     AND lower(trim(p.youth_house_name)) = lower(trim(NEW.name));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS youth_houses_link_youths ON public.youth_houses;
CREATE TRIGGER youth_houses_link_youths
  AFTER INSERT OR UPDATE OF status, is_active, name ON public.youth_houses
  FOR EACH ROW EXECUTE FUNCTION public.link_youths_on_house_approval();

-- ============================================================
-- 4. Backfill existing rows
-- ============================================================

UPDATE public.profiles p
   SET youth_house_id = h.id,
       updated_at = now()
  FROM public.youth_houses h
 WHERE p.role = 'youth'
   AND p.youth_house_id IS NULL
   AND p.youth_house_name IS NOT NULL
   AND h.status = 'approved'
   AND h.is_active
   AND lower(trim(p.youth_house_name)) = lower(trim(h.name));
