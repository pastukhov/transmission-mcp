/**
 * Type definitions for Transmission MCP Server
 */

import { ResponseFormat, QueueDirection } from "./constants.js";

/**
 * Transmission client configuration
 */
export interface TransmissionConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

/**
 * Common parameters for pagination
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Common parameters for response formatting
 */
export interface FormatParams {
  response_format?: ResponseFormat;
}

/**
 * Torrent ID input (can be single ID, array of IDs, or "all")
 */
export type TorrentIdInput = number | number[] | "all";

/**
 * Formatted torrent information for display
 */
export interface FormattedTorrent {
  id: number;
  name: string;
  status: string;
  percentDone: number;
  sizeWhenDone: number;
  uploadedEver: number;
  downloadedEver: number;
  uploadRatio: number;
  rateDownload: number;
  rateUpload: number;
  eta: number;
  peersConnected: number;
  addedDate: number;
  doneDate?: number;
  error?: number;
  errorString?: string;
  labels?: string[];
  [key: string]: any;
}

/**
 * Session statistics
 */
export interface SessionStats {
  activeTorrentCount: number;
  downloadSpeed: number;
  uploadSpeed: number;
  pausedTorrentCount: number;
  torrentCount: number;
  cumulative?: {
    downloadedBytes: number;
    uploadedBytes: number;
    filesAdded: number;
    sessionCount: number;
    secondsActive: number;
  };
  current?: {
    downloadedBytes: number;
    uploadedBytes: number;
    filesAdded: number;
    sessionCount: number;
    secondsActive: number;
  };
}
