const state = {
  updateInfo: null,
  busy: false
};

const els = {
  updateBanner: document.getElementById("updateBanner"),
  btnCheckUpdates: document.getElementById("btnCheckUpdates"),
  statusText: document.getElementById("statusText")
};

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message, isError = false) {
  if (!els.statusText) return;
  els.statusText.textContent = message || "";
  els.statusText.classList.toggle("error", Boolean(isError));
}

function setBusy(nextBusy) {
  state.busy = nextBusy;
  if (els.btnCheckUpdates) els.btnCheckUpdates.disabled = nextBusy;
}

function renderUpdateBanner() {
  const info = state.updateInfo;
  if (!info) {
    els.updateBanner.classList.add("hidden");
    els.updateBanner.innerHTML = "";
    return;
  }

  const checkedAt = info.checkedAt ? new Date(info.checkedAt).toLocaleString() : "unknown";
  const link = info.latestCommitUrl || info.repoUrl || "https://github.com";

  if (info.updateAvailable) {
    const shortSha = info.latestCommitSha ? info.latestCommitSha.slice(0, 7) : "unknown";
    const detail = info.reason === "tag"
      ? `New tag detected: ${escapeHtml(info.latestTagName || "unknown")}`
      : `New commit detected: ${escapeHtml(shortSha)}`;

    els.updateBanner.classList.remove("hidden");
    els.updateBanner.innerHTML = `
      <div><strong>Update available.</strong> ${detail}</div>
      <div style="margin-top:4px;">Last check: ${escapeHtml(checkedAt)}</div>
      <button id="btnOpenUpdateLink" class="btn btn-secondary" type="button" style="margin-top:6px;">Open Repository</button>
    `;

    const button = document.getElementById("btnOpenUpdateLink");
    if (button) {
      button.addEventListener("click", () => {
        chrome.tabs.create({ url: link });
      });
    }
    return;
  }

  if (info.lastError) {
    els.updateBanner.classList.remove("hidden");
    els.updateBanner.innerHTML = `
      <div><strong>Cannot verify updates right now.</strong></div>
      <div style="margin-top:4px;">Reason: ${escapeHtml(info.lastError)}</div>
      <div style="margin-top:4px;">Last check: ${escapeHtml(checkedAt)}</div>
    `;
    return;
  }

  const localVersion = info.localVersion || "unknown";
  els.updateBanner.classList.remove("hidden");
  els.updateBanner.innerHTML = `
    <div><strong>You are on the latest version (${escapeHtml(localVersion)}).</strong></div>
    <div style="margin-top:4px;">Last check: ${escapeHtml(checkedAt)}</div>
  `;
}

async function checkUpdatesNow() {
  if (state.busy) return;
  if (!els.btnCheckUpdates) return;

  const label = els.btnCheckUpdates.textContent;
  els.btnCheckUpdates.textContent = "Checking...";
  setBusy(true);

  chrome.runtime.sendMessage({ type: "CHECK_UPDATES_NOW" }, (response) => {
    setBusy(false);
    els.btnCheckUpdates.textContent = label;

    if (chrome.runtime.lastError) {
      setStatus(`Update check failed: ${chrome.runtime.lastError.message}`, true);
      return;
    }

    if (!response?.ok) {
      setStatus(`Update check failed: ${response?.error || "Unknown error"}`, true);
      return;
    }

    state.updateInfo = response.info || null;
    renderUpdateBanner();

    const info = state.updateInfo;
    if (info?.lastError) {
      setStatus(`Update check warning: ${info.lastError}`, true);
      return;
    }

    if (info?.updateAvailable) {
      setStatus("Update available. Open repository for details.");
      return;
    }

    const version = info?.localVersion || "unknown";
    setStatus(`Ban dang o phien ban moi nhat (${version}).`);
  });
}

function bindEvents() {
  if (els.btnCheckUpdates) {
    els.btnCheckUpdates.addEventListener("click", checkUpdatesNow);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes.updateInfo) {
      state.updateInfo = changes.updateInfo.newValue || null;
      renderUpdateBanner();
    }
  });
}

async function initPopup() {
  bindEvents();

  const data = await storageGet(["updateInfo"]);
  state.updateInfo = data.updateInfo || null;

  renderUpdateBanner();
}

document.addEventListener("DOMContentLoaded", () => {
  initPopup().catch((error) => {
    setStatus(`Popup init failed: ${error.message}`, true);
  });
});
