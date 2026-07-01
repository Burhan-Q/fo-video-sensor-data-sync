// Fetches per-frame sensor arrays for the open modal sample via the read
// operator, with a single-entry cache keyed by sample id.
//
// The operator call is promisified with the proven `useCallableExecutor`
// pattern (per-call `callback` so concurrent calls each own their resolver).

import { useCallback, useEffect, useRef, useState } from "react";
import { useOperatorExecutor } from "@fiftyone/operators";
import { useRecoilValue } from "recoil";
import { nullableModalSampleId } from "@fiftyone/state";
import type { SensorResult } from "./types";

const OPERATOR_URI = "@Burhan-Q/fo-video-sensor-data-sync/get_frame_sensor_data";

/**
 * Returns a stable `call(params)` that fires the operator and resolves with its
 * result. Uses @fiftyone/operators' per-call `callback` option so concurrent
 * calls don't share a resolver.
 */
function useCallableExecutor(uri: string): {
  call: (params?: Record<string, unknown>) => Promise<unknown>;
} {
  const exec = useOperatorExecutor(uri);
  const execRef = useRef(exec);
  execRef.current = exec;
  const call = useCallback(
    (params: Record<string, unknown> = {}): Promise<unknown> =>
      new Promise<unknown>((resolve, reject) => {
        execRef.current.execute(params, {
          callback: (raw: { result: unknown; error: unknown }) => {
            if (raw.error) reject(raw.error);
            else resolve(raw.result);
          },
        });
      }),
    [],
  );
  return { call };
}

export interface UseSensorDataResult {
  data: SensorResult | null;
  loading: boolean;
  error: string | null;
  sampleId: string | null;
}

/**
 * Reads the open modal sample id and fetches its sensor data. A single-entry
 * cache (cap 1) keyed by sample id is evicted whenever the sample changes —
 * sufficient for the MVP per the brief's LRU note. State is never set after
 * unmount.
 */
export function useSensorData(): UseSensorDataResult {
  const sampleId = useRecoilValue<string | null>(nullableModalSampleId);
  const { call } = useCallableExecutor(OPERATOR_URI);

  const [data, setData] = useState<SensorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single-entry cache: { id, data }.
  const cache = useRef<{ id: string; data: SensorResult } | null>(null);
  const mounted = useRef(true);
  const inflight = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sampleId) {
      cache.current = null;
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Cache hit — serve immediately.
    if (cache.current && cache.current.id === sampleId) {
      inflight.current = sampleId;
      setData(cache.current.data);
      setLoading(false);
      setError(null);
      return;
    }

    // New sample — evict and fetch.
    cache.current = null;
    setData(null);
    setLoading(true);
    setError(null);
    inflight.current = sampleId;

    call({ sample_id: sampleId })
      .then((raw) => {
        if (!mounted.current || inflight.current !== sampleId) return;
        const data = raw as SensorResult;
        cache.current = { id: sampleId, data };
        setData(data);
        setLoading(false);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!mounted.current || inflight.current !== sampleId) return;
        setData(null);
        setLoading(false);
        setError(String(err));
      });
  }, [sampleId, call]);

  return { data, loading, error, sampleId };
}
