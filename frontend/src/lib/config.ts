/**
 * Configuration for API and WebSocket endpoints.
 * If env vars are not set in browser runtime, use same-origin defaults.
 */
const browserApiDefault = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000';
const browserWsDefault = getBrowserWsDefault();

function getBrowserWsDefault(): string {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000';
  }

  if (window.location.protocol === 'https:') {
    return `wss://${window.location.host}`;
  }

  if (window.location.protocol === 'http:') {
    return `ws://${window.location.host}`;
  }

  return 'ws://localhost:8000';
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || browserApiDefault;

export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || browserWsDefault;

/**
 * For HTTPS/WSS (production):
 * - Set NEXT_PUBLIC_API_URL=https://api.example.com
 * - Set NEXT_PUBLIC_WS_URL=wss://api.example.com
 */
