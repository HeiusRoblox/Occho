import { Router } from "express";
import { loadKeys, saveKeys, isExpired, calcExpireAt } from "../lib/keys.js";

const router = Router();

// POST /api/login — Xác thực key + đăng ký device
router.post("/login", (req, res) => {
  const { apiKey, deviceId } = req.body as { apiKey?: string; deviceId?: string };

  if (!apiKey || !deviceId) {
    res.status(400).json({ success: false, message: "apiKey và deviceId là bắt buộc" });
    return;
  }

  const keys = loadKeys();
  const entry = keys.find((k) => k.key === apiKey.toUpperCase().trim());

  if (!entry) {
    res.json({ success: false, message: "Key không tồn tại hoặc không hợp lệ" });
    return;
  }

  if (isExpired(entry.expire)) {
    res.json({ success: false, message: "Key đã hết hạn" });
    return;
  }

  const existingDevice = entry.deviceIds.find((d) => d.id === deviceId);

  if (!existingDevice) {
    if (entry.deviceIds.length >= entry.maxDeviceIds) {
      res.json({ success: false, message: `Key đã đạt giới hạn ${entry.maxDeviceIds} thiết bị` });
      return;
    }
    entry.deviceIds.push({ id: deviceId, registeredAt: new Date().toISOString() });
    saveKeys(keys);
  }

  res.json({
    success: true,
    key: entry.key,
    keyName: entry.keyName,
    typeKey: entry.typeKey,
    expire: entry.expire,
    expireAt: calcExpireAt(entry.expire),
    maxDeviceIds: entry.maxDeviceIds,
    deviceIds: entry.deviceIds,
    message: "Đăng nhập thành công",
  });
});

// POST /api/session — Kiểm tra lại session (gọi khi mở lại app)
router.post("/session", (req, res) => {
  const { apiKey, deviceId } = req.body as { apiKey?: string; deviceId?: string };

  if (!apiKey || !deviceId) {
    res.status(400).json({ success: false, message: "apiKey và deviceId là bắt buộc" });
    return;
  }

  const keys = loadKeys();
  const entry = keys.find((k) => k.key === apiKey.toUpperCase().trim());

  if (!entry) {
    res.json({ success: false, message: "Key không tồn tại" });
    return;
  }

  if (isExpired(entry.expire)) {
    res.json({ success: false, message: "Key đã hết hạn" });
    return;
  }

  const existingDevice = entry.deviceIds.find((d) => d.id === deviceId);
  if (!existingDevice) {
    res.json({ success: false, message: "Thiết bị chưa được đăng ký" });
    return;
  }

  res.json({
    success: true,
    key: entry.key,
    keyName: entry.keyName,
    typeKey: entry.typeKey,
    expire: entry.expire,
    expireAt: calcExpireAt(entry.expire),
    maxDeviceIds: entry.maxDeviceIds,
    deviceIds: entry.deviceIds,
  });
});

export default router;
