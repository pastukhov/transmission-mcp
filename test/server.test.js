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
      percentDone: 0.5,
      sizeWhenDone: 1000,
      downloadedEver: 500,
      uploadedEver: 100,
      uploadRatio: 0.2,
      rateDownload: 10,
      rateUpload: 5,
      eta: 60,
      peersConnected: 2,
      addedDate: 1,
      doneDate: 0,
      labels: ["tag"],
      error: 0,
      errorString: "",
      comment: "hello"
    }];
    this.session = {
      version: "4.1",
      "download-dir": "/dl",
      "speed-limit-down-enabled": false,
      "speed-limit-up-enabled": false,
      "seedRatioLimited": false
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

  record(method, args) {
    this.calls.push({ method, args });
  }

  addMagnet(url, options) {
    this.record("addMagnet", { url, options });
    return { arguments: { "torrent-added": { id: 1, name: "magnet", hashString: "h1" } } };
  }

  addTorrent(torrent, options) {
    this.record("addTorrent", { torrent, options });
    return { arguments: { "torrent-added": { id: 2, name: "file", hashString: "h2" } } };
  }

  request(method, args = {}) {
    this.record(method, args);
    if (method === "torrent-add") {
      return { arguments: { "torrent-added": { id: 3, name: "url", hashString: "h3" } } };
    }
    if (method === "session-stats") {
      return { _data: { arguments: this.stats } };
    }
    if (method === "torrent-set-location") {
      return { _data: { arguments: { ok: true } } };
    }
    return { _data: { arguments: {} } };
  }

  listTorrents(ids) {
    this.record("listTorrents", { ids });
    return { arguments: { torrents: this.torrents } };
  }

  removeTorrent(ids, deleteData) {
    this.record("removeTorrent", { ids, deleteData });
    return {};
  }

  pauseTorrent(ids) { this.record("pauseTorrent", { ids }); return {}; }
  resumeTorrent(ids) { this.record("resumeTorrent", { ids }); return {}; }
  verifyTorrent(ids) { this.record("verifyTorrent", { ids }); return {}; }
  reannounceTorrent(ids) { this.record("reannounceTorrent", { ids }); return {}; }
  moveTorrent(ids, location) { this.record("moveTorrent", { ids, location }); return { _data: { arguments: {} } }; }
  setTorrent(ids, options) { this.record("setTorrent", { ids, options }); return {}; }
  queueTop(ids) { this.record("queueTop", { ids }); return {}; }
  queueUp(ids) { this.record("queueUp", { ids }); return {}; }
  queueDown(ids) { this.record("queueDown", { ids }); return {}; }
  queueBottom(ids) { this.record("queueBottom", { ids }); return {}; }
  getSession() { this.record("getSession", {}); return { arguments: this.session }; }
  setSession(settings) { this.record("setSession", { settings }); return {}; }
  freeSpace(path) { this.record("freeSpace", { path }); return { arguments: { "size-bytes": this.freeBytes, path: path || "/dl" } }; }
}

function handler(server, name) {
  return server._registeredTools[name].handler;
}

test("add torrent handles magnet, url, and base64", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const add = handler(server, "transmission_add_torrent");

  const resMagnet = await add({ torrent: "magnet:abc", response_format: ResponseFormat.JSON });
  assert.equal(mock.calls[0].method, "addMagnet");
  assert.equal(JSON.parse(resMagnet.content[0].text).id, 1);

  const resUrl = await add({ torrent: "http://example.com/file.torrent", response_format: ResponseFormat.JSON });
  const lastUrlCall = mock.calls.at(-1);
  assert.equal(lastUrlCall.method, "torrent-add");
  assert.equal(lastUrlCall.args.filename, "http://example.com/file.torrent");
  assert.equal(JSON.parse(resUrl.content[0].text).id, 3);

  const resBase64 = await add({ torrent: "Zm9vYmFy", response_format: ResponseFormat.JSON });
  const lastBase64Call = mock.calls.at(-1);
  assert.equal(lastBase64Call.method, "addTorrent");
  assert.equal(JSON.parse(resBase64.content[0].text).id, 2);
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
  assert.equal(mock.calls[0].args.ids, "recently-active");
});

test("remove, pause, resume, verify, reannounce use normalized ids", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);

  const remove = handler(server, "transmission_remove_torrent");
  await remove({ ids: ["1", "abc"], delete_local_data: true, response_format: ResponseFormat.JSON });
  assert.deepEqual(mock.calls[0].args.ids, [1, "abc"]);
  assert.equal(mock.calls[0].args.deleteData, true);

  await handler(server, "transmission_pause_torrent")({ ids: "2", response_format: ResponseFormat.JSON });
  await handler(server, "transmission_resume_torrent")({ ids: 3, response_format: ResponseFormat.JSON });
  await handler(server, "transmission_verify_torrent")({ ids: "all", response_format: ResponseFormat.JSON });
  await handler(server, "transmission_reannounce_torrent")({ ids: "recently_active", response_format: ResponseFormat.JSON });

  const methods = mock.calls.map(c => c.method);
  assert.ok(methods.includes("pauseTorrent"));
  assert.ok(methods.includes("resumeTorrent"));
  assert.ok(methods.includes("verifyTorrent"));
  assert.ok(methods.includes("reannounceTorrent"));
});

test("move torrent forwards move flag and omits ids for all", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const move = handler(server, "transmission_move_torrent");
  await move({ ids: "all", location: "/new", move: false, response_format: ResponseFormat.JSON });
  const call = mock.calls.find(c => c.method === "torrent-set-location");
  assert.equal(call.args.move, false);
  assert.ok(!("ids" in call.args));
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
  const call = mock.calls.find(c => c.method === "setTorrent");
  assert.deepEqual(call.args.ids, [5]);
  assert.deepEqual(call.args.options, {
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
  assert.ok(methods.includes("queueTop"));
});

test("session get/set use snake_case fields", async () => {
  const mock = new MockTransmission();
  const server = createServer(mock);
  const getSession = handler(server, "transmission_get_session");
  const setSession = handler(server, "transmission_set_session");

  await getSession({ response_format: ResponseFormat.JSON });
  assert.equal(mock.calls.find(c => c.method === "getSession").method, "getSession");

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
  const call = mock.calls.find(c => c.method === "setSession");
  assert.deepEqual(call.args.settings, {
    "alt-speed-down": 10,
    "alt-speed-up": 20,
    "alt-speed-enabled": true,
    "download-dir": "/tmp",
    "speed-limit-down": 30,
    "speed-limit-down-enabled": true,
    "speed-limit-up": 40,
    "speed-limit-up-enabled": true,
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
  assert.equal(mock.calls.find(c => c.method === "session-stats").method, "session-stats");
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
