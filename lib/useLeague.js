'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, LEAGUE_ID } from './supabase';

const LS_KEY = `harvest-moon:${LEAGUE_ID}:backup`;
// Each tab/device gets a unique tag. Realtime echoes of our OWN writes carry
// this tag and are suppressed; everyone else's writes pass through.
const CLIENT_TAG = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

/**
 * Real-time league state hook with local backup.
 * - Loads from Supabase; falls back to localStorage if Supabase is unreachable
 * - Subscribes to postgres_changes so remote updates arrive live
 * - Every setState writes to localStorage IMMEDIATELY and to Supabase (debounced 300ms, with retries)
 * - Exposes saveStatus ('idle' | 'saving' | 'ok' | 'error') and lastError for a UI banner
 * - Exposes retry() to re-push pending local data after connectivity is restored
 */
export function useLeague() {
  const [state, setStateLocal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastError, setLastError] = useState(null);

  const writeIdRef = useRef(0);
  const lastSeenIdRef = useRef(0);
  const pendingWriteRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const retryTimerRef = useRef(null);

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

  // ── Initial load + realtime subscribe ──
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setLoading(false); }, 3000);

    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('leagues')
          .select('state, write_id')
          .eq('id', LEAGUE_ID)
          .maybeSingle();
        if (err) throw err;
        if (!cancelled) {
          if (data?.state) {
            setStateLocal(data.state);
            lastSeenIdRef.current = data.write_id || 0;
            writeLocal(data.state);
          } else {
            const backup = readLocal();
            if (backup) setStateLocal(backup);
          }
        }
      } catch (e) {
        const backup = readLocal();
        if (!cancelled) {
          if (backup) setStateLocal(backup);
          setSaveStatus('error');
          setLastError(e.message || 'Could not reach the league database.');
        }
      } finally {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`league:${LEAGUE_ID}`)
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

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

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
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => flushWrite(1), 300);
      return next;
    });
  }, [flushWrite]);

  const retry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (pendingWriteRef.current == null && state) pendingWriteRef.current = state;
    flushWrite(1);
  }, [flushWrite, state]);

  useEffect(() => () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      flushWrite(1);
    }
  }, [flushWrite]);

  return { state, setState, loading, saveStatus, lastError, retry };
}
