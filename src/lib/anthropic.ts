import Anthropic from "@anthropic-ai/sdk";

/**
 * The API key lives here, server-side, and is never sent to the browser.
 * That is the main reason this app has a backend at all.
 */

export const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingKeyError();
  }
  client ??= new Anthropic();
  return client;
}

export class MissingKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add " +
        "a key from console.anthropic.com, then restart the server.",
    );
    this.name = "MissingKeyError";
  }
}

export interface ApiFailure {
  status: number;
  message: string;
}

/**
 * Turn an SDK exception into something a phone screen can show. Most-specific
 * first — collapsing these into one catch loses the retryable/not distinction.
 */
export function describeError(err: unknown): ApiFailure {
  if (err instanceof MissingKeyError) {
    return { status: 500, message: err.message };
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 500, message: "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY." };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "Rate limited by the API. Wait a moment and try again." };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 503, message: "Could not reach the Anthropic API. Check your connection." };
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 500;
    return { status, message: `Anthropic API error ${status}: ${err.message}` };
  }
  if (err instanceof Error) {
    return { status: 500, message: err.message };
  }
  return { status: 500, message: "Unknown error." };
}
