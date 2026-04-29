'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, LEAGUE_ID } from './supabase';

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

  const pendingWriteRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const channelRef = useRef(null);
  const hiddenAtRef = useRef(null);

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
    setSaveStatus('saving');
    try {
      const { error: err } = await supabase.from('leagues').upsert({
        id: LEAGUE_ID,
        state: next,
        client_tag: CLIENT_TAG,
        write_id: Math.floor(Date.now() / 1000), // monotonic-ish, used only for ordering
        updated_at: new Date().toISOString(),
      });
      if (err) throw err;
      pendingWriteRef.current = null;
      setSaveStatus('ok');
      setLastError(null);
    } catch (e) {
      setSaveStatus('error');
      setLastError(e.message || 'Save failed. Your data is backed up locally.');
      if (attempt < 8) {
        const delay = Math.min(30000, 1500 * Math.pow(2, attempt - 1));
        retryTimerRef.current = setTimeout(() => flushWrite(attempt + 1), delay);
      }
    }
  }, []);

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

  return { state, setState, loading, saveStatus, lastError, retry, refresh, refreshing };
}
