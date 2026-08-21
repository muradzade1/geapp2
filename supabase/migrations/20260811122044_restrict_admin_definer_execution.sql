/*
# Restrict admin management functions to signed-in accounts

## 1. Purpose
Ensures that the administrator management routines cannot be invoked before signing in.

## 2. Security change
- Revokes the default `PUBLIC` execute permission from both admin management functions.
- Only the `authenticated` role retains execute access; the internal admin check then decides which signed-in accounts may proceed.
*/

REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_profile_status(uuid, text) FROM PUBLIC;