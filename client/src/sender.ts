/**
 * Sender module for HTTP communication with the server.
 * Handles sending heartbeats and paste content with retry logic.
 *
 * @module sender
 */

import type {
  HeartbeatPayload,
  PasteContentRequest,
} from "../../shared/types.ts";

/** Options for the sender */
export interface SenderOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
}

/** Sender interface for sending data to the server */
export interface Sender {
  /** Send a heartbeat payload to the server */
  sendHeartbeat(payload: HeartbeatPayload): Promise<void>;
  /** Send paste content to the server */
  sendPasteContent(request: PasteContentRequest): Promise<void>;
}

/** Fetch function type for dependency injection */
export type FetchFn = (
  url: string | URL | Request,
  options?: RequestInit,
) => Promise<Response>;

/**
 * Create a sender for HTTP communication.
 *
 * @param baseUrl - Base URL of the server (e.g., "http://localhost:8000")
 * @param fetchFn - Fetch function for dependency injection (default: global fetch)
 * @param options - Sender options
 * @returns Sender instance
 */
export function createSender(
  baseUrl: string,
  fetchFn: FetchFn = globalThis.fetch,
  options: SenderOptions = {},
): Sender {
  const maxRetries = options.maxRetries ?? 3;

  /**
   * Send a request with retry logic and exponential backoff.
   * Retries up to maxRetries times on failure.
   */
  async function sendWithRetry(url: string, body: unknown): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          return;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  return {
    /** Send heartbeat payload to /api/heartbeat endpoint */
    async sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
      await sendWithRetry(`${baseUrl}/api/heartbeat`, payload);
    },

    /** Send paste content to /api/paste endpoint */
    async sendPasteContent(request: PasteContentRequest): Promise<void> {
      await sendWithRetry(`${baseUrl}/api/paste`, request);
    },
  };
}
