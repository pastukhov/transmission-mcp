import assert from "node:assert/strict";
import { TorrentIdSchema } from "../dist/schemas.js";
import { normalizeTorrentIds, formatStatsMarkdown } from "../dist/utils.js";

// TorrentIdSchema coercion and accepted values
{
  assert.equal(TorrentIdSchema.parse("5"), 5, "numeric strings should coerce to number");
  assert.deepEqual(TorrentIdSchema.parse(["1", "abc"]), [1, "abc"], "mixed numeric and hash strings allowed");
  assert.equal(TorrentIdSchema.parse("recently_active"), "recently_active", "recently_active passthrough");
  assert.equal(TorrentIdSchema.parse("abcd1234"), "abcd1234", "hash strings allowed");
}

// normalizeTorrentIds behavior
{
  assert.equal(normalizeTorrentIds("all"), undefined, "all -> undefined for Transmission");
  assert.equal(normalizeTorrentIds("recently_active"), "recently-active", "recently_active normalized to hyphenated");
  assert.deepEqual(normalizeTorrentIds(["1", "abc", 2]), [1, "abc", 2], "arrays coerce numeric strings");
  assert.deepEqual(normalizeTorrentIds("7"), [7], "string numeric coerces to number array");
}

// formatStatsMarkdown handles snake/camel variants
{
  const markdown = formatStatsMarkdown({
    active_torrent_count: 3,
    paused_torrent_count: 1,
    torrent_count: 4,
    download_speed: 1024,
    upload_speed: 2048,
    current_stats: {
      downloaded_bytes: 5120,
      uploaded_bytes: 1024,
      files_added: 2,
      seconds_active: 60,
      session_count: 1
    },
    cumulative_stats: {
      downloaded_bytes: 10240,
      uploaded_bytes: 4096,
      files_added: 4,
      seconds_active: 120,
      session_count: 2
    }
  });

  assert(markdown.includes("Active Torrents**: 3"), "active torrents reported");
  assert(markdown.includes("Download Speed**: 1.00 KB/s"), "download speed formatted");
  assert(markdown.includes("Uploaded**: 4.00 KB"), "cumulative uploaded formatted");
}
