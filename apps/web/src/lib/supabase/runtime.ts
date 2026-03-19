const TRANSIENT_ERROR_MARKERS = [
  'unexpected token',
  '<!doctype',
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'load failed',
  'timeout',
  'timed out',
  '522'
];

export function withSupabaseTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 12000,
  timeoutMessage = 'İşlem zaman aşımına uğradı.'
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function toSupabaseUserMessage(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message.trim() : '';

  if (!message) {
    return fallbackMessage;
  }

  const normalized = message.toLocaleLowerCase('tr-TR');

  if (TRANSIENT_ERROR_MARKERS.some((marker) => normalized.includes(marker))) {
    return 'Supabase şu anda yanıt vermiyor. Lütfen kısa süre sonra yeniden deneyin.';
  }

  return message;
}
