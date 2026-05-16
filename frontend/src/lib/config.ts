/**
 * Configuration for API and WebSocket endpoints
 * Uses environment variables with sensible defaults for localhost development
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

/**
 * For HTTPS/WSS (production):
 * - Set NEXT_PUBLIC_API_URL=https://api.example.com
 * - Set NEXT_PUBLIC_WS_URL=wss://api.example.com
 */
