import { useState, useEffect } from 'react';

const DEFAULT_TIMEOUT_MS = 12_000;

export function useSlowLoad(isLoading: boolean, timeoutMs = DEFAULT_TIMEOUT_MS): boolean {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsTimedOut(false);
      return undefined;
    }
    const id = setTimeout(() => setIsTimedOut(true), timeoutMs);
    return () => clearTimeout(id);
  }, [isLoading, timeoutMs]);

  return isTimedOut;
}
