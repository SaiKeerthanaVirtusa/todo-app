const express = require("express");
const { randomBytes, randomUUID, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { rateLimit } = require("express-rate-limit");
const db = require("../config/db");
const { createSession, clearSession, requireSession } = require("../middleware/session");

const router = express.Router();
const deriveKey = promisify(scrypt);
const dummySalt = randomBytes(16).toString("hex");
const dummyKey = Buffer.alloc(64);
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { success: false, message: "Too many attempts. Try again in 15 minutes." },
});

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.method === "POST" && !req.is("application/json")) {
    return res.status(415).json({ success: false, message: "Send an application/json body." });
  }
  next();
});

router.post(["/signup", "/login"], limit, async (req, res, next) => {
  const signup = req.path.replace(/\/$/, "").toLowerCase() === "/signup";
  const { email, password, name } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254 ||
      typeof password !== "string" || password.length < 8 || password.length > 256) {
    return res.status(400).json({ success: false, message: "Enter a valid email and a password of 8 to 256 characters." });
  }
  if (signup && (typeof name !== "string" || !name.trim() || name.trim().length > 100)) {
    return res.status(400).json({ success: false, message: "Enter a name of 1 to 100 characters." });
  }

  try {
    let user;
    if (signup) {
      const salt = randomBytes(16).toString("hex");
      const key = await deriveKey(password, salt, 64);
      ({ rows: [user] } = await db.query(
        `INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING RETURNING id, name, email`,
        [randomUUID(), name.trim(), normalizedEmail, `${salt}:${key.toString("hex")}`]
      ));
      if (!user) {
        return res.status(409).json({ success: false, message: "An account already exists for this email." });
      }
    } else {
      const { rows: [account] } = await db.query(
        "SELECT id, name, email, password_hash FROM users WHERE email = $1",
        [normalizedEmail]
      );
      const [salt, hash] = account ? account.password_hash.split(":") : [dummySalt, null];
      const key = await deriveKey(password, salt, 64);
      if (!timingSafeEqual(key, hash ? Buffer.from(hash, "hex") : dummyKey) || !account) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }
      user = { id: account.id, name: account.name, email: account.email };
    }

    await createSession(user.id, req, res);
    res.status(signup ? 201 : 200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.get("/session", requireSession, (req, res) => {
  res.json({ success: true, data: req.user });
});

router.post("/logout", async (req, res, next) => {
  try {
    await clearSession(req, res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
