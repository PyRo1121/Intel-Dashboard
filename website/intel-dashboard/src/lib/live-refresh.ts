import { createEffect, onCleanup } from "solid-js";

interface LiveRefreshOptions {
  onlyWhenVisible?: boolean;
  refreshOnFocus?: boolean;
  jitterRatio?: number;
  runImmediately?: boolean;
}

export function useLiveRefresh(
  refetch: () => void | boolean | Promise<void | boolean>,
  intervalMs: number,
  options: LiveRefreshOptions = {},
) {
  const {
    onlyWhenVisible = true,
    refreshOnFocus = true,
    jitterRatio = 0.2,
    runImmediately = false,
  } = options;

  createEffect(() => {
    if (typeof window === "undefined") return;

    const baseInterval = Math.max(5_000, intervalMs);
    let timer: number | null = null;
    let activeRequest: Promise<unknown> | null = null;
    let stopped = false;
    let consecutiveNoChange = 0;

    const nextDelay = () => {
      const delta = Math.floor(baseInterval * Math.max(0, jitterRatio));
      if (delta <= 0) return baseInterval;
      return baseInterval + Math.floor(Math.random() * (delta * 2 + 1)) - delta;
    };

    const runRefetch = async () => {
      if (onlyWhenVisible && typeof document !== "undefined" && document.hidden) return;
      if (activeRequest) return;
      activeRequest = Promise.resolve(refetch()).then((result) => {
        if (result === false) {
          consecutiveNoChange += 1;
        } else {
          consecutiveNoChange = 0;
        }
      }).finally(() => {
        activeRequest = null;
      });
      await activeRequest;
    };

    const schedule = () => {
      const backoffFactor = Math.min(1 + consecutiveNoChange * 0.2, 2);
      timer = window.setTimeout(async () => {
        await runRefetch();
        if (!stopped) schedule();
      }, Math.floor(nextDelay() * backoffFactor));
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        consecutiveNoChange = 0;
        void runRefetch();
      }
    };

    const onFocus = () => {
      void runRefetch();
    };

    if (runImmediately) {
      void runRefetch();
    }

    schedule();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    if (refreshOnFocus) {
      window.addEventListener("focus", onFocus);
    }

    onCleanup(() => {
      stopped = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (refreshOnFocus) {
        window.removeEventListener("focus", onFocus);
      }
    });
  });
}
