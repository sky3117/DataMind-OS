/**
 * Configuration for API and WebSocket endpoints.
 * If env vars are not set in browser runtime, use same-origin defaults.
 */
const browserApiDefault = typeof window !== 'undefined' ? '' : 'http://localhost:8000';
const browserWsDefault =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    : 'ws://localhost:8000';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || browserApiDefault;

export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || browserWsDefault;

/**
 * For HTTPS/WSS (production):
 * - Set NEXT_PUBLIC_API_URL=https://api.example.com
 * - Set NEXT_PUBLIC_WS_URL=wss://api.example.com
 */
