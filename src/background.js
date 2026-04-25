const API_BASE =
  "https://grok.com/rest/assets?includeImagineFiles=true&mimeTypes=video%2Fmp4";

const DEFAULT_STATE = {
  assets: [],
  pages: 0,
  total: 0,
  index: 0,
  downloaded: 0,
  skipped: 0,
  failed: 0,
  running: false,
  paused: false,
  scanning: false,
  activeDownloadId: null,
  current: null,
  errors: [],
  folder: "grok-videos",
  updatedAt: null,
  startedAt: null,
  finishedAt: null
};

let startingNext = false;

async function getState() {
  const data = await chrome.storage.local.get(["state"]);
  return { ...DEFAULT_STATE, ...(data.state || {}) };
}

async function setState(patch) {
  const state = await getState();
  const next = {
    ...state,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ state: next });
  return next;
}

async function getDownloadedIds() {
  const data = await chrome.storage.local.get(["downloadedIds"]);
  return data.downloadedIds || {};
}

async function markDownloaded(id) {
  const downloadedIds = await getDownloadedIds();
  downloadedIds[id] = new Date().toISOString();
  await chrome.storage.local.set({ downloadedIds });
}

function assetUrl(asset) {
  if (asset.url) return asset.url;
  if (asset.downloadUrl) return asset.downloadUrl;
  if (asset.key) return `https://assets.grok.com/${asset.key}`;
  return "";
}

function cleanSegment(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function downloadFilename(asset, index, folder) {
  const safeFolder = cleanSegment(folder || "grok-videos") || "grok-videos";
  const safeId = cleanSegment(asset.id || asset.assetId || "unknown");
  const number = String(index + 1).padStart(4, "0");
  return `${safeFolder}/grok-video-${number}-${safeId}.mp4`;
}

function compactAsset(asset) {
  const id = asset.assetId || asset.id || "";
  return {
    id,
    url: assetUrl(asset),
    key: asset.key || "",
    name: asset.name || "generated_video.mp4",
    mimeType: asset.mimeType || "",
    sizeBytes: Number(asset.sizeBytes || 0),
    createTime: asset.createTime || "",
    fileSource: asset.fileSource || ""
  };
}

async function scanAssets() {
  await setState({
    scanning: true,
    running: false,
    paused: false,
    finishedAt: null,
    errors: []
  });

  const assets = [];
  const seen = new Set();
  let token = "";
  let pages = 0;

  while (pages < 500) {
    const url = `${API_BASE}${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      throw new Error(`Grok API returned HTTP ${response.status}`);
    }
    if (!contentType.includes("application/json")) {
      throw new Error("Grok API did not return JSON. Open grok.com and log in first.");
    }

    const body = await response.json();
    pages += 1;

    for (const raw of body.assets || []) {
      const asset = compactAsset(raw);
      if (!asset.id || !asset.url) continue;
      if (asset.mimeType !== "video/mp4") continue;
      if (seen.has(asset.id)) continue;
      seen.add(asset.id);
      assets.push(asset);
    }

    if (!body.nextPageToken || body.nextPageToken === token) break;
    token = body.nextPageToken;
  }

  await setState({
    assets,
    pages,
    total: assets.length,
    index: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    activeDownloadId: null,
    current: null,
    scanning: false,
    running: false,
    paused: false,
    startedAt: null,
    finishedAt: null,
    errors: []
  });

  return getState();
}

async function downloadNext() {
  if (startingNext) return;
  startingNext = true;

  try {
    let state = await getState();
    if (!state.running || state.paused || state.activeDownloadId !== null) return;

    const downloadedIds = await getDownloadedIds();

    while (state.index < state.assets.length) {
      const asset = state.assets[state.index];
      if (downloadedIds[asset.id]) {
        state = await setState({
          index: state.index + 1,
          skipped: state.skipped + 1,
          current: null
        });
        continue;
      }
      break;
    }

    if (state.index >= state.assets.length) {
      await setState({
        running: false,
        paused: false,
        activeDownloadId: null,
        current: null,
        finishedAt: new Date().toISOString()
      });
      return;
    }

    const asset = state.assets[state.index];
    const filename = downloadFilename(asset, state.index, state.folder);
    const downloadId = await chrome.downloads.download({
      url: asset.url,
      filename,
      conflictAction: "uniquify",
      saveAs: false
    });

    await setState({
      activeDownloadId: downloadId,
      current: {
        index: state.index,
        id: asset.id,
        filename
      }
    });
  } finally {
    startingNext = false;
  }
}

async function startQueue(folder) {
  const state = await getState();
  if (!state.assets.length) {
    throw new Error("Scan Grok videos first.");
  }

  await setState({
    folder: folder || state.folder || "grok-videos",
    running: true,
    paused: false,
    finishedAt: null,
    startedAt: state.startedAt || new Date().toISOString()
  });

  await downloadNext();
  return getState();
}

async function pauseQueue() {
  return setState({
    running: false,
    paused: true
  });
}

async function resumeQueue() {
  await setState({
    running: true,
    paused: false,
    finishedAt: null
  });
  await downloadNext();
  return getState();
}

async function clearState() {
  await chrome.storage.local.set({
    state: { ...DEFAULT_STATE, updatedAt: new Date().toISOString() },
    downloadedIds: {}
  });
  return getState();
}

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state) return;

  const state = await getState();
  if (state.activeDownloadId !== delta.id || !state.current) return;

  const current = state.current;
  const patch = {
    activeDownloadId: null,
    current: null,
    index: current.index + 1
  };

  if (delta.state.current === "complete") {
    await markDownloaded(current.id);
    patch.downloaded = state.downloaded + 1;
  } else if (delta.state.current === "interrupted") {
    const errorText = delta.error?.current || "download interrupted";
    patch.failed = state.failed + 1;
    patch.errors = [
      ...(state.errors || []),
      {
        id: current.id,
        filename: current.filename,
        error: errorText,
        at: new Date().toISOString()
      }
    ].slice(-100);
  } else {
    return;
  }

  await setState(patch);
  await downloadNext();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || !message.type) throw new Error("Missing message type.");

    if (message.type === "SCAN") return scanAssets();
    if (message.type === "START") return startQueue(message.folder);
    if (message.type === "PAUSE") return pauseQueue();
    if (message.type === "RESUME") return resumeQueue();
    if (message.type === "STATUS") return getState();
    if (message.type === "CLEAR") return clearState();

    throw new Error(`Unknown message type: ${message.type}`);
  })()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: String(error.message || error) }));

  return true;
});
