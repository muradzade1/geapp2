/*
# Optional gender field on profiles

Admin panel needs a "Cins bölgüsü" chart next to "Yaş bölgüsü". Collecting
gender was previously skipped on privacy grounds (see 20260817140000); this
adds it back as a genuinely optional field — nullable, no default, not
required at registration — so nobody is forced to disclose it.
*/

ALTER TABLE public.profiles
  ADD COLUMN gender text CHECK (gender IN ('kişi', 'qadın'));
