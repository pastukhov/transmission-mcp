#!/usr/bin/env node
/**
 * Transmission MCP Server
 *
 * Model Context Protocol server for Transmission BitTorrent client.
 * Provides tools to manage torrents, control download queues, and configure
 * the Transmission daemon.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ResponseFormat, QueueDirection, DEFAULT_TRANSMISSION_URL } from "./constants.js";
import {
  AddTorrentSchema,
  ListTorrentsSchema,
  GetTorrentSchema,
  RemoveTorrentSchema,
  PauseTorrentSchema,
  ResumeTorrentSchema,
  VerifyTorrentSchema,
  ReannounceTorrentSchema,
  MoveTorrentSchema,
  SetTorrentSchema,
  QueueMoveSchema,
  GetSessionSchema,
  SetSessionSchema,
  GetStatsSchema,
  FreeSpaceSchema,
  type AddTorrentInput,
  type ListTorrentsInput,
  type GetTorrentInput,
  type RemoveTorrentInput,
  type PauseTorrentInput,
  type ResumeTorrentInput,
  type VerifyTorrentInput,
  type ReannounceTorrentInput,
  type MoveTorrentInput,
  type SetTorrentInput,
  type QueueMoveInput,
  type GetSessionInput,
  type SetSessionInput,
  type GetStatsInput,
  type FreeSpaceInput
} from "./schemas.js";
import { type TransmissionConfig } from "./types.js";
import {
  formatTorrentMarkdown,
  formatTorrentsMarkdown,
  formatTorrentJSON,
  formatSessionMarkdown,
  formatStatsMarkdown,
  formatBytes,
  normalizeTorrentIds,
  checkAndTruncate,
  createToolResponse,
  createErrorResponse
} from "./utils.js";
import { TransmissionRpcClient } from "./rpcClient.js";

// Factories exported for testing
export function createTransmissionClient(config: TransmissionConfig = {
  baseUrl: process.env.TRANSMISSION_URL || DEFAULT_TRANSMISSION_URL,
  username: process.env.TRANSMISSION_USERNAME,
  password: process.env.TRANSMISSION_PASSWORD
}) {
  return new TransmissionRpcClient({
    baseUrl: config.baseUrl,
    username: config.username,
    password: config.password
  });
}

export function createServer(transmission: TransmissionRpcClient) {
  const server = new McpServer({
    name: "transmission-mcp-server",
    version: "1.0.0"
  });

/**
 * Tool 1: Add Torrent
 */
server.registerTool(
  "transmission_add_torrent",
  {
    title: "Add Torrent to Transmission",
    description: `Add a new torrent to Transmission from a magnet URI, HTTP(S) URL, or base64-encoded .torrent file.

This tool adds torrents to the Transmission download queue. It supports multiple input formats and allows configuration of download location, initial state, and labels.

Args:
  - torrent (string): Magnet URI (magnet:?...), HTTP(S) URL to .torrent file, or base64-encoded .torrent file content
  - download_dir (string, optional): Destination directory for downloaded files
  - paused (boolean, optional): If true, add torrent in paused state (default: false)
  - labels (string[], optional): Array of labels to apply to the torrent
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: { id: number, name: string, hashString: string }
  For Markdown format: Human-readable confirmation with torrent details

Examples:
  - Use when: "Add this magnet link to downloads" -> params with magnet URI
  - Use when: "Download torrent from URL and label it 'movies'" -> params with URL and labels
  - Don't use when: You need to search for torrents (this only adds existing torrent files/magnets)

Error Handling:
  - Returns "Error: Could not connect to Transmission daemon" if connection fails
  - Returns "Torrent added successfully" on success with torrent details`,
    inputSchema: AddTorrentSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: AddTorrentInput) => {
    try {
      const options: any = {};

      if (params.download_dir) {
        options["download-dir"] = params.download_dir;
      }
      if (params.paused !== undefined) {
        options.paused = params.paused;
      }
      if (params.labels && params.labels.length > 0) {
        options.labels = params.labels;
      }

      // Determine if it's a magnet URI, URL, or base64 content
      let result: any;
      if (params.torrent.startsWith("magnet:")) {
        result = await transmission.call({
          method: "torrent_add",
          params: {
            download_dir: "/downloads",
            paused: false,
            ...options,
            filename: params.torrent
          }
        });
      } else if (/^https?:\/\//i.test(params.torrent)) {
        result = await transmission.call({
          method: "torrent_add",
          params: {
            download_dir: "/downloads",
            paused: false,
            ...options,
            filename: params.torrent
          }
        });
      } else {
        result = await transmission.call({
          method: "torrent_add",
          params: {
            download_dir: "/downloads",
            paused: false,
            ...options,
            metainfo: params.torrent
          }
        });
      }

      const torrent = result?.torrents?.[0] || result?.["torrent-added"] || result?.["torrent-duplicate"];

      if (!torrent) {
        return createToolResponse("Error: Failed to add torrent. No response from Transmission.");
      }

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          id: torrent.id,
          name: torrent.name,
          hashString: torrent.hashString
        }, null, 2);
        return createToolResponse(result);
      }

      // Markdown format
      const lines = [
        "# Torrent Added Successfully",
        "",
        `- **Name**: ${torrent.name}`,
        `- **ID**: ${torrent.id}`,
        `- **Hash**: ${torrent.hashString}`,
        ""
      ];

      return createToolResponse(lines.join("\n"));

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 2: List Torrents
 */
