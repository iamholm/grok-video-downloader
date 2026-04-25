const ids = {
  folder: document.getElementById("folder"),
  total: document.getElementById("total"),
  downloaded: document.getElementById("downloaded"),
  skipped: document.getElementById("skipped"),
  failed: document.getElementById("failed"),
  bar: document.getElementById("bar"),
  status: document.getElementById("status"),
  errors: document.getElementById("errors"),
  scan: document.getElementById("scan"),
  start: document.getElementById("start"),
  pause: document.getElementById("pause"),
  resume: document.getElementById("resume"),
  clear: document.getElementById("clear")
};

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || "Extension command failed.");
  return response.result;
}

function render(state) {
  const total = Number(state.total || 0);
  const completed =
    Number(state.downloaded || 0) + Number(state.skipped || 0) + Number(state.failed || 0);
  const pct = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  ids.total.textContent = String(total);
  ids.downloaded.textContent = String(state.downloaded || 0);
  ids.skipped.textContent = String(state.skipped || 0);
  ids.failed.textContent = String(state.failed || 0);
  ids.bar.style.width = `${pct}%`;

  if (state.folder) ids.folder.value = state.folder;

  if (state.scanning) {
    ids.status.textContent = "Сканирую Grok API...";
  } else if (state.running && state.current) {
    ids.status.textContent = `Скачиваю ${state.current.index + 1}/${total}: ${state.current.id}`;
  } else if (state.running) {
    ids.status.textContent = "Очередь активна...";
  } else if (state.paused) {
    ids.status.textContent = `Пауза на ${completed}/${total}.`;
  } else if (state.finishedAt) {
    ids.status.textContent = `Готово: ${completed}/${total}.`;
  } else if (total) {
    ids.status.textContent = `Найдено ${total}. Нажми Download.`;
  } else {
    ids.status.textContent = "Открой grok.com/files?fileType=video и нажми Scan.";
  }

  const errors = state.errors || [];
  ids.errors.hidden = errors.length === 0;
  ids.errors.textContent = errors
    .slice(-8)
    .map((item) => `${item.id || ""} ${item.error || item}`)
    .join("\n");

  ids.scan.disabled = state.scanning || state.running;
  ids.start.disabled = state.scanning || state.running || !total;
  ids.pause.disabled = !state.running;
  ids.resume.disabled = state.scanning || state.running || !state.paused;
  ids.clear.disabled = state.scanning || state.running;
}

async function refresh() {
  try {
    render(await send("STATUS"));
  } catch (error) {
    ids.status.textContent = String(error.message || error);
  }
}

async function run(button, fn) {
  button.disabled = true;
  try {
    render(await fn());
  } catch (error) {
    ids.status.textContent = String(error.message || error);
  } finally {
    await refresh();
  }
}

ids.scan.addEventListener("click", () => run(ids.scan, () => send("SCAN")));
ids.start.addEventListener("click", () =>
  run(ids.start, () => send("START", { folder: ids.folder.value.trim() || "grok-videos" }))
);
ids.pause.addEventListener("click", () => run(ids.pause, () => send("PAUSE")));
ids.resume.addEventListener("click", () => run(ids.resume, () => send("RESUME")));
ids.clear.addEventListener("click", () => run(ids.clear, () => send("CLEAR")));

refresh();
setInterval(refresh, 1000);
