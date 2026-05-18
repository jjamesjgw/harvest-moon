-- ============================================================
-- REMOVE LEGACY ADMIN PIN
-- ============================================================
-- The separate 'admin' commissioner account was retired in favor
-- of granting commissioner powers to one of the six players
-- (see ADMIN_ID in lib/constants.js — currently 'p_justin').
-- The 'admin' row in public.pins is now orphaned: the login UI
-- no longer offers an Admin tile, and the /api/auth/login resolver
-- only accepts canonical player names.
--
-- Idempotent: re-running is a no-op once the row is gone.
-- ============================================================

delete from public.pins where name = 'admin';
