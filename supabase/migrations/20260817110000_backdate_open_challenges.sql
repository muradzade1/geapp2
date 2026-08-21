/*
# Making the starting challenges count past activity

## 1. Problem
`sync_my_challenges()` counts visits and attendance from `challenges.starts_at`
onwards. That is correct for a challenge announced for a given month, but the
starting set was inserted today, so an account with three visits from last week
still saw 0/3 and nothing could ever complete.

## 2. Fix
Open-ended challenges — the ones with no `ends_at` — are backdated to the start
of the platform. They now measure everything a person has ever done, which is
what "Gənclər Evini 3 dəfə ziyarət edin" reads as.

Time-limited challenges keep their own start date: a challenge announced for
October should not be completed by September's visits.

## 3. Notes
Progress is recalculated the next time the challenges screen is opened, and any
challenge whose target is already met is awarded then — including retroactively.
*/

UPDATE public.challenges
   SET starts_at = timestamptz '2026-01-01 00:00:00+04'
 WHERE ends_at IS NULL
   AND starts_at > timestamptz '2026-01-01 00:00:00+04';
