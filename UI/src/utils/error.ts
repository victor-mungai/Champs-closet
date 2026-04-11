export const getErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message?.trim();
  if (!message) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(message);
    if (typeof parsed?.detail === 'string' && parsed.detail.trim().length > 0) {
      return parsed.detail.trim();
    }
  } catch {
    // Keep plain error messages when they are not JSON payloads.
  }

  return message;
};