server.registerTool(
  "transmission_list_torrents",
  {
    title: "List All Torrents",
    description: `List all torrents in Transmission with their current status and statistics.

This tool retrieves a list of all torrents with detailed information including download progress, speeds, ratios, and peer connections. Supports pagination for large torrent lists.

Args:
  - limit (number): Maximum torrents to return, between 1-100 (default: 20)
  - offset (number): Number of torrents to skip for pagination (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: { total: number, count: number, offset: number, torrents: [...], has_more: boolean, next_offset?: number }
  For Markdown format: Human-readable list with status, progress, speeds, and statistics

Examples:
  - Use when: "Show me all my torrents"
  - Use when: "List the next 50 torrents" -> params with limit=50, offset=50
  - Use when: "What's downloading right now?"

Error Handling:
  - Returns "No torrents found" if list is empty
  - Handles pagination automatically with has_more indicator`,
    inputSchema: ListTorrentsSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListTorrentsInput) => {
    try {
      const response = await transmission.call<{ torrents: any[] }>({
        method: "torrent_get",
        params: {
          fields: [
            "id", "name", "status", "percent_done", "percentDone",
            "size_when_done", "sizeWhenDone", "downloaded_ever", "downloadedEver",
            "uploaded_ever", "uploadedEver", "upload_ratio", "uploadRatio",
            "rate_download", "rateUpload", "eta", "peers_connected", "peersConnected",
            "added_date", "addedDate", "done_date", "doneDate", "labels",
            "error", "error_string", "errorString", "comment"
          ]
        }
      });
      const allTorrents = response?.torrents || [];
      const total = allTorrents.length;

      // Apply pagination
      const start = params.offset;
      const end = start + params.limit;
      const torrents = allTorrents.slice(start, end);

      if (params.response_format === ResponseFormat.JSON) {
        const result: any = {
          total,
          count: torrents.length,
          offset: params.offset,
          torrents: torrents.map((t: any) => formatTorrentJSON(t))
        };

        if (end < total) {
          result.has_more = true;
          result.next_offset = end;
        } else {
          result.has_more = false;
        }

        const jsonStr = JSON.stringify(result, null, 2);
        const truncated = checkAndTruncate(jsonStr, torrents.length, "torrents");
        return createToolResponse(truncated.content);
      }

      // Markdown format
      let markdown = formatTorrentsMarkdown(torrents, total);

      if (end < total) {
        markdown += `\n\n---\n**Showing ${torrents.length} of ${total} torrents.** ` +
          `Use offset=${end} to see the next page.`;
      }

      const truncated = checkAndTruncate(markdown, torrents.length, "torrents");
      return createToolResponse(truncated.content);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 3: Get Torrent Details
 */
server.registerTool(
  "transmission_get_torrent",
  {
    title: "Get Torrent Details",
    description: `Get detailed information about specific torrent(s) by ID.

This tool retrieves comprehensive information about one or more torrents, including status, progress, files, trackers, and peer information.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) - single ID, array of IDs, or 'all' for all torrents
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Detailed torrent information including:
  - Name, status, and progress
  - Size and download/upload statistics
  - Speed and ETA
  - Peer connections
  - Labels and error messages (if any)

Examples:
  - Use when: "Show me details for torrent ID 5" -> params with ids=5
  - Use when: "Get info for torrents 1, 2, and 3" -> params with ids=[1, 2, 3]
  - Use when: "Show all torrent details" -> params with ids='all'

Error Handling:
  - Returns "No torrents found matching the specified IDs" if IDs don't exist
  - Returns error message if connection fails`,
    inputSchema: GetTorrentSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetTorrentInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);
      const response = await transmission.call<{ torrents: any[] }>({
        method: "torrent_get",
        params: {
          ids,
          fields: ["id", "name", "status", "percent_done", "percentDone", "size_when_done", "sizeWhenDone", "downloaded_ever", "downloadedEver", "uploaded_ever", "uploadedEver", "upload_ratio", "uploadRatio", "rate_download", "rateUpload", "eta", "peers_connected", "peersConnected", "added_date", "addedDate", "done_date", "doneDate", "labels", "error", "error_string", "errorString", "comment"]
        }
      });
      const torrents = response?.torrents || [];

      if (torrents.length === 0) {
        return createToolResponse("No torrents found matching the specified IDs.");
      }

      if (params.response_format === ResponseFormat.JSON) {
        const result = {
          count: torrents.length,
          torrents: torrents.map((t: any) => formatTorrentJSON(t))
        };

        const jsonStr = JSON.stringify(result, null, 2);
        const truncated = checkAndTruncate(jsonStr, torrents.length, "torrents");
        return createToolResponse(truncated.content);
      }

      // Markdown format
      const markdown = formatTorrentsMarkdown(torrents);
      const truncated = checkAndTruncate(markdown, torrents.length, "torrents");
      return createToolResponse(truncated.content);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 4: Remove Torrent
 */
server.registerTool(
  "transmission_remove_torrent",
  {
    title: "Remove Torrent",
    description: `Remove torrent(s) from Transmission, with optional deletion of downloaded files.

This tool removes torrents from the Transmission queue. By default, it only removes the torrent from the queue and keeps the downloaded files on disk. Set delete_local_data=true to also delete the files.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) to remove
  - delete_local_data (boolean): If true, delete downloaded files from disk (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation message indicating which torrents were removed

Examples:
  - Use when: "Remove torrent 5 but keep the files" -> params with ids=5, delete_local_data=false
  - Use when: "Delete torrent 3 and all its files" -> params with ids=3, delete_local_data=true
  - Use when: "Remove all torrents" -> params with ids='all'
  - Don't use when: You want to pause a torrent (use transmission_pause_torrent instead)

Error Handling:
  - Returns error if torrent IDs don't exist
  - Confirms successful removal with file deletion status`,
    inputSchema: RemoveTorrentSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: RemoveTorrentInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);
      await transmission.call({
        method: "torrent_remove",
        params: {
          ids,
          delete_local_data: params.delete_local_data
        }
      });

      const idsStr = params.ids === "all" ? "all torrents" :
        Array.isArray(params.ids) ? `torrents ${params.ids.join(", ")}` :
        `torrent ${params.ids}`;

      const dataStr = params.delete_local_data ?
        " (including downloaded files)" :
        " (downloaded files kept on disk)";

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: `Removed ${idsStr}${dataStr}`,
          delete_local_data: params.delete_local_data
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse(`Successfully removed ${idsStr}${dataStr}.`);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 5: Pause Torrent
 */
server.registerTool(
  "transmission_pause_torrent",
  {
    title: "Pause Torrent",
    description: `Pause active torrent(s) to stop downloading/uploading.

This tool pauses torrents, stopping all download and upload activity. Paused torrents can be resumed later without losing progress.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) to pause
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation message indicating which torrents were paused

Examples:
  - Use when: "Pause torrent 5"
  - Use when: "Pause all torrents" -> params with ids='all'
  - Don't use when: You want to remove a torrent (use transmission_remove_torrent instead)

Error Handling:
  - Returns error if torrent IDs don't exist
  - Succeeds even if torrents are already paused (idempotent)`,
    inputSchema: PauseTorrentSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: PauseTorrentInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);
      await transmission.call({
        method: "torrent_stop",
        params: { ids }
      });

      const idsStr = params.ids === "all" ? "all torrents" :
        Array.isArray(params.ids) ? `torrents ${params.ids.join(", ")}` :
        `torrent ${params.ids}`;

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: `Paused ${idsStr}`
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse(`Successfully paused ${idsStr}.`);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 6: Resume Torrent
 */
server.registerTool(
  "transmission_resume_torrent",
  {
    title: "Resume Torrent",
    description: `Resume paused torrent(s) to restart downloading/uploading.

This tool resumes paused torrents, restarting download and upload activity from where they left off.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) to resume
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation message indicating which torrents were resumed

Examples:
  - Use when: "Resume torrent 5"
  - Use when: "Resume all torrents" -> params with ids='all'
  - Use when: "Start downloading again"

Error Handling:
  - Returns error if torrent IDs don't exist
  - Succeeds even if torrents are already active (idempotent)`,
    inputSchema: ResumeTorrentSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ResumeTorrentInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);
      await transmission.call({
        method: "torrent_start",
        params: { ids }
      });

      const idsStr = params.ids === "all" ? "all torrents" :
        Array.isArray(params.ids) ? `torrents ${params.ids.join(", ")}` :
        `torrent ${params.ids}`;

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: `Resumed ${idsStr}`
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse(`Successfully resumed ${idsStr}.`);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 7: Verify Torrent
 */
server.registerTool(
  "transmission_verify_torrent",
  {
    title: "Verify Torrent Data",
    description: `Verify the integrity of downloaded torrent data.

This tool triggers a verification check of torrent files against their checksums. Use this to ensure downloaded data is correct and complete, or to recheck files after moving them.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) to verify
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation that verification has been started

Examples:
  - Use when: "Verify torrent 5"
  - Use when: "Check if my download is corrupted"
  - Use when: "Recheck all torrents" -> params with ids='all'

Error Handling:
  - Returns error if torrent IDs don't exist
  - Verification runs in background; check torrent status to see results`,
    inputSchema: VerifyTorrentSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: VerifyTorrentInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);
      await transmission.call({
        method: "torrent_verify",
        params: { ids }
      });

      const idsStr = params.ids === "all" ? "all torrents" :
        Array.isArray(params.ids) ? `torrents ${params.ids.join(", ")}` :
        `torrent ${params.ids}`;

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: `Started verification for ${idsStr}`
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse(`Successfully started verification for ${idsStr}.`);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 8: Reannounce Torrent
 */
server.registerTool(
  "transmission_reannounce_torrent",
  {
    title: "Reannounce Torrent to Trackers",
    description: `Force torrent(s) to reannounce to their trackers.

This tool forces an immediate announcement to trackers, which can help update peer lists or fix connection issues. Normally, Transmission announces automatically at regular intervals.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) to reannounce
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation that reannounce request was sent

Examples:
  - Use when: "Update tracker for torrent 5"
  - Use when: "Not getting any peers, force an announce"
  - Use when: "Reannounce all torrents" -> params with ids='all'

Error Handling:
  - Returns error if torrent IDs don't exist
  - Success doesn't guarantee tracker response (depends on tracker availability)`,
    inputSchema: ReannounceTorrentSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: ReannounceTorrentInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);
      await transmission.call({
        method: "torrent_reannounce",
        params: { ids }
      });

      const idsStr = params.ids === "all" ? "all torrents" :
        Array.isArray(params.ids) ? `torrents ${params.ids.join(", ")}` :
        `torrent ${params.ids}`;

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: `Reannounced ${idsStr} to trackers`
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse(`Successfully reannounced ${idsStr} to trackers.`);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 9: Move Torrent
 */
server.registerTool(
  "transmission_move_torrent",
  {
    title: "Move Torrent to New Location",
    description: `Move torrent data files to a new location on disk.

This tool relocates torrent files to a different directory. By default, it moves the files physically. Set move=false to just update the path if files are already at the new location.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) to move
  - location (string): Destination directory path
  - move (boolean): If true, move files; if false, just update location (default: true)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation that move operation was initiated

Examples:
  - Use when: "Move torrent 5 to /downloads/completed"
  - Use when: "Change location of all torrents to /media/storage" -> params with ids='all'
  - Use when: "Update path for torrent 3 (files already moved)" -> params with move=false

Error Handling:
  - Returns error if destination path doesn't exist
  - Returns error if insufficient permissions
  - Move operation may take time for large files`,
    inputSchema: MoveTorrentSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: MoveTorrentInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);
      const args: any = {
        ids,
        move: params.move,
        location: params.location
      };

      if (args.ids === undefined) {
        delete args.ids; // Transmission treats omitted ids as "all"
      }

      await transmission.call({ method: "torrent_set_location", params: args });

      const idsStr = params.ids === "all" ? "all torrents" :
        Array.isArray(params.ids) ? `torrents ${params.ids.join(", ")}` :
        `torrent ${params.ids}`;

      const moveStr = params.move ? "moved" : "updated location for";

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: `Successfully ${moveStr} ${idsStr} to ${params.location}`,
          location: params.location,
          move: params.move
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse(`Successfully ${moveStr} ${idsStr} to ${params.location}.`);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 10: Set Torrent Properties
 */
server.registerTool(
  "transmission_set_torrent",
  {
    title: "Update Torrent Settings",
    description: `Update settings for specific torrent(s) including labels, speed limits, and seed ratios.

This tool modifies torrent-specific settings. You can update labels, bandwidth priorities, speed limits, and seeding behavior.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) to update
  - labels (string[], optional): Labels to apply
  - bandwidthPriority (number, optional): Priority: -1 (low), 0 (normal), 1 (high)
  - downloadLimit (number, optional): Download speed limit in KB/s
  - downloadLimited (boolean, optional): Enable download speed limit
  - uploadLimit (number, optional): Upload speed limit in KB/s
  - uploadLimited (boolean, optional): Enable upload speed limit
  - seedRatioLimit (number, optional): Torrent-specific seed ratio limit
  - seedRatioMode (number, optional): 0 (use global), 1 (use torrent), 2 (unlimited)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation of updated settings

Examples:
  - Use when: "Set torrent 5 label to 'movies'"
  - Use when: "Limit download speed to 500 KB/s for torrent 3"
  - Use when: "Set high priority for torrents 1 and 2"

Error Handling:
  - Returns error if torrent IDs don't exist
  - Validates numeric ranges for limits and priorities`,
    inputSchema: SetTorrentSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: SetTorrentInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);

      const options: any = {};
      if (params.labels !== undefined) options.labels = params.labels;
      if (params.bandwidthPriority !== undefined) options.bandwidthPriority = params.bandwidthPriority;
      if (params.downloadLimit !== undefined) options.downloadLimit = params.downloadLimit;
      if (params.downloadLimited !== undefined) options.downloadLimited = params.downloadLimited;
      if (params.uploadLimit !== undefined) options.uploadLimit = params.uploadLimit;
      if (params.uploadLimited !== undefined) options.uploadLimited = params.uploadLimited;
      if (params.seedRatioLimit !== undefined) options.seedRatioLimit = params.seedRatioLimit;
      if (params.seedRatioMode !== undefined) options.seedRatioMode = params.seedRatioMode;

      await transmission.call({
        method: "torrent_set",
        params: { ids, ...options }
      });

      const idsStr = params.ids === "all" ? "all torrents" :
        Array.isArray(params.ids) ? `torrents ${params.ids.join(", ")}` :
        `torrent ${params.ids}`;

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: `Updated settings for ${idsStr}`,
          settings: options
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse(`Successfully updated settings for ${idsStr}.`);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 11: Queue Move
 */
server.registerTool(
  "transmission_queue_move",
  {
    title: "Move Torrent in Queue",
    description: `Move torrent(s) to a different position in the download queue.

This tool reorders torrents in the download queue. Use this to prioritize certain downloads by moving them to the top or adjusting their position.

Args:
  - ids (number | number[] | 'all'): Torrent ID(s) to move
  - direction ('top' | 'up' | 'down' | 'bottom'): Where to move the torrent(s)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation of queue position change

Examples:
  - Use when: "Move torrent 5 to top of queue" -> params with direction='top'
  - Use when: "Move torrent 3 down in the queue" -> params with direction='down'
  - Use when: "Prioritize torrents 1 and 2" -> params with ids=[1, 2], direction='top'

Error Handling:
  - Returns error if torrent IDs don't exist
  - Moving to top/bottom is idempotent`,
    inputSchema: QueueMoveSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: QueueMoveInput) => {
    try {
      const ids = normalizeTorrentIds(params.ids);

      switch (params.direction) {
        case QueueDirection.TOP:
          await transmission.call({ method: "queue_move_top", params: { ids } });
          break;
        case QueueDirection.UP:
          await transmission.call({ method: "queue_move_up", params: { ids } });
          break;
        case QueueDirection.DOWN:
          await transmission.call({ method: "queue_move_down", params: { ids } });
          break;
        case QueueDirection.BOTTOM:
          await transmission.call({ method: "queue_move_bottom", params: { ids } });
          break;
      }

      const idsStr = params.ids === "all" ? "all torrents" :
        Array.isArray(params.ids) ? `torrents ${params.ids.join(", ")}` :
        `torrent ${params.ids}`;

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: `Moved ${idsStr} to ${params.direction} of queue`,
          direction: params.direction
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse(`Successfully moved ${idsStr} to ${params.direction} of queue.`);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 12: Get Session
 */
server.registerTool(
  "transmission_get_session",
  {
    title: "Get Session Configuration",
    description: `Get Transmission daemon configuration and settings.

This tool retrieves the current configuration of the Transmission daemon, including speed limits, download directory, and seeding settings.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Complete session configuration including:
  - Version information
  - Download directory
  - Speed limits (regular and alternative)
  - Seed ratio settings
  - Port and network configuration

Examples:
  - Use when: "Show Transmission settings"
  - Use when: "What's my download directory?"
  - Use when: "Check current speed limits"

Error Handling:
  - Returns error if cannot connect to Transmission daemon`,
    inputSchema: GetSessionSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetSessionInput) => {
    try {
      const session = await transmission.call({
        method: "session_get"
      });

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify(session, null, 2);
        const truncated = checkAndTruncate(result, 1, "session");
        return createToolResponse(truncated.content);
      }

      // Markdown format
      const markdown = formatSessionMarkdown(session);
      const truncated = checkAndTruncate(markdown, 1, "session");
      return createToolResponse(truncated.content);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 13: Set Session
 */
server.registerTool(
  "transmission_set_session",
  {
    title: "Update Session Configuration",
    description: `Update Transmission daemon configuration and settings.

This tool modifies the configuration of the Transmission daemon. You can update speed limits, download directory, seeding settings, and more.

Args:
  - alt_speed_down (number, optional): Alternative download speed limit in KB/s
  - alt_speed_up (number, optional): Alternative upload speed limit in KB/s
  - alt_speed_enabled (boolean, optional): Enable alternative speed limits
  - download_dir (string, optional): Default download directory
  - speed_limit_down (number, optional): Regular download speed limit in KB/s
  - speed_limit_down_enabled (boolean, optional): Enable download speed limit
  - speed_limit_up (number, optional): Regular upload speed limit in KB/s
  - speed_limit_up_enabled (boolean, optional): Enable upload speed limit
  - seedRatioLimit (number, optional): Global seed ratio limit
  - seedRatioLimited (boolean, optional): Enable global seed ratio limit
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Confirmation of updated settings

Examples:
  - Use when: "Set download speed limit to 1000 KB/s"
  - Use when: "Change download directory to /downloads"
  - Use when: "Enable alternative speed limits"

Error Handling:
  - Returns error if invalid settings provided
  - Changes take effect immediately`,
    inputSchema: SetSessionSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: SetSessionInput) => {
    try {
      const settings: any = {};

      if (params.alt_speed_down !== undefined) settings["alt_speed_down"] = params.alt_speed_down;
      if (params.alt_speed_up !== undefined) settings["alt_speed_up"] = params.alt_speed_up;
      if (params.alt_speed_enabled !== undefined) settings["alt_speed_enabled"] = params.alt_speed_enabled;
      if (params.download_dir !== undefined) settings["download_dir"] = params.download_dir;
      if (params.speed_limit_down !== undefined) settings["speed_limit_down"] = params.speed_limit_down;
      if (params.speed_limit_down_enabled !== undefined) settings["speed_limit_down_enabled"] = params.speed_limit_down_enabled;
      if (params.speed_limit_up !== undefined) settings["speed_limit_up"] = params.speed_limit_up;
      if (params.speed_limit_up_enabled !== undefined) settings["speed_limit_up_enabled"] = params.speed_limit_up_enabled;
      if (params.seedRatioLimit !== undefined) settings.seedRatioLimit = params.seedRatioLimit;
      if (params.seedRatioLimited !== undefined) settings.seedRatioLimited = params.seedRatioLimited;

      await transmission.call({
        method: "session_set",
        params: settings
      });

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          success: true,
          message: "Session settings updated successfully",
          settings
        }, null, 2);
        return createToolResponse(result);
      }

      return createToolResponse("Session settings updated successfully.");

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 14: Get Session Statistics
 */
server.registerTool(
  "transmission_get_stats",
  {
    title: "Get Session Statistics",
    description: `Get Transmission session statistics including current and cumulative data.

This tool retrieves statistics about the current and all-time Transmission usage, including download/upload totals, active torrents, and speeds.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Statistics including:
  - Current session: Active/paused torrents, current speeds
  - Session totals: Downloaded/uploaded bytes, files added, duration
  - All-time totals: Cumulative statistics across all sessions

Examples:
  - Use when: "Show me download statistics"
  - Use when: "How much have I downloaded total?"
  - Use when: "What's my current upload speed?"

Error Handling:
  - Returns error if cannot connect to Transmission daemon`,
    inputSchema: GetStatsSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetStatsInput) => {
    try {
      const stats: any = await transmission.call({ method: "session_stats" });

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          active_torrent_count: stats["active_torrent_count"] ?? stats["activeTorrentCount"] ?? 0,
          paused_torrent_count: stats["paused_torrent_count"] ?? stats["pausedTorrentCount"] ?? 0,
          torrent_count: stats["torrent_count"] ?? stats["torrentCount"] ?? 0,
          download_speed: stats["download_speed"] ?? stats["downloadSpeed"] ?? 0,
          upload_speed: stats["upload_speed"] ?? stats["uploadSpeed"] ?? 0,
          current_stats: stats["current_stats"] ?? stats["current-stats"],
          cumulative_stats: stats["cumulative_stats"] ?? stats["cumulative-stats"]
        }, null, 2);

        const truncated = checkAndTruncate(result, 1, "stats");
        return createToolResponse(truncated.content);
      }

      // Markdown format
      const markdown = formatStatsMarkdown(stats);
      const truncated = checkAndTruncate(markdown, 1, "stats");
      return createToolResponse(truncated.content);

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

/**
 * Tool 15: Check Free Space
 */
server.registerTool(
  "transmission_free_space",
  {
    title: "Check Free Disk Space",
    description: `Check available disk space at a given path.

This tool checks how much free space is available at the specified path. If no path is provided, it checks the default download directory.

Args:
  - path (string, optional): Path to check (defaults to download directory)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Available free space in bytes and human-readable format

Examples:
  - Use when: "How much disk space is available?"
  - Use when: "Check free space in /downloads" -> params with path="/downloads"
  - Use when: "Do I have enough space for more downloads?"

Error Handling:
  - Returns error if path doesn't exist or is not accessible`,
    inputSchema: FreeSpaceSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: FreeSpaceInput) => {
    try {
      const response = await transmission.call({
        method: "free_space",
        params: { path: params.path }
      });
      const freeBytes = response["size_bytes"] ?? response["size-bytes"];
      const path = response.path;

      if (params.response_format === ResponseFormat.JSON) {
        const result = JSON.stringify({
          path: path,
          freeBytes: freeBytes,
          freeSpace: formatBytes(freeBytes)
        }, null, 2);
        return createToolResponse(result);
      }

      // Markdown format
      const lines = [
        "# Free Disk Space",
        "",
        `- **Path**: ${path}`,
        `- **Free Space**: ${formatBytes(freeBytes)} (${freeBytes.toLocaleString()} bytes)`,
        ""
      ];

      return createToolResponse(lines.join("\n"));

    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

  return server;
}

/**
 * Main server initialization
 */
async function main() {
  const transmission = createTransmissionClient();

  // Verify Transmission connection configuration
  console.error(`Transmission MCP Server starting...`);
  console.error(`Connecting to: ${process.env.TRANSMISSION_URL || DEFAULT_TRANSMISSION_URL}`);
  if (!process.env.TRANSMISSION_USERNAME) {
    console.error("Note: No TRANSMISSION_USERNAME set (using unauthenticated connection)");
  }

  const server = createServer(transmission);

  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  console.error("Transmission MCP server running via stdio");
  console.error("Available tools: 15 (torrent management, queue control, session configuration)");
}

// Run the server when not skipped (allows clean imports in tests/CLIs)
if (!process.env.MCP_SKIP_MAIN) {
  main().catch((error) => {
    console.error("Fatal error starting server:", error);
    process.exit(1);
  });
}
