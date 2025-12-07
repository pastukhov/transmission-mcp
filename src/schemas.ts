/**
 * Zod validation schemas for Transmission MCP Server
 */

import { z } from "zod";
import { ResponseFormat, QueueDirection, DEFAULT_LIMIT, MAX_LIMIT } from "./constants.js";

// Response format schema
export const ResponseFormatSchema = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

// Pagination schemas
export const LimitSchema = z.number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .default(DEFAULT_LIMIT)
  .describe(`Maximum results to return (1-${MAX_LIMIT})`);

export const OffsetSchema = z.number()
  .int()
  .min(0)
  .default(0)
  .describe("Number of results to skip for pagination");

// Torrent ID schemas
export const TorrentIdSchema = z.preprocess((value) => {
  // Accept numeric strings and string arrays by coercing to numbers; allow hash strings and recently_active.
  if (value === "all" || value === "recently_active" || value === "recently-active") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" && /^\d+$/.test(item) ? Number(item) : item));
  }
  return value;
}, z.union([
  z.number().int().positive(),
  z.string().min(1),
  z.array(z.union([z.number().int().positive(), z.string().min(1)])),
  z.literal("all"),
  z.literal("recently_active")
])).describe("Torrent ID(s) to operate on - can be a single ID, hash string, array of IDs, or 'all'");

// Tool input schemas

export const AddTorrentSchema = z.object({
  torrent: z.string()
    .min(1, "Torrent must not be empty")
    .describe("Magnet URI, URL to .torrent file, or base64-encoded .torrent file content"),
  download_dir: z.string().optional()
    .describe("Destination path for downloaded files"),
  paused: z.boolean().optional()
    .describe("If true, torrent will be added in paused state"),
  labels: z.array(z.string()).optional()
    .describe("Labels to apply to the torrent"),
  response_format: ResponseFormatSchema
}).strict();

export const ListTorrentsSchema = z.object({
  limit: LimitSchema,
  offset: OffsetSchema,
  response_format: ResponseFormatSchema
}).strict();

export const GetTorrentSchema = z.object({
  ids: TorrentIdSchema,
  response_format: ResponseFormatSchema
}).strict();

export const RemoveTorrentSchema = z.object({
  ids: TorrentIdSchema,
  delete_local_data: z.boolean()
    .default(false)
    .describe("If true, downloaded files will be deleted from disk"),
  response_format: ResponseFormatSchema
}).strict();

export const PauseTorrentSchema = z.object({
  ids: TorrentIdSchema,
  response_format: ResponseFormatSchema
}).strict();

export const ResumeTorrentSchema = z.object({
  ids: TorrentIdSchema,
  response_format: ResponseFormatSchema
}).strict();

export const VerifyTorrentSchema = z.object({
  ids: TorrentIdSchema,
  response_format: ResponseFormatSchema
}).strict();

export const ReannounceTorrentSchema = z.object({
  ids: TorrentIdSchema,
  response_format: ResponseFormatSchema
}).strict();

export const MoveTorrentSchema = z.object({
  ids: TorrentIdSchema,
  location: z.string()
    .min(1, "Location path must not be empty")
    .describe("New location path for the torrent data"),
  move: z.boolean()
    .default(true)
    .describe("If true, move from previous location; if false, search new location for files"),
  response_format: ResponseFormatSchema
}).strict();

export const SetTorrentSchema = z.object({
  ids: TorrentIdSchema,
  labels: z.array(z.string()).optional()
    .describe("Labels for the torrent"),
  bandwidthPriority: z.number().int().min(-1).max(1).optional()
    .describe("Priority: -1 (low), 0 (normal), 1 (high)"),
  downloadLimit: z.number().int().min(0).optional()
    .describe("Maximum download speed in KB/s"),
  downloadLimited: z.boolean().optional()
    .describe("Enable download speed limit"),
  uploadLimit: z.number().int().min(0).optional()
    .describe("Maximum upload speed in KB/s"),
  uploadLimited: z.boolean().optional()
    .describe("Enable upload speed limit"),
  seedRatioLimit: z.number().min(0).optional()
    .describe("Torrent-specific seed ratio limit"),
  seedRatioMode: z.number().int().min(0).max(2).optional()
    .describe("Seed ratio mode: 0 (global), 1 (torrent), 2 (unlimited)"),
  response_format: ResponseFormatSchema
}).strict();

export const QueueMoveSchema = z.object({
  ids: TorrentIdSchema,
  direction: z.nativeEnum(QueueDirection)
    .describe("Direction to move: 'top', 'up', 'down', or 'bottom'"),
  response_format: ResponseFormatSchema
}).strict();

export const GetSessionSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export const SetSessionSchema = z.object({
  alt_speed_down: z.number().int().min(0).optional()
    .describe("Alternative download speed limit in KB/s"),
  alt_speed_up: z.number().int().min(0).optional()
    .describe("Alternative upload speed limit in KB/s"),
  alt_speed_enabled: z.boolean().optional()
    .describe("Enable alternative speed limits"),
  download_dir: z.string().optional()
    .describe("Default download directory"),
  speed_limit_down: z.number().int().min(0).optional()
    .describe("Regular download speed limit in KB/s"),
  speed_limit_down_enabled: z.boolean().optional()
    .describe("Enable download speed limit"),
  speed_limit_up: z.number().int().min(0).optional()
    .describe("Regular upload speed limit in KB/s"),
  speed_limit_up_enabled: z.boolean().optional()
    .describe("Enable upload speed limit"),
  seedRatioLimit: z.number().min(0).optional()
    .describe("Global seed ratio limit"),
  seedRatioLimited: z.boolean().optional()
    .describe("Enable global seed ratio limit"),
  response_format: ResponseFormatSchema
}).strict();

export const GetStatsSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export const FreeSpaceSchema = z.object({
  path: z.string().optional()
    .describe("Path to check free space for (defaults to download directory)"),
  response_format: ResponseFormatSchema
}).strict();

// Type exports
export type AddTorrentInput = z.infer<typeof AddTorrentSchema>;
export type ListTorrentsInput = z.infer<typeof ListTorrentsSchema>;
export type GetTorrentInput = z.infer<typeof GetTorrentSchema>;
export type RemoveTorrentInput = z.infer<typeof RemoveTorrentSchema>;
export type PauseTorrentInput = z.infer<typeof PauseTorrentSchema>;
export type ResumeTorrentInput = z.infer<typeof ResumeTorrentSchema>;
export type VerifyTorrentInput = z.infer<typeof VerifyTorrentSchema>;
export type ReannounceTorrentInput = z.infer<typeof ReannounceTorrentSchema>;
export type MoveTorrentInput = z.infer<typeof MoveTorrentSchema>;
export type SetTorrentInput = z.infer<typeof SetTorrentSchema>;
export type QueueMoveInput = z.infer<typeof QueueMoveSchema>;
export type GetSessionInput = z.infer<typeof GetSessionSchema>;
export type SetSessionInput = z.infer<typeof SetSessionSchema>;
export type GetStatsInput = z.infer<typeof GetStatsSchema>;
export type FreeSpaceInput = z.infer<typeof FreeSpaceSchema>;
