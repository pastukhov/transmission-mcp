/**
 * Constants for Transmission MCP Server
 */

// Maximum response size in characters to prevent overwhelming the LLM context
export const CHARACTER_LIMIT = 25000;

// Default Transmission RPC URL
export const DEFAULT_TRANSMISSION_URL = "http://localhost:9091";

// Pagination defaults
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Response format options
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

// Queue movement directions
export enum QueueDirection {
  TOP = "top",
  UP = "up",
  DOWN = "down",
  BOTTOM = "bottom"
}

// Torrent status codes (from Transmission RPC spec)
export enum TorrentStatus {
  STOPPED = 0,
  CHECK_WAIT = 1,
  CHECK = 2,
  DOWNLOAD_WAIT = 3,
  DOWNLOAD = 4,
  SEED_WAIT = 5,
  SEED = 6
}

// Torrent status labels for human-readable output
export const TorrentStatusLabels: Record<number, string> = {
  [TorrentStatus.STOPPED]: "Stopped",
  [TorrentStatus.CHECK_WAIT]: "Waiting to verify",
  [TorrentStatus.CHECK]: "Verifying",
  [TorrentStatus.DOWNLOAD_WAIT]: "Waiting to download",
  [TorrentStatus.DOWNLOAD]: "Downloading",
  [TorrentStatus.SEED_WAIT]: "Waiting to seed",
  [TorrentStatus.SEED]: "Seeding"
};
