export function reportError(error: unknown, context?: Record<string, unknown>) {
  // INTEGRATION: Sentry or similar later
  console.error(error, context);
}
