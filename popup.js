const state = {
  busy: false,
  aiProviders: []
};

const els = {
  statusText: document.getElementById("statusText"),
  
  // Shortcuts
  pasteInput: document.getElementById('pasteInput'),
  searchInput: document.getElementById('searchInput'),
  toggleInput: document.getElementById('toggleInput'),
  saveKeysBtn: document.getElementById('saveKeysBtn'),

  // AI Provider
  providerTypeInput: document.getElementById('providerTypeInput'),
  providerNameInput: document.getElementById('providerNameInput'),
  providerApiKeyInput: document.getElementById('providerApiKeyInput'),
  providerModelInput: document.getElementById('providerModelInput'),
  btnAddProviderKey: document.getElementById('btnAddProviderKey'),
  providerFormHint: document.getElementById('providerFormHint'),
  providerList: document.getElementById('providerList'),

  // Prompt
  promptTemplateSelect: document.getElementById('promptTemplateSelect'),
  applyPromptTemplateBtn: document.getElementById('applyPromptTemplateBtn'),
  promptTemplateHint: document.getElementById('promptTemplateHint'),
  aiPromptInput: document.getElementById('aiPromptInput'),
  saveAiBtn: document.getElementById('saveAiBtn')
};

const PROMPT_TEMPLATES = [
  {
    id: "mindx_default",
    name: "MindX Chuan (Default)",
    hint: "Cau lenh mac dinh. Barem + nhan xet ngan gon, kieu dong vien.",
    prompt: "Cham diem bai tap ve nha:\n\n{keywords}\n\nYeu cau:\n1) Neu co [BAREM], hay cham diem tung muc. Neu hoc vien lam sai hoac thieu, chi ra diem sai. Truong hop bai loi hoac khong co the cham theo barem thi tu danh gia dua tren ket qua chay thu.\n2) Dua ra nhan xet ngan gon, mang tinh dong vien, khong viet qua dai.\n3) Danh gia muc do hoan thanh: Tot, Kha, Trung binh, Can co gang."
  },
  {
    id: "mindx_strict",
    name: "MindX Khat khe (Strict)",
    hint: "Cham chat hon, chi tra chi tiet loi sai.",
    prompt: "Cham diem bai tap ve nha mot cach khat khe:\n\n{keywords}\n\nYeu cau:\n1) Kiem tra tung muc trong [BAREM]. Hoc vien sai muc nao, phai tru diem muc do va giai thich tai sao sai, kem theo doan code sua loi (neu co).\n2) Nhan xet chi tiet ve cach viet code (clean code, dat ten bien, logic).\n3) Danh gia muc do hoan thanh cuoi cung."
  },
  {
    id: "mindx_friendly",
    name: "MindX Than thien (Friendly)",
    hint: "Giong dieu de thuong, nhieu emoji, danh cho lop nho tuoi.",
    prompt: "Cham diem bai tap ve nha voi giong dieu that vui ve, de thuong, su dung nhieu emoji nhe! ✨\n\n{keywords}\n\nYeu cau:\n1) Khen ngoi nhung diem tot ma hoc sinh da lam duoc trong [BAREM]. 🌟\n2) Neu co loi, huong dan nhe nhang de cac em tu sua. 🛠️\n3) Cuoi cung la mot cau dong vien that nhieu nang luong! 💪🔥"
  }
];

// Utilities
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}
function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#039;");
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

