/**
 * Origin of the Django API (api/). A trailing slash is stripped — pasted into
 * Vercel's env settings with one, every "/api/v1/..." path would break.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
