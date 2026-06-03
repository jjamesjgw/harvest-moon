'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, LEAGUE_ID } from './supabase';
import { isFreshShaped } from './leagueGuards';

const LS_KEY = `harvest-moon:${LEAGUE_ID}:backup`;
// Each tab/device gets a unique tag. Realtime echoes of our OWN writes carry
// this tag and are suppressed; everyone else's writes pass through.
const CLIENT_TAG = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

// If the tab has been backgrounded longer than this, consider the websocket
// likely-dead and force a fresh pull + re-subscribe on visibility return.
const STALE_AFTER_MS = 15_000;

/**
 * Real-time league state hook with local backup.
 * - Loads from Supabase; falls back to localStorage if Supabase is unreachable
 * - Subscribes to postgres_changes so remote updates arrive live
 * - Every setState writes to localStorage IMMEDIATELY and to Supabase (debounced 300ms, with retries)
 * - Exposes saveStatus ('idle' | 'saving' | 'ok' | 'error') and lastError for a UI banner
 * - Exposes retry() to re-push pending local data after connectivity is restored
 * - Exposes refresh() to manually re-fetch the row + re-subscribe (used by pull-to-refresh)
 * - Auto-refreshes when the tab returns from a long background period (iOS Safari kills sockets)
 */
export function useLeague() {
  const [state, setStateLocal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastError, setLastError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Set when /api/league returns 401 — the cookie expired or was never
  // there. Surfaced to the host (HarvestMoon) so it can drop meId and route
  // back to LoginScreen. Auto-cleared on the next successful write.
  const [sessionExpired, setSessionExpired] = useState(false);
  // True only after pullFresh actually completes against Supabase (whether a
  // row exists or not). Callers gate destructive auto-init on this so a
  // transient fetch failure can never be mistaken for "row doesn't exist".
  const [fetchSucceeded, setFetchSucceeded] = useState(false);

  const pendingWriteRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const channelRef = useRef(null);
  const hiddenAtRef = useRef(null);
  // Last write_id we've observed for this league row, from any source
  // (initial pull, realtime echo, or our own successful upsert). Used by
  // flushWrite to refuse fresh-shaped writes when the row is already
  // populated — defense in depth against the auto-init wipe bug.
  const lastKnownWriteIdRef = useRef(null);

  // ── localStorage helpers ──
  const readLocal = () => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const writeLocal = (s) => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch {}
  };

  // ── Pull the canonical row from Supabase (used at boot + by refresh()) ──
  const pullFresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('leagues')
      .select('state, write_id')
      .eq('id', LEAGUE_ID)
      .maybeSingle();
    if (err) throw err;
    // Mark fetch as succeeded BEFORE updating local state so any effect
    // that depends on (loading, rawState, fetchSucceeded) sees a consistent
    // batched render. A row not existing is still a successful fetch.
    setFetchSucceeded(true);
    if (data && data.write_id != null) {
      lastKnownWriteIdRef.current = data.write_id;
    }
    if (data?.state) {
      setStateLocal(data.state);
      writeLocal(data.state);
      return data.state;
    }
    return null;
  }, []);

  // ── Subscribe to realtime row changes; returns a teardown fn ──
  const subscribe = useCallback(() => {
    const channel = supabase
      .channel(`league:${LEAGUE_ID}:${CLIENT_TAG}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leagues', filter: `id=eq.${LEAGUE_ID}` },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          // Suppress only echoes of OUR own writes (this tab/device)
          if (row.client_tag === CLIENT_TAG) return;
          if (row.write_id != null) lastKnownWriteIdRef.current = row.write_id;
          // A remote write means any pending local write is now stale —
          // its snapshot was built against pre-remote state, so re-posting
          // it would wipe the remote change we're about to apply (#40, the
          // slot-pick clobber race). Cancel the debounce and drop the
          // pending blob so the next flush doesn't undo what we just
          // learned. Local edits caught in the racing window are
          // intentionally lost rather than silently overwriting concurrent
          // picks — better to require a re-tap than to wipe a teammate's
          // draft pick from the server.
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          pendingWriteRef.current = null;
          setStateLocal(row.state);
          writeLocal(row.state);
        }
      )
      .subscribe();
    channelRef.current = channel;
  }, []);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // ── Initial load + realtime subscribe ──
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setLoading(false); }, 3000);

    (async () => {
      try {
        const fresh = await pullFresh();
        if (!fresh && !cancelled) {
          const backup = readLocal();
          if (backup) setStateLocal(backup);
        }
      } catch (e) {
        if (!cancelled) {
          const backup = readLocal();
          if (backup) setStateLocal(backup);
          setSaveStatus('error');
          setLastError(e.message || 'Could not reach the league database.');
        }
      } finally {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    })();

    subscribe();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      unsubscribe();
    };
  }, [pullFresh, subscribe, unsubscribe]);

  // ── Write helper with retry ──
  const flushWrite = useCallback(async (attempt = 1) => {
    const next = pendingWriteRef.current;
    if (next == null) return;
    // Defense in depth: if the server row is already populated (we've seen
    // a write_id from it via pullFresh, realtime, or a prior write of our
    // own) and the pending write is structurally a fresh init, refuse.
    // This is the last line of defense against the auto-init wipe bug —
    // even if a future code path slips past the call-site gate, no fresh
    // state can ever overwrite a real league row.
    if (lastKnownWriteIdRef.current != null && isFreshShaped(next)) {
      pendingWriteRef.current = null;
      // eslint-disable-next-line no-console
      console.warn(
        '[useLeague] Refused to write fresh-shaped state over existing row',
        '(write_id=' + lastKnownWriteIdRef.current + ').',
      );
      return;
    }
    setSaveStatus('saving');
    try {
      // Millisecond granularity so two writes in the same human-tap window
      // never collide on write_id (previous per-second granularity could).
      // The server's CAS predicate is strict-greater, so equal write_ids
      // would be rejected as stale — collisions matter.
      const writeId = Date.now();
      const res = await fetch('/api/league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: next, write_id: writeId, client_tag: CLIENT_TAG }),
      });
      if (res.status === 401) {
        // Session is gone. Surface to the host and stop retrying — no amount
        // of network will fix this without re-auth. Local state is preserved
        // in localStorage so nothing is lost beyond the unsaved diff.
        pendingWriteRef.current = null;
        setSaveStatus('error');
        setLastError('Session expired. Please sign in again.');
        setSessionExpired(true);
        return;
      }
      if (res.status === 409) {
        // Two 409 shapes:
        //   - 'stale-write': a peer's write with a newer write_id already
        //     landed. Drop our pending blob and pull fresh; realtime will
        //     also deliver the winning row but the proactive pull lets us
        //     converge immediately if the socket is dead.
        //   - 'refused-fresh-over-populated': defense-in-depth against the
        //     auto-init wipe bug. Fall through to the generic error path so
        //     the user sees a banner (this should never fire in practice).
        let body = null;
        try { body = await res.json(); } catch {}
        if (body?.error === 'stale-write') {
          pendingWriteRef.current = null;
          if (body.server_write_id != null) {
            lastKnownWriteIdRef.current = Math.max(
              lastKnownWriteIdRef.current ?? 0,
              body.server_write_id,
            );
          }
          // Not surfaced as a user-visible error — the winning peer's state
          // is the correct one, not a failure.
          setSaveStatus('ok');
          setLastError(null);
          setSessionExpired(false);
          try { await pullFresh(); } catch {}
          return;
        }
        throw new Error(body?.error || `Save failed (409).`);
      }
      if (!res.ok) {
        let msg = `Save failed (${res.status}).`;
        try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
        throw new Error(msg);
      }
      pendingWriteRef.current = null;
      lastKnownWriteIdRef.current = writeId;
      setSaveStatus('ok');
      setLastError(null);
      setSessionExpired(false);
    } catch (e) {
      setSaveStatus('error');
      setLastError(e.message || 'Save failed. Your data is backed up locally.');
      if (attempt < 8) {
        const delay = Math.min(30000, 1500 * Math.pow(2, attempt - 1));
        retryTimerRef.current = setTimeout(() => flushWrite(attempt + 1), delay);
      }
    }
  }, [pullFresh]);

  const setState = useCallback((updater) => {
    setStateLocal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeLocal(next);
      pendingWriteRef.current = next;
      // 800ms (was 300ms): typing into Profile fires setState on every
      // keystroke, and at 300ms a fast typer would generate one Supabase
      // upsert per word. 800ms still feels instant for "did it save?"
      // confidence but coalesces a typed phrase into a single write.
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => flushWrite(1), 800);
      return next;
    });
  }, [flushWrite]);

  // ── Destructive season reset with a guaranteed pre-reset snapshot ──
  // Distinct from the plain setState path: it takes AND verifies a snapshot in
  // leagues_snapshots BEFORE clearing any state (fail-closed), mirroring the
  // ingest path's withSnapshot discipline (#42). The documented recovery story
  // points at leagues_snapshots, but a generic reset upsert produced no
  // pre-reset row there. The actual state write still goes through the normal
  // setState → flushWrite → CAS path, so realtime echo-suppression and
  // stale-write handling behave exactly as for any other write.
  //
  // `updater` is the same shape passed to setState (it spreads the live state,
  // preserving players/schedule, so it is not fresh-shaped in the normal case).
  // Returns true if the reset was applied, false if it was refused (snapshot
  // failed or session gone) — in which case no state was cleared.
  const resetSeason = useCallback(async (updater, preResetWeek) => {
    // A reset supersedes any debounced pending write.
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSaveStatus('saving');
    setLastError(null);

    let res;
    try {
      res = await fetch('/api/league/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: `pre-reset:wk${preResetWeek ?? ''}` }),
      });
    } catch {
      setSaveStatus('error');
      setLastError('Could not back up the season before reset — nothing was changed. Try again.');
      return false;
    }

    if (res.status === 401) {
      setSaveStatus('error');
      setLastError('Session expired. Please sign in again.');
      setSessionExpired(true);
      return false;
    }
    if (!res.ok) {
      setSaveStatus('error');
      setLastError('Could not back up the season before reset — nothing was changed. Try again.');
      return false;
    }

    // Snapshot landed — apply the reset through the normal write path.
    setState(updater);
    return true;
  }, [setState]);

  const retry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (pendingWriteRef.current == null && state) pendingWriteRef.current = state;
    flushWrite(1);
  }, [flushWrite, state]);

  // ── Manual refresh (pull-to-refresh + visibility reconnect) ──
  // Tears down the websocket, re-fetches the row, and re-subscribes. The
  // teardown matters: a stale socket can survive backgrounding but stop
  // delivering events, so we always rebuild rather than reuse.
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      unsubscribe();
      await pullFresh();
      subscribe();
      // A successful refresh means React state has been replaced with the
      // fresh server snapshot. Any pending local write is now stale — its
      // blob was built against pre-refresh state, and re-posting it would
      // wipe whatever pullFresh just learned (#40-class race via the
      // visibility-return / pull-to-refresh path; #45). Drop it instead,
      // matching the realtime handler in #41. The trade-off: a previously-
      // failed local edit (saveStatus === 'error') is also lost rather
      // than auto-retried — preferable to silently clobbering a teammate's
      // change that landed while the tab was backgrounded. The user can
      // re-apply the edit if they notice it didn't take; `retry()` is
      // still exposed for explicit "I want to retry my failed write"
      // intent.
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingWriteRef.current = null;
      setLastError(null);
      if (saveStatus === 'error') setSaveStatus('ok');
    } catch (e) {
      setSaveStatus('error');
      setLastError(e.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, pullFresh, subscribe, unsubscribe, saveStatus]);

  // ── Auto-refresh on tab visibility return ──
  // iOS Safari and other mobile browsers kill long-idle WebSockets without
  // notification. Whenever the tab comes back to the foreground after being
  // hidden for >STALE_AFTER_MS, force a refresh to catch up.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState === 'visible') {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) {
          refresh();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  // Flush any pending write on unmount
  useEffect(() => () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      flushWrite(1);
    }
  }, [flushWrite]);

  return { state, setState, resetSeason, loading, saveStatus, lastError, sessionExpired, retry, refresh, refreshing, fetchSucceeded };
}