// ---------------------------------------------------------
// SHORTCUTS (Phím tắt)
// ---------------------------------------------------------
function formatKeyCombo(e) {
  if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') return '';
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  let keyName = e.key;
  if (keyName === ' ') keyName = 'Space';
  else if (keyName.length === 1) keyName = keyName.toUpperCase();
  parts.push(keyName);
  return parts.join('+');
}
function setupShortcutInput(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') {
      inputEl.value = '';
      return;
    }
    const combo = formatKeyCombo(e);
    if (combo) inputEl.value = combo;
  });
}
async function saveShortcuts() {
  if (state.busy) return;
  setBusy(true);
  try {
    await storageSet({
      pasteKey: els.pasteInput.value.trim(),
      searchKey: els.searchInput.value.trim(),
      toggleKey: els.toggleInput.value.trim()
    });
    setStatus('Đã lưu phím tắt thành công!');
  } catch (err) {
    setStatus('Lỗi lưu phím tắt: ' + err.message, true);
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------
// AI PROVIDERS & PROMPTS
// ---------------------------------------------------------
function getPromptTemplateById(id) {
  return PROMPT_TEMPLATES.find((t) => t.id === id) || null;
}
function updatePromptTemplateHint(templateId) {
  if (!els.promptTemplateHint) return;
  if (templateId === "__custom__") {
    els.promptTemplateHint.textContent = "Bạn đang dùng prompt tùy chỉnh (hoặc cũ). Không thuộc template mẫu.";
  } else {
    const t = getPromptTemplateById(templateId);
    els.promptTemplateHint.textContent = t ? `💡 Hint: ${t.hint}` : "";
  }
}
function syncPromptTemplateSelect(promptText) {
  if (!els.promptTemplateSelect) return;
  const currentText = (promptText || "").trim();
  const matched = PROMPT_TEMPLATES.find((t) => t.prompt.trim() === currentText);
  els.promptTemplateSelect.value = matched ? matched.id : "__custom__";
  updatePromptTemplateHint(els.promptTemplateSelect.value);
}
function initPromptTemplateSelector() {
  if (!els.promptTemplateSelect) return;
  PROMPT_TEMPLATES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    els.promptTemplateSelect.appendChild(opt);
  });
  els.promptTemplateSelect.addEventListener("change", (e) => {
    updatePromptTemplateHint(e.target.value);
  });
  els.applyPromptTemplateBtn?.addEventListener("click", () => {
    const selectedId = els.promptTemplateSelect.value;
    if (selectedId === "__custom__") return;
    const t = getPromptTemplateById(selectedId);
    if (t && els.aiPromptInput) {
      els.aiPromptInput.value = t.prompt;
      setStatus("Đã áp dụng template " + t.name);
    }
  });
}
function generateProviderId() {
  return 'prov_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}
function normalizeProviderType(val) {
  return (val === "google") ? "google" : "other";
}
function sanitizeAiProviders(rawProviders) {
  if (!Array.isArray(rawProviders)) return [];
  return rawProviders.map(p => ({
    id: p.id || generateProviderId(),
    type: normalizeProviderType(p.type),
    name: (p.name || 'Unknown').trim(),
    apiKey: (p.apiKey || '').trim(),
    model: p.type === 'other' ? (p.model || '').trim() : ''
  })).filter(p => p.apiKey.length > 0);
}
function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
}
function updateProviderFormVisibility() {
  if (!els.providerTypeInput || !els.providerModelInput || !els.providerFormHint) return;
  if (els.providerTypeInput.value === 'other') {
    els.providerModelInput.style.display = 'block';
    els.providerFormHint.textContent = 'Với Other Provider, API url (chỉ hỗ trợ OpenAI SDK format) có thể cần cấu hình thêm ở background, hiện tại extension mặc định trỏ về URL tương ứng nếu có.';
  } else {
    els.providerModelInput.style.display = 'none';
    els.providerFormHint.textContent = 'Google Gemini API miễn phí (giới hạn RPM/RPD). Extension tự fallback từ flash xuống flash-lite.';
  }
}
function clearProviderForm() {
  if (!els.providerNameInput) return;
  els.providerTypeInput.value = 'google';
  els.providerNameInput.value = '';
  els.providerApiKeyInput.value = '';
  els.providerModelInput.value = '';
  delete els.btnAddProviderKey.dataset.editId;
  els.btnAddProviderKey.textContent = 'Thêm / Cập nhật key';
  updateProviderFormVisibility();
}
function loadProviderToForm(providerId) {
  const p = state.aiProviders.find(x => x.id === providerId);
  if (!p) return;
  els.providerTypeInput.value = p.type;
  els.providerNameInput.value = p.name;
  els.providerApiKeyInput.value = p.apiKey;
  els.providerModelInput.value = p.model || '';
  els.btnAddProviderKey.dataset.editId = p.id;
  els.btnAddProviderKey.textContent = 'Lưu chỉnh sửa';
  updateProviderFormVisibility();
}
function renderProviderList() {
  if (!els.providerList) return;
  els.providerList.innerHTML = '';
  if (state.aiProviders.length === 0) {
    els.providerList.innerHTML = '<div style="font-size:12px; color:#666; padding:8px; text-align:center; background:#fff; border:1px solid #ddd; border-radius:4px;">Chưa có API key nào. Vui lòng thêm ít nhất 1 key.</div>';
    return;
  }
  state.aiProviders.forEach((p, index) => {
    const row = document.createElement('div');
    row.className = 'provider-row';
    const titleBar = document.createElement('div');
    titleBar.className = 'provider-title';
    titleBar.innerHTML = `<span>#${index + 1} - ${escapeHtml(p.name)}</span> 
      <span style="font-size:10px; color:#fff; background:#1a73e8; padding:2px 4px; border-radius:4px;">${escapeHtml(p.type.toUpperCase())}</span>`;
    const btnDel = document.createElement('button');
    btnDel.className = 'provider-remove';
    btnDel.textContent = 'Xóa';
    btnDel.type = 'button';
    btnDel.onclick = (e) => {
      e.stopPropagation();
      removeProvider(p.id);
    };
    titleBar.appendChild(btnDel);
    const meta = document.createElement('div');
    meta.className = 'provider-meta';
    let metaHtml = `Key: ${escapeHtml(maskApiKey(p.apiKey))}`;
    if (p.type === 'other') {
      metaHtml += `<br>Model: ${escapeHtml(p.model)}`;
    }
    meta.innerHTML = metaHtml;
    row.appendChild(titleBar);
    row.appendChild(meta);
    row.style.cursor = 'pointer';
    row.onclick = () => loadProviderToForm(p.id);
    els.providerList.appendChild(row);
  });
}
function upsertProviderFromForm() {
  const type = normalizeProviderType(els.providerTypeInput.value);
  const name = els.providerNameInput.value.trim();
  const apiKey = els.providerApiKeyInput.value.trim();
  const model = els.providerModelInput.value.trim();
  if (!name || !apiKey) {
    setStatus("Vui lòng nhập tên và API Key!", true);
    return;
  }
  if (type === 'other' && !model) {
    setStatus("Vui lòng nhập model name cho Other Provider!", true);
    return;
  }
  const editId = els.btnAddProviderKey.dataset.editId;
  if (editId) {
    const idx = state.aiProviders.findIndex(x => x.id === editId);
    if (idx >= 0) {
      state.aiProviders[idx] = { id: editId, type, name, apiKey, model };
    }
  } else {
    state.aiProviders.push({ id: generateProviderId(), type, name, apiKey, model });
  }
  clearProviderForm();
  renderProviderList();
  setStatus("Đã cập nhật danh sách Key (chưa lưu vĩnh viễn).", false);
}
function removeProvider(id) {
  state.aiProviders = state.aiProviders.filter(x => x.id !== id);
  if (els.btnAddProviderKey.dataset.editId === id) clearProviderForm();
  renderProviderList();
  setStatus("Đã xóa Key khỏi danh sách tạm.", false);
}
async function saveAiConfig() {
  if (state.busy) return;
  setBusy(true);
  try {
    const cleanProviders = sanitizeAiProviders(state.aiProviders);
    const promptValue = els.aiPromptInput.value.trim();
    if (cleanProviders.length === 0) {
      setStatus("Cảnh báo: Không có AI Key nào. Ext sẽ không gọi AI được.", true);
    }
    await storageSet({ aiProviders: cleanProviders, aiPrompt: promptValue });
    state.aiProviders = cleanProviders;
    renderProviderList();
    syncPromptTemplateSelect(promptValue);
    setStatus("Đã lưu cấu hình AI thành công!");
  } catch (err) {
    setStatus("Lỗi khi lưu cấu hình AI: " + err.message, true);
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------
function bindEvents() {
  setupShortcutInput(els.pasteInput);
  setupShortcutInput(els.searchInput);
  setupShortcutInput(els.toggleInput);
  els.saveKeysBtn?.addEventListener('click', saveShortcuts);

  els.providerTypeInput?.addEventListener('change', updateProviderFormVisibility);
  els.btnAddProviderKey?.addEventListener('click', upsertProviderFromForm);
  els.saveAiBtn?.addEventListener('click', saveAiConfig);
}

async function initPopup() {
  bindEvents();
  initPromptTemplateSelector();

  const data = await storageGet([
    "pasteKey", 
    "searchKey", 
    "toggleKey",
    "aiProviders",
    "aiPrompt"
  ]);
  
  if (els.pasteInput) els.pasteInput.value = data.pasteKey || '';
  if (els.searchInput) els.searchInput.value = data.searchKey || '';
  if (els.toggleInput) els.toggleInput.value = data.toggleKey || '';

  state.aiProviders = sanitizeAiProviders(data.aiProviders);
  updateProviderFormVisibility();
  renderProviderList();

  if (els.aiPromptInput) {
    els.aiPromptInput.value = data.aiPrompt || '';
    syncPromptTemplateSelect(data.aiPrompt || '');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initPopup().catch((error) => {
    setStatus(`Init failed: ${error.message}`, true);
  });
});
