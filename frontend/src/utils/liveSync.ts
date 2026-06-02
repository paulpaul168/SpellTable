export type LiveSyncOptions = {
    /** Broadcast to viewers without committing admin React state (during drag). */
    live?: boolean;
    debounce?: boolean;
};

/** Throttle viewer sync during drag while keeping smooth local display. */
export function createThrottledLiveSync<T>(
    callback: (value: T, options?: LiveSyncOptions) => void,
    intervalMs = 50,
) {
    let lastUpdate = 0;
    let pending: T | null = null;
    let scheduled = false;

    const throttledLive = (value: T) => {
        const now = performance.now();
        if (now - lastUpdate >= intervalMs) {
            callback(value, { live: true });
            lastUpdate = now;
            pending = null;
            return;
        }
        pending = value;
        if (scheduled) {
            return;
        }
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            if (pending !== null) {
                callback(pending, { live: true });
                pending = null;
                lastUpdate = performance.now();
            }
        });
    };

    const commit = (value: T) => {
        pending = null;
        lastUpdate = performance.now();
        callback(value);
    };

    return { throttledLive, commit };
}
