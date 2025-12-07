import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../dist/index.js";
import { ResponseFormat } from "../dist/constants.js";

class MockTransmission {
  constructor() {
    this.calls = [];
    this.torrents = [{
      id: 1,
      name: "t1",
      status: 4,
      percent_done: 0.5,
      size_when_done: 1000,
      downloaded_ever: 500,
      uploaded_ever: 100,
      upload_ratio: 0.2,
      rate_download: 10,
      rate_upload: 5,
      eta: 60,
      peers_connected: 2,
      added_date: 1,
      done_date: 0,
      labels: ["tag"],
      error: 0,
      error_string: "",
      comment: "hello"
    }];
    this.session = {
      version: "4.1",
      download_dir: "/dl",
      speed_limit_down_enabled: false,
      speed_limit_up_enabled: false,
      seedRatioLimited: false
    };
    this.stats = {
      active_torrent_count: 2,
      paused_torrent_count: 1,
      torrent_count: 3,
      download_speed: 1000,
      upload_speed: 2000,
      current_stats: {
        downloaded_bytes: 5000,
        uploaded_bytes: 1000,
        files_added: 2,
        seconds_active: 60,
        session_count: 1
      },
      cumulative_stats: {
        downloaded_bytes: 10000,
        uploaded_bytes: 2000,
        files_added: 4,
        seconds_active: 120,
        session_count: 2
      }
    };
    this.freeBytes = 1024 * 1024;
  }

  record(method, params) {
    this.calls.push({ method, params });
  }

  async call({ method, params }) {
    this.record(method, params);
    switch (method) {
      case "torrent_add":
        return { torrents: [{ id: 3, name: "url", hashString: "h3" }] };
      case "torrent_get":
        return { torrents: this.torrents };
      case "torrent_set_location":
        return {};
      case "torrent_set":
        return {};
      case "torrent_stop":
      case "torrent_start":
      case "torrent_verify":
      case "torrent_reannounce":
      case "torrent_remove":
      case "queue_move_top":
      case "queue_move_up":
      case "queue_move_down":
      case "queue_move_bottom":
        return {};
      case "session_get":
        return this.session;
      case "session_set":
        return {};
      case "session_stats":
        return this.stats;
      case "free_space":
        return { size_bytes: this.freeBytes, path: params?.path || "/dl" };
      default:
        return {};
    }
  }
}

function handler(server, name) {
  return server._registeredTools[name].handler;
}

test("add torrent handles magnet, url, and base64", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const add = handler(server, "transmission_add_torrent");

  const resMagnet = await add({ torrent: "magnet:abc", response_format: ResponseFormat.JSON });
  assert.equal(mock.calls[0].method, "torrent_add");
  assert.equal(JSON.parse(resMagnet.content[0].text).id, 3);

  const resUrl = await add({ torrent: "http://example.com/file.torrent", response_format: ResponseFormat.JSON });
  const lastUrlCall = mock.calls.at(-1);
  assert.equal(lastUrlCall.method, "torrent_add");
  assert.equal(lastUrlCall.params.filename, "http://example.com/file.torrent");
  assert.equal(JSON.parse(resUrl.content[0].text).id, 3);

  const resBase64 = await add({ torrent: "Zm9vYmFy", response_format: ResponseFormat.JSON });
  const lastBase64Call = mock.calls.at(-1);
  assert.equal(lastBase64Call.method, "torrent_add");
  assert.equal(lastBase64Call.params.metainfo, "Zm9vYmFy");
  assert.equal(JSON.parse(resBase64.content[0].text).id, 3);
});

test("list torrents returns comments in json", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const list = handler(server, "transmission_list_torrents");
  const res = await list({ limit: 10, offset: 0, response_format: ResponseFormat.JSON });
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.torrents[0].comment, "hello");
});

test("get torrent uses normalized ids and handles empty", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const getTorrent = handler(server, "transmission_get_torrent");
  await getTorrent({ ids: "recently_active", response_format: ResponseFormat.JSON });
  assert.equal(mock.calls[0].params.ids, "recently-active");
});

