/*
# Lock profile role assignment to the server

## 1. Purpose
Prevents authenticated browser clients from creating profile records or assigning themselves a role.

## 2. Security change
- Removes the client insert policy from `profiles`.
- Revokes direct profile insertion from authenticated accounts.
- The registration service is the only path that creates a profile and chooses a permitted role.

## 3. Important note
This protects privileged roles such as `admin` from being created by a crafted browser request.
*/

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
REVOKE INSERT ON public.profiles FROM authenticated;