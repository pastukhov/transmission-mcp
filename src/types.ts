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
 * Torrent ID input (can be single ID/hash, array, or special selectors like "all" or "recently_active")
 */
export type TorrentIdInput = number | string | Array<number | string> | "all" | "recently_active";

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
  active_torrent_count: number;
  download_speed: number;
  upload_speed: number;
  paused_torrent_count: number;
  torrent_count: number;
  cumulative_stats?: {
    downloaded_bytes: number;
    uploaded_bytes: number;
    files_added: number;
    session_count: number;
    seconds_active: number;
  };
  current_stats?: {
    downloaded_bytes: number;
    uploaded_bytes: number;
    files_added: number;
    session_count: number;
    seconds_active: number;
  };
}

export interface RpcRequestOptions {
  method: string;
  params?: Record<string, any>;
}

export interface RpcResponse<T = any> {
  result?: T;
  error?: { code: number; message: string; data?: any };
}
