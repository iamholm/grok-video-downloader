const ids = {
  folder: document.getElementById("folder"),
  language: document.getElementById("language"),
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

const messages = {
  en: {
    intro: "Downloads only video/mp4 files from your current Grok session.",
    languageLabel: "Language",
    folderLabel: "Folder inside Downloads",
    found: "Found",
    downloaded: "Downloaded",
    skipped: "Skipped",
    errors: "Errors",
    scan: "Scan",
    download: "Download",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset extension history",
    commandFailed: "Extension command failed.",
    scanFirst: "Open grok.com/files?fileType=video and click Scan.",
    scanning: "Scanning Grok API...",
    running: "Queue is active...",
    downloading: (current, total, id) => `Downloading ${current}/${total}: ${id}`,
    paused: (completed, total) => `Paused at ${completed}/${total}.`,
    finished: (completed, total) => `Done: ${completed}/${total}.`,
    ready: (total) => `Found ${total}. Click Download.`
  },
  ru: {
    intro: "Скачивает только video/mp4 из твоей текущей сессии Grok.",
    languageLabel: "Язык",
    folderLabel: "Папка внутри Downloads",
    found: "Найдено",
    downloaded: "Скачано",
    skipped: "Пропущено",
    errors: "Ошибки",
    scan: "Скан",
    download: "Скачать",
    pause: "Пауза",
    resume: "Продолжить",
    reset: "Сбросить историю расширения",
    commandFailed: "Команда расширения не выполнена.",
    scanFirst: "Открой grok.com/files?fileType=video и нажми Скан.",
    scanning: "Сканирую Grok API...",
    running: "Очередь активна...",
    downloading: (current, total, id) => `Скачиваю ${current}/${total}: ${id}`,
    paused: (completed, total) => `Пауза на ${completed}/${total}.`,
    finished: (completed, total) => `Готово: ${completed}/${total}.`,
    ready: (total) => `Найдено ${total}. Нажми Скачать.`
  }
};

let language = "en";

function t(key, ...args) {
  const value = messages[language]?.[key] || messages.en[key] || key;
  return typeof value === "function" ? value(...args) : value;
}

function applyLanguage() {
  document.documentElement.lang = language;
  ids.language.value = language;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
}

async function loadLanguage() {
  const data = await chrome.storage.local.get(["uiLanguage"]);
  language = data.uiLanguage === "ru" ? "ru" : "en";
  applyLanguage();
}

async function setLanguage(nextLanguage) {
  language = nextLanguage === "ru" ? "ru" : "en";
  await chrome.storage.local.set({ uiLanguage: language });
  applyLanguage();
  await refresh();
}

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || t("commandFailed"));
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
    ids.status.textContent = t("scanning");
  } else if (state.running && state.current) {
    ids.status.textContent = t("downloading", state.current.index + 1, total, state.current.id);
  } else if (state.running) {
    ids.status.textContent = t("running");
  } else if (state.paused) {
    ids.status.textContent = t("paused", completed, total);
  } else if (state.finishedAt) {
    ids.status.textContent = t("finished", completed, total);
  } else if (total) {
    ids.status.textContent = t("ready", total);
  } else {
    ids.status.textContent = t("scanFirst");
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

ids.language.addEventListener("change", () => setLanguage(ids.language.value));
ids.scan.addEventListener("click", () => run(ids.scan, () => send("SCAN")));
ids.start.addEventListener("click", () =>
  run(ids.start, () => send("START", { folder: ids.folder.value.trim() || "grok-videos" }))
);
ids.pause.addEventListener("click", () => run(ids.pause, () => send("PAUSE")));
ids.resume.addEventListener("click", () => run(ids.resume, () => send("RESUME")));
ids.clear.addEventListener("click", () => run(ids.clear, () => send("CLEAR")));

loadLanguage().then(refresh);
setInterval(refresh, 1000);
