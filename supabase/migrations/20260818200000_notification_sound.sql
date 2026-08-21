/*
# Notification sound preference

## 1. Purpose
Lets each account turn the notification sound off, or pick which of the five
built-in tones it hears.

## 2. Where it is stored
On `profiles`, not in the browser. The alternative — keeping it on the device —
would mean someone who uses the app on a phone and a computer would have to set
it twice, and would lose it after reinstalling. It is a preference about the
person, so it travels with the account.

## 3. Columns
- `notification_sound_enabled`: on by default.
- `notification_sound`: one of the five tone identifiers; unknown values fall
  back to the first tone in the interface rather than failing.

## 4. Security
Both columns are added to the list an account may update about itself. Nothing
else changes: an account still cannot alter its own role or status.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_sound text NOT NULL DEFAULT 'chime';

-- Hesab yalnız bu iki sahəni özü dəyişə bilər.
GRANT UPDATE (notification_sound_enabled, notification_sound)
  ON public.profiles TO authenticated;
