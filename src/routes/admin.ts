import { Router, Request, Response, NextFunction } from "express";
import { loadKeys, saveKeys, isExpired, daysLeft } from "../lib/keys.js";
import { randomUUID } from "crypto";

const router = Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const activeSessions = new Set<string>();

function auth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  if (!activeSessions.has(token)) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  next();
}

// POST /api/admin/login
router.post("/admin/login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ success: false, message: "Sai mật khẩu admin" });
    return;
  }
  const token = randomUUID();
  activeSessions.add(token);
  res.json({ success: true, token });
});

// POST /api/admin/logout
router.post("/admin/logout", auth, (req: Request, res: Response) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  activeSessions.delete(token);
  res.json({ success: true });
});

// GET /api/admin/keys
router.get("/admin/keys", auth, (_req: Request, res: Response) => {
  const keys = loadKeys();
  const result = keys.map((k) => {
    const dl = daysLeft(k.expire);
    return {
      key: k.key,
      keyName: k.keyName,
      typeKey: k.typeKey,
      expire: k.expire,
      maxDeviceIds: k.maxDeviceIds,
      deviceIds: k.deviceIds,
      daysLeft: dl,
      expired: isExpired(k.expire),
    };
  });
  res.json({ success: true, keys: result });
});

// POST /api/admin/keys
router.post("/admin/keys", auth, (req: Request, res: Response) => {
  const { key, keyName, typeKey, expire, maxDeviceIds } = req.body as {
    key?: string;
    keyName?: string;
    typeKey?: string;
    expire?: string | null;
    maxDeviceIds?: number;
  };

  if (!key || !keyName || !typeKey) {
    res.status(400).json({ success: false, message: "key, keyName, typeKey là bắt buộc" });
    return;
  }

  const keys = loadKeys();
  const normalizedKey = key.toUpperCase().trim();

  if (keys.find((k) => k.key === normalizedKey)) {
    res.status(409).json({ success: false, message: "Key đã tồn tại" });
    return;
  }

  keys.push({
    key: normalizedKey,
    keyName: keyName.trim(),
    typeKey: typeKey.trim(),
    expire: expire || null,
    maxDeviceIds: maxDeviceIds ?? 1,
    deviceIds: [],
  });

  saveKeys(keys);
  res.json({ success: true, message: "Tạo key thành công" });
});

// PUT /api/admin/keys/:key
router.put("/admin/keys/:key", auth, (req: Request, res: Response) => {
  const targetKey = req.params.key.toUpperCase().trim();
  const { newKey, keyName, typeKey, expire, maxDeviceIds, resetDevices } = req.body as {
    newKey?: string;
    keyName?: string;
    typeKey?: string;
    expire?: string | null;
    maxDeviceIds?: number;
    resetDevices?: boolean;
  };

  const keys = loadKeys();
  const idx = keys.findIndex((k) => k.key === targetKey);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Key không tồn tại" });
    return;
  }

  const entry = keys[idx];
  if (newKey) entry.key = newKey.toUpperCase().trim();
  if (keyName) entry.keyName = keyName.trim();
  if (typeKey) entry.typeKey = typeKey.trim();
  if (expire !== undefined) entry.expire = expire || null;
  if (maxDeviceIds !== undefined) entry.maxDeviceIds = maxDeviceIds;
  if (resetDevices) entry.deviceIds = [];

  saveKeys(keys);
  res.json({ success: true, message: "Cập nhật key thành công" });
});

// DELETE /api/admin/keys/:key
router.delete("/admin/keys/:key", auth, (req: Request, res: Response) => {
  const targetKey = req.params.key.toUpperCase().trim();
  const keys = loadKeys();
  const idx = keys.findIndex((k) => k.key === targetKey);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Key không tồn tại" });
    return;
  }
  keys.splice(idx, 1);
  saveKeys(keys);
  res.json({ success: true, message: "Xóa key thành công" });
});

// DELETE /api/admin/keys/:key/devices/:deviceId
router.delete("/admin/keys/:key/devices/:deviceId", auth, (req: Request, res: Response) => {
  const targetKey = req.params.key.toUpperCase().trim();
  const deviceId = req.params.deviceId;
  const keys = loadKeys();
  const entry = keys.find((k) => k.key === targetKey);
  if (!entry) {
    res.status(404).json({ success: false, message: "Key không tồn tại" });
    return;
  }
  const before = entry.deviceIds.length;
  entry.deviceIds = entry.deviceIds.filter((d) => d.id !== deviceId);
  if (entry.deviceIds.length === before) {
    res.status(404).json({ success: false, message: "Device không tồn tại" });
    return;
  }
  saveKeys(keys);
  res.json({ success: true, message: "Đã xóa device" });
});

export default router;
