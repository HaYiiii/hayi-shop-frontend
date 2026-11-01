/**
 * Bridge between the API client's `onStepUpRequired` and the step-up dialog. Concurrent requests that
 * need step-up share one prompt; resolving replays them, rejecting hands back their 403.
 */
export function createStepUpGate() {
  let pending: { promise: Promise<void>; resolve: () => void; reject: (reason: Error) => void } | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    request(): Promise<void> {
      if (!pending) {
        let resolve!: () => void;
        let reject!: (reason: Error) => void;
        const promise = new Promise<void>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        pending = { promise, resolve, reject };
        notify();
      }
      return pending.promise;
    },
    settle(outcome: "verified" | "cancelled") {
      if (!pending) return;
      if (outcome === "verified") pending.resolve();
      else pending.reject(new Error("Step-up cancelled"));
      pending = null;
      notify();
    },
    isOpen: () => pending !== null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type StepUpGate = ReturnType<typeof createStepUpGate>;
