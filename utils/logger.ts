const IS_DEV = __DEV__;

export const logger = {
  log: (...args: unknown[]) => {
    if (IS_DEV) {
      console.log('[MeetingAlarm]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (IS_DEV) {
      console.info('[MeetingAlarm:Info]', ...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn('[MeetingAlarm:Warn]', ...args);
  },
  error: (message: string, error?: unknown) => {
    // Sanitizes any auth tokens or raw secret payloads before logging
    const sanitizedError = error instanceof Error ? error.message : String(error || '');
    console.error(`[MeetingAlarm:Error] ${message}:`, sanitizedError);
  },
  debug: (...args: unknown[]) => {
    if (IS_DEV) {
      console.debug('[MeetingAlarm:Debug]', ...args);
    }
  },
};
