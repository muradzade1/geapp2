/*
# Preserve secure profile records

## 1. Purpose
Prevents browser clients from deleting their own profile record and leaving an authenticated account without an assigned platform role.

## 2. Security change
- Revokes direct `DELETE` permission on `profiles` for authenticated accounts.
- Keeps the existing ownership policy in place as a deny-by-default safeguard if deletion is ever enabled through a controlled service.

## 3. Important note
Account removal is not part of the platform interface and must use a protected server-side process when introduced.
*/

REVOKE DELETE ON public.profiles FROM authenticated;