test("remove, pause, resume, verify, reannounce use normalized ids", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);

  const remove = handler(server, "transmission_remove_torrent");
  await remove({ ids: ["1", "abc"], delete_local_data: true, response_format: ResponseFormat.JSON });
  assert.deepEqual(mock.calls[0].params.ids, [1, "abc"]);
  assert.equal(mock.calls[0].params.delete_local_data, true);

  await handler(server, "transmission_pause_torrent")({ ids: "2", response_format: ResponseFormat.JSON });
  await handler(server, "transmission_resume_torrent")({ ids: 3, response_format: ResponseFormat.JSON });
  await handler(server, "transmission_verify_torrent")({ ids: "all", response_format: ResponseFormat.JSON });
  await handler(server, "transmission_reannounce_torrent")({ ids: "recently_active", response_format: ResponseFormat.JSON });

  const methods = mock.calls.map(c => c.method);
  assert.ok(methods.includes("torrent_stop"));
  assert.ok(methods.includes("torrent_start"));
  assert.ok(methods.includes("torrent_verify"));
  assert.ok(methods.includes("torrent_reannounce"));
});

test("move torrent forwards move flag and omits ids for all", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const move = handler(server, "transmission_move_torrent");
  await move({ ids: "all", location: "/new", move: false, response_format: ResponseFormat.JSON });
  const call = mock.calls.find(c => c.method === "torrent_set_location");
  assert.equal(call.params.move, false);
  assert.ok(!("ids" in call.params));
});

test("set torrent forwards options", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const set = handler(server, "transmission_set_torrent");
  await set({
    ids: ["5"],
    labels: ["a"],
    bandwidthPriority: 1,
    downloadLimit: 10,
    downloadLimited: true,
    uploadLimit: 20,
    uploadLimited: true,
    seedRatioLimit: 2,
    seedRatioMode: 1,
    response_format: ResponseFormat.JSON
  });
  const call = mock.calls.find(c => c.method === "torrent_set");
  assert.deepEqual(call.params.ids, [5]);
  assert.deepEqual(call.params, {
    ids: [5],
    labels: ["a"],
    bandwidthPriority: 1,
    downloadLimit: 10,
    downloadLimited: true,
    uploadLimit: 20,
    uploadLimited: true,
    seedRatioLimit: 2,
    seedRatioMode: 1
  });
});

test("queue move selects correct direction", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  await handler(server, "transmission_queue_move")({ ids: [1, 2], direction: "top", response_format: ResponseFormat.JSON });
  const methods = mock.calls.map(c => c.method);
  assert.ok(methods.includes("queue_move_top"));
});

test("session get/set use snake_case fields", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const getSession = handler(server, "transmission_get_session");
  const setSession = handler(server, "transmission_set_session");

  await getSession({ response_format: ResponseFormat.JSON });
  assert.equal(mock.calls.find(c => c.method === "session_get").method, "session_get");

  await setSession({
    alt_speed_down: 10,
    alt_speed_up: 20,
    alt_speed_enabled: true,
    download_dir: "/tmp",
    speed_limit_down: 30,
    speed_limit_down_enabled: true,
    speed_limit_up: 40,
    speed_limit_up_enabled: true,
    seedRatioLimit: 1.5,
    seedRatioLimited: true,
    response_format: ResponseFormat.JSON
  });
  const call = mock.calls.find(c => c.method === "session_set");
  assert.deepEqual(call.params, {
    alt_speed_down: 10,
    alt_speed_up: 20,
    alt_speed_enabled: true,
    download_dir: "/tmp",
    speed_limit_down: 30,
    speed_limit_down_enabled: true,
    speed_limit_up: 40,
    speed_limit_up_enabled: true,
    seedRatioLimit: 1.5,
    seedRatioLimited: true
  });
});

test("session stats uses session-stats and snake_case output", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const stats = handler(server, "transmission_get_stats");
  const res = await stats({ response_format: ResponseFormat.JSON });
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(mock.calls.find(c => c.method === "session_stats").method, "session_stats");
  assert.equal(parsed.active_torrent_count, 2);
  assert.equal(parsed.current_stats.downloaded_bytes, 5000);
});

test("free space reports bytes and path", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const free = handler(server, "transmission_free_space");
  const res = await free({ path: "/data", response_format: ResponseFormat.JSON });
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.path, "/data");
  assert.equal(parsed.freeBytes, mock.freeBytes);
});
