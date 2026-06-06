-- ============================================================================
-- Security & integrity audit fixes — applied 2026-06-06
-- Project: DoubleDo (ydetmjryjpnrpcmoxvre) — shared by duo. and read apps
-- Applied to production via Supabase Management API. This file records the
-- changes so they live in git. Rollback snippets are in _audit_backups/.
-- ============================================================================

-- FIX 1 [CRITICAL/ERROR] weekly_picks had RLS DISABLED -> table fully open.
-- Read path is RPC get_weekly_picks; writes are done by cron/service_role.
ALTER TABLE public.weekly_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS weekly_picks_public_read ON public.weekly_picks;
CREATE POLICY weekly_picks_public_read
  ON public.weekly_picks FOR SELECT TO anon, authenticated USING (true);
-- (no INSERT/UPDATE/DELETE policy => only service_role can write)

-- FIX 2 [HIGH] competition_invite_links had an always-true UPDATE policy
-- ("Update on accept": USING true / no WITH CHECK) letting any authenticated
-- user mutate ANY invite link. The accept flow runs inside the SECURITY DEFINER
-- function accept_competition_invite(), which bypasses RLS, so the policy was
-- pure attack surface. Removed.
DROP POLICY IF EXISTS "Update on accept" ON public.competition_invite_links;

-- FIX 3 [HIGH] 74 SECURITY DEFINER functions had a mutable search_path
-- (search_path injection / privilege-escalation vector). Pin search_path.
-- Full generated list in _audit_backups/funcs_missing_searchpath.json.
-- Example (all 74 applied identically):
--   ALTER FUNCTION public.accept_competition_invite(p_token text)
--     SET search_path = public, pg_temp;
-- ... (74 statements total)

-- FIX 4 [PERF/INFO] Dropped 2 redundant duplicate indexes (kept the ones
-- backing UNIQUE constraints).
DROP INDEX IF EXISTS public.habit_progress_unique;           -- dup of habit_progress_unique_per_day (constraint)
DROP INDEX IF EXISTS public.idx_friendships_user_id_friend_id; -- dup of idx_friendships_user_friend

-- ============================================================================
-- DEFERRED (documented, NOT auto-applied — require coordinated frontend deploy
-- or carry semantic risk; see audit report):
--  * users table: SELECT true for anon leaks email + settings. Fix requires
--    moving pre-login email check to RPC check_email_exists() in App.jsx /
--    InvitePage.jsx, deploying frontend FIRST, then restricting the table.
--  * 42 multiple_permissive_policies / 31 auth_rls_initplan: RLS perf rewrites
--    (wrap auth.uid() in (select auth.uid()), merge permissive policies).
--  * 30 unindexed_foreign_keys: add covering indexes on hot FKs.
-- ============================================================================
