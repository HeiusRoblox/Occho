// ── State ─────────────────────────────────────────────────────────────────────
let token = localStorage.getItem("dim_admin_token") || "";
let modalCallback = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

async function apiRequest(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function showAlert(msg, type = "success") {
  const box = $("alert-box");
  box.className = `alert alert-${type}`;
  box.textContent = msg;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 4000);
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  $(name).classList.remove("hidden");
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  const pw = $("pw-input").value.trim();
  if (!pw) return;
  const data = await apiRequest("POST", "/api/admin/login", { password: pw });
  if (data.success) {
    token = data.token;
    localStorage.setItem("dim_admin_token", token);
    showAdmin();
  } else {
    $("login-err").textContent = data.message || "Sai mật khẩu";
    $("login-err").classList.remove("hidden");
  }
}

async function doLogout() {
  await apiRequest("POST", "/api/admin/logout");
  token = "";
  localStorage.removeItem("dim_admin_token");
  showLogin();
}

function showLogin() {
  showScreen("login-screen");
}

function showAdmin() {
  showScreen("admin-screen");
  loadKeys();
}

// ── Keys ──────────────────────────────────────────────────────────────────────
async function loadKeys() {
  const data = await apiRequest("GET", "/api/admin/keys");
  if (!data.success) {
    if (data.message === "Unauthorized") {
      token = "";
      localStorage.removeItem("dim_admin_token");
      showLogin();
    }
    return;
  }

  const keys = data.keys || [];
  $("key-count-lbl").textContent = `Tổng ${keys.length} key`;

  // Stats
  const total = keys.length;
  const active = keys.filter((k) => !k.expired).length;
  const expired = keys.filter((k) => k.expired).length;
  const totalDevices = keys.reduce((s, k) => s + (k.deviceIds?.length || 0), 0);
  $("stats-row").innerHTML = `
    <div class="stat-card"><div class="stat-val">${total}</div><div class="stat-lbl">Tổng Key</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#68d391">${active}</div><div class="stat-lbl">Còn Hạn</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#fc8181">${expired}</div><div class="stat-lbl">Hết Hạn</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#63b3ed">${totalDevices}</div><div class="stat-lbl">Thiết Bị</div></div>
  `;

  if (keys.length === 0) {
    $("keys-tbody").innerHTML = `<tr><td colspan="6" class="empty">Chưa có key nào. Tạo key đầu tiên!</td></tr>`;
    return;
  }

  $("keys-tbody").innerHTML = keys.map((k) => {
    let daysBadge = "";
    if (k.expire === null) {
      daysBadge = `<span class="days-badge days-lifetime">Vĩnh Viễn</span>`;
    } else if (k.expired) {
      daysBadge = `<span class="days-badge days-expired">Hết Hạn</span>`;
    } else {
      const cls = k.daysLeft > 7 ? "days-ok" : k.daysLeft > 2 ? "days-warn" : "days-critical";
      daysBadge = `<span class="days-badge ${cls}">Còn ${k.daysLeft} ngày</span>`;
    }

    const expireStr = k.expire ? new Date(k.expire).toLocaleDateString("vi-VN") : "∞";
    const devCount = (k.deviceIds || []).length;
    const devList = (k.deviceIds || []).map(d =>
      `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
        <span class="device-id-text" title="${d.id}">${d.id}</span>
        <button class="btn-icon" title="Xóa device" onclick="deleteDevice('${k.key}','${d.id}')">🗑</button>
      </div>`
    ).join("");

    return `<tr>
      <td><span class="key-badge">${k.key}</span></td>
      <td>${k.keyName}</td>
      <td>${k.typeKey}</td>
      <td>${daysBadge}<br><small style="color:#718096">${expireStr}</small></td>
      <td>
        <div style="font-size:0.85rem;font-weight:600">${devCount}/${k.maxDeviceIds}</div>
        ${devList}
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-warning btn-sm" onclick="openEditModal('${k.key}')">✏️ Sửa</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('${k.key}')">🗑 Xóa</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(title, bodyHtml, onConfirm) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHtml;
  $("modal-overlay").classList.remove("hidden");
  modalCallback = onConfirm;
  $("modal-confirm-btn").onclick = async () => {
    await onConfirm();
  };
}

function closeModal() {
  $("modal-overlay").classList.add("hidden");
  modalCallback = null;
}

// Close on overlay click
$("modal-overlay").addEventListener("click", (e) => {
  if (e.target === $("modal-overlay")) closeModal();
});

// ── Create ────────────────────────────────────────────────────────────────────
function openCreateModal() {
  openModal("Tạo Key Mới", `
    <div class="field"><label>Key (sẽ tự động viết hoa)</label><input id="c-key" placeholder="VD: ABC-123" /></div>
    <div class="field"><label>Tên Hiển Thị</label><input id="c-name" placeholder="VD: Key Premium 30 ngày" /></div>
    <div class="field"><label>Loại Key</label>
      <select id="c-type">
        <option>1 Ngày</option>
        <option>7 Ngày</option>
        <option>30 Ngày</option>
        <option>1 Năm</option>
        <option>Vĩnh Viễn</option>
      </select>
    </div>
    <div class="field"><label>Hết Hạn (để trống = Vĩnh Viễn)</label><input type="date" id="c-expire" /></div>
    <div class="field"><label>Số Thiết Bị Tối Đa</label><input type="number" id="c-max" value="1" min="1" max="99" /></div>
  `, async () => {
    const key = $("c-key").value.trim();
    const keyName = $("c-name").value.trim();
    const typeKey = $("c-type").value;
    const expire = $("c-expire").value || null;
    const maxDeviceIds = parseInt($("c-max").value) || 1;
    if (!key || !keyName) return;
    const data = await apiRequest("POST", "/api/admin/keys", { key, keyName, typeKey, expire, maxDeviceIds });
    if (data.success) {
      showAlert("✅ " + data.message);
      closeModal();
      loadKeys();
    } else {
      showAlert("❌ " + (data.message || "Thất bại"), "error");
    }
  });
}

// ── Edit ──────────────────────────────────────────────────────────────────────
async function openEditModal(key) {
  const data = await apiRequest("GET", "/api/admin/keys");
  if (!data.success) return;
  const entry = data.keys.find((k) => k.key === key);
  if (!entry) return;

  openModal("Chỉnh Sửa Key", `
    <div class="field"><label>Key Mới (để trống = giữ nguyên)</label><input id="e-key" placeholder="${entry.key}" /></div>
    <div class="field"><label>Tên Hiển Thị</label><input id="e-name" value="${entry.keyName}" /></div>
    <div class="field"><label>Loại Key</label><input id="e-type" value="${entry.typeKey}" /></div>
    <div class="field"><label>Hết Hạn (để trống = Vĩnh Viễn)</label><input type="date" id="e-expire" value="${entry.expire || ''}" /></div>
    <div class="field"><label>Số Thiết Bị Tối Đa</label><input type="number" id="e-max" value="${entry.maxDeviceIds}" min="1" /></div>
    <div class="field" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="e-reset" style="width:auto" />
      <label for="e-reset" style="margin:0;cursor:pointer">Reset tất cả thiết bị</label>
    </div>
  `, async () => {
    const newKey = $("e-key").value.trim() || undefined;
    const keyName = $("e-name").value.trim();
    const typeKey = $("e-type").value.trim();
    const expire = $("e-expire").value || null;
    const maxDeviceIds = parseInt($("e-max").value) || 1;
    const resetDevices = $("e-reset").checked;
    const res = await apiRequest("PUT", `/api/admin/keys/${key}`, { newKey, keyName, typeKey, expire, maxDeviceIds, resetDevices });
    if (res.success) {
      showAlert("✅ " + res.message);
      closeModal();
      loadKeys();
    } else {
      showAlert("❌ " + (res.message || "Thất bại"), "error");
    }
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────
function confirmDelete(key) {
  openModal("Xóa Key", `
    <p style="color:#a0aec0;line-height:1.6">
      Bạn có chắc muốn xóa key <strong style="color:#fc8181">${key}</strong>?<br/>
      Hành động này không thể hoàn tác.
    </p>
  `, async () => {
    const data = await apiRequest("DELETE", `/api/admin/keys/${key}`);
    if (data.success) {
      showAlert("✅ " + data.message);
      closeModal();
      loadKeys();
    } else {
      showAlert("❌ " + (data.message || "Thất bại"), "error");
    }
  });
}

// ── Delete Device ─────────────────────────────────────────────────────────────
async function deleteDevice(key, deviceId) {
  if (!confirm(`Xóa device ${deviceId}?`)) return;
  const data = await apiRequest("DELETE", `/api/admin/keys/${key}/devices/${encodeURIComponent(deviceId)}`);
  if (data.success) {
    showAlert("✅ Đã xóa device");
    loadKeys();
  } else {
    showAlert("❌ " + (data.message || "Thất bại"), "error");
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (token) {
  showAdmin();
} else {
  showLogin();
}
