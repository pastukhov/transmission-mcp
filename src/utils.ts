/**
 * Utility functions for Transmission MCP Server
 */

import { TorrentStatusLabels, CHARACTER_LIMIT, ResponseFormat } from "./constants.js";
import { FormattedTorrent, SessionStats, TorrentIdInput } from "./types.js";

/**
 * Format bytes as human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format speed as human-readable rate
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Format duration in seconds as human-readable time
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return "Unknown";
  if (seconds === 0) return "0s";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && days === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * Format timestamp as ISO date string
 */
export function formatDate(timestamp: number): string {
  if (timestamp === 0) return "Never";
  return new Date(timestamp * 1000).toISOString().replace("T", " ").split(".")[0] + " UTC";
}

/**
 * Format torrent data as markdown
 */
export function formatTorrentMarkdown(torrent: any): string {
  const percentDone = torrent.percent_done ?? torrent.percentDone ?? torrent.percent_done ?? torrent.percentDone ?? 0;
  const sizeWhenDone = torrent.size_when_done ?? torrent.sizeWhenDone ?? 0;
  const downloadedEver = torrent.downloaded_ever ?? torrent.downloadedEver ?? 0;
  const uploadedEver = torrent.uploaded_ever ?? torrent.uploadedEver ?? 0;
  const uploadRatio = torrent.upload_ratio ?? torrent.uploadRatio ?? 0;
  const rateDownload = torrent.rate_download ?? torrent.rateDownload ?? 0;
  const rateUpload = torrent.rate_upload ?? torrent.rateUpload ?? 0;
  const peersConnected = torrent.peers_connected ?? torrent.peersConnected ?? 0;
  const addedDate = torrent.added_date ?? torrent.addedDate ?? 0;
  const doneDate = torrent.done_date ?? torrent.doneDate ?? 0;
  const labels = torrent.labels ?? [];
  const error = torrent.error ?? 0;
  const errorString = torrent.error_string ?? torrent.errorString;

  const lines: string[] = [];

  lines.push(`## ${torrent.name}`);
  lines.push("");
  lines.push(`- **ID**: ${torrent.id}`);
  lines.push(`- **Status**: ${TorrentStatusLabels[torrent.status] || "Unknown"}`);
  lines.push(`- **Progress**: ${(percentDone * 100).toFixed(2)}%`);
  lines.push(`- **Size**: ${formatBytes(sizeWhenDone)}`);
  lines.push(`- **Downloaded**: ${formatBytes(downloadedEver)}`);
  lines.push(`- **Uploaded**: ${formatBytes(uploadedEver)}`);
  lines.push(`- **Ratio**: ${uploadRatio.toFixed(2)}`);
  lines.push(`- **Download Speed**: ${formatSpeed(rateDownload)}`);
  lines.push(`- **Upload Speed**: ${formatSpeed(rateUpload)}`);

  if (torrent.eta > 0 && torrent.eta < 31536000) {
    lines.push(`- **ETA**: ${formatDuration(torrent.eta)}`);
  }

  lines.push(`- **Peers**: ${peersConnected}`);
  lines.push(`- **Added**: ${formatDate(addedDate)}`);

  if (doneDate && doneDate > 0) {
    lines.push(`- **Completed**: ${formatDate(doneDate)}`);
  }

  if (labels && labels.length > 0) {
    lines.push(`- **Labels**: ${labels.join(", ")}`);
  }

  if (error !== 0 && errorString) {
    lines.push(`- **Error**: ${errorString}`);
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Format multiple torrents as markdown
 */
export function formatTorrentsMarkdown(torrents: any[], total?: number): string {
  const lines: string[] = ["# Torrents"];
  lines.push("");

  if (total !== undefined) {
    lines.push(`Total: ${total} torrent(s)`);
    lines.push("");
  }

  if (torrents.length === 0) {
    lines.push("No torrents found.");
    return lines.join("\n");
  }

  for (const torrent of torrents) {
    lines.push(formatTorrentMarkdown(torrent).trim());
  }

  return lines.join("\n");
}

/**
 * Format torrent data as JSON
 */
export function formatTorrentJSON(torrent: any): any {
  const percentDone = torrent.percent_done ?? torrent.percentDone ?? 0;
  const sizeWhenDone = torrent.size_when_done ?? torrent.sizeWhenDone ?? 0;
  const downloadedEver = torrent.downloaded_ever ?? torrent.downloadedEver ?? 0;
  const uploadedEver = torrent.uploaded_ever ?? torrent.uploadedEver ?? 0;
  const uploadRatio = torrent.upload_ratio ?? torrent.uploadRatio ?? 0;
  const rateDownload = torrent.rate_download ?? torrent.rateDownload ?? 0;
  const rateUpload = torrent.rate_upload ?? torrent.rateUpload ?? 0;
  const eta = torrent.eta ?? torrent.etaIdle ?? torrent.eta_idl ?? torrent.eta_idle ?? torrent.eta; // best effort
  const peersConnected = torrent.peers_connected ?? torrent.peersConnected ?? 0;
  const addedDate = torrent.added_date ?? torrent.addedDate ?? 0;
  const doneDate = torrent.done_date ?? torrent.doneDate ?? null;
  const labels = torrent.labels ?? [];
  const error = torrent.error ?? 0;
  const errorString = torrent.error_string ?? torrent.errorString ?? null;

  return {
    id: torrent.id,
    name: torrent.name,
    comment: torrent.comment || null,
    status: TorrentStatusLabels[torrent.status] || "Unknown",
    statusCode: torrent.status,
    percentDone,
    sizeWhenDone,
    downloadedEver,
    uploadedEver,
    uploadRatio,
    rateDownload,
    rateUpload,
    eta,
    peersConnected,
    addedDate,
    doneDate,
    labels,
    error,
    errorString
  };
}

/**
 * Format session data as markdown
 */
export function formatSessionMarkdown(session: any): string {
  const lines: string[] = ["# Session Configuration"];
  lines.push("");

  lines.push("## General");
  lines.push(`- **Version**: ${session.version || "Unknown"}`);
  lines.push(`- **Download Directory**: ${session["download-dir"] || "Not set"}`);
  lines.push("");

  lines.push("## Speed Limits");
  lines.push(`- **Download Limit**: ${session["speed-limit-down-enabled"] ? `${session["speed-limit-down"]} KB/s` : "Unlimited"}`);
  lines.push(`- **Upload Limit**: ${session["speed-limit-up-enabled"] ? `${session["speed-limit-up"]} KB/s` : "Unlimited"}`);
  lines.push(`- **Alt Speed Enabled**: ${session["alt-speed-enabled"] ? "Yes" : "No"}`);

  if (session["alt-speed-enabled"]) {
    lines.push(`- **Alt Download Limit**: ${session["alt-speed-down"]} KB/s`);
    lines.push(`- **Alt Upload Limit**: ${session["alt-speed-up"]} KB/s`);
  }
  lines.push("");

  lines.push("## Seeding");
  lines.push(`- **Seed Ratio Limit**: ${session["seedRatioLimited"] ? session["seedRatioLimit"] : "Unlimited"}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format session statistics as markdown
 */
export function formatStatsMarkdown(stats: any): string {
  const activeTorrentCount = stats.active_torrent_count ?? stats.activeTorrentCount ?? 0;
  const pausedTorrentCount = stats.paused_torrent_count ?? stats.pausedTorrentCount ?? 0;
  const torrentCount = stats.torrent_count ?? stats.torrentCount ?? 0;
  const downloadSpeed = stats.download_speed ?? stats.downloadSpeed ?? 0;
  const uploadSpeed = stats.upload_speed ?? stats.uploadSpeed ?? 0;
  const currentStats = stats.current_stats ?? stats["current-stats"] ?? stats.currentStats;
  const cumulativeStats = stats.cumulative_stats ?? stats["cumulative-stats"] ?? stats.cumulativeStats;

  const lines: string[] = ["# Session Statistics"];
  lines.push("");

  lines.push("## Current Session");
  lines.push(`- **Active Torrents**: ${activeTorrentCount}`);
  lines.push(`- **Paused Torrents**: ${pausedTorrentCount}`);
  lines.push(`- **Total Torrents**: ${torrentCount}`);
  lines.push(`- **Download Speed**: ${formatSpeed(downloadSpeed)}`);
  lines.push(`- **Upload Speed**: ${formatSpeed(uploadSpeed)}`);
  lines.push("");

  if (currentStats) {
    const current = currentStats;
    lines.push("## Current Session Totals");
    lines.push(`- **Downloaded**: ${formatBytes(current.downloaded_bytes ?? current.downloadedBytes)}`);
    lines.push(`- **Uploaded**: ${formatBytes(current.uploaded_bytes ?? current.uploadedBytes)}`);
    lines.push(`- **Files Added**: ${current.files_added ?? current.filesAdded}`);
    lines.push(`- **Session Duration**: ${formatDuration(current.seconds_active ?? current.secondsActive)}`);
    lines.push("");
  }

  if (cumulativeStats) {
    const cumulative = cumulativeStats;
    lines.push("## All-Time Totals");
    lines.push(`- **Downloaded**: ${formatBytes(cumulative.downloaded_bytes ?? cumulative.downloadedBytes)}`);
    lines.push(`- **Uploaded**: ${formatBytes(cumulative.uploaded_bytes ?? cumulative.uploadedBytes)}`);
    lines.push(`- **Files Added**: ${cumulative.files_added ?? cumulative.filesAdded}`);
    lines.push(`- **Total Active Time**: ${formatDuration(cumulative.seconds_active ?? cumulative.secondsActive)}`);
    lines.push(`- **Sessions**: ${cumulative.session_count ?? cumulative.sessionCount}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Check if response exceeds character limit and truncate if needed
 */
export function checkAndTruncate(
  content: string,
  itemCount: number,
  itemType: string = "items"
): { content: string; truncated: boolean; message?: string } {
  if (content.length <= CHARACTER_LIMIT) {
    return { content, truncated: false };
  }

  // Truncate to CHARACTER_LIMIT
  const truncatedContent = content.substring(0, CHARACTER_LIMIT);
  const truncationMessage = `\n\n---\n**Response truncated** (exceeded ${CHARACTER_LIMIT} character limit). ` +
    `Try using pagination with 'offset' parameter or filtering to see more ${itemType}.`;

  return {
    content: truncatedContent + truncationMessage,
    truncated: true,
    message: `Response truncated from ${itemCount} ${itemType}`
  };
}

/**
 * Normalize torrent IDs for API calls
 */
export function normalizeTorrentIds(ids: TorrentIdInput): Array<number | string> | string | undefined {
  if (ids === "all") {
    return undefined; // Transmission API uses undefined for "all"
  }

  if (ids === "recently_active" || ids === "recently-active") {
    return "recently-active"; // Transmission expects hyphenated form
  }

  if (Array.isArray(ids)) {
    return ids.map((id) => {
      if (id === "recently_active" || id === "recently-active") return "recently-active";
      if (typeof id === "string" && /^\d+$/.test(id)) return Number(id);
      return id;
    });
  }

  if (typeof ids === "string" && /^\d+$/.test(ids)) {
    return [Number(ids)];
  }

  return [ids];
}

/**
 * Handle errors from Transmission API
 */
export function handleTransmissionError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Connection errors
    if (message.includes("econnrefused") || message.includes("connection refused")) {
      return "Error: Could not connect to Transmission daemon. " +
        "Please check that Transmission is running and the URL is correct. " +
        "Verify TRANSMISSION_URL environment variable.";
    }

    // Authentication errors
    if (message.includes("401") || message.includes("unauthorized")) {
      return "Error: Authentication failed. " +
        "Please check TRANSMISSION_USERNAME and TRANSMISSION_PASSWORD environment variables.";
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("etimedout")) {
      return "Error: Request timed out. " +
        "The Transmission daemon may be unresponsive or overloaded.";
    }

    // Generic error with message
    return `Error: ${error.message}`;
  }

  return `Error: An unexpected error occurred: ${String(error)}`;
}

/**
 * Create tool response
 */
export function createToolResponse(text: string): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{
      type: "text" as const,
      text
    }]
  };
}

/**
 * Create error response
 */
export function createErrorResponse(error: unknown): { content: Array<{ type: "text"; text: string }>; isError: boolean } {
  return {
    isError: true,
    content: [{
      type: "text" as const,
      text: handleTransmissionError(error)
    }]
  };
}
