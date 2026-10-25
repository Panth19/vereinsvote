import { useCallback, useEffect, useRef, useState } from 'react';
import type { Leaderboard } from '@vv/shared';
import { api, errorMessage } from './api.ts';

// GET a JSON endpoint. Pass null to skip. reload() fetches again.
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [version, setVersion] = useState(0);
  const lastUrl = useRef(url);

  useEffect(() => {
    if (!url) return;
    // a different page: don't show the old page's data while loading
    if (lastUrl.current !== url) {
      lastUrl.current = url;
      setData(null);
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<T>(url)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}

// Live ranking over Server-Sent Events. If the stream breaks (some proxies,
// flaky mobile data) we poll every 15 s until it is back.
export function useLiveLeaderboard(slug: string) {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const url = `/api/competitions/${slug}/leaderboard`;
    let poll: ReturnType<typeof setInterval> | undefined;
    const fetchOnce = () => api.get<Leaderboard>(url).then(setBoard).catch(() => {});
    const startPolling = () => {
      if (poll) return;
      fetchOnce();
      poll = setInterval(fetchOnce, 15_000);
    };
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };

    if (typeof EventSource === 'undefined') {
      startPolling();
      return stopPolling;
    }

    const es = new EventSource(`${url}/stream`);
    es.addEventListener('leaderboard', (e) => {
      setBoard(JSON.parse(e.data));
      setLive(true);
    });
    es.onopen = stopPolling;
    es.onerror = () => {
      setLive(false);
      startPolling();
    };
    return () => {
      es.close();
      stopPolling();
    };
  }, [slug]);

  return { board, live };
}

// re-renders every `ms` so countdowns stay current
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
