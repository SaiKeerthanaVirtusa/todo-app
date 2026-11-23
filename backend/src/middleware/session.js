const { createHash, randomBytes } = require("node:crypto");
const db = require("../config/db");
const config = require("../config/env");

const cookieName = "taskly_session";
const maxAge = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.isProduction && process.env.COOKIE_SECURE !== "false",
  path: "/api",
};

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionHash(req) {
  const match = (req.headers.cookie || "").match(/(?:^|;\s*)taskly_session=([a-f0-9]{64})(?=;|$)/);
  return match ? hashToken(match[1]) : null;
}

async function createSession(userId, req, res) {
  const token = randomBytes(32).toString("hex");
  const previous = sessionHash(req);
  await db.query("DELETE FROM sessions WHERE expires_at <= now() OR token_hash = $1", [previous]);
  await db.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), userId, new Date(Date.now() + maxAge)]
  );
  res.cookie(cookieName, token, { ...cookieOptions, maxAge });
}

async function clearSession(req, res) {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [sessionHash(req)]);
  res.clearCookie(cookieName, cookieOptions);
}

async function requireSession(req, res, next) {
  res.set("Cache-Control", "no-store");
  const tokenHash = sessionHash(req);
  if (!tokenHash) {
    return res.status(401).json({ success: false, message: "Please sign in." });
  }
  try {
    const { rows: [user] } = await db.query(
      `SELECT users.id, users.name, users.email
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash]
    );
    if (!user) {
      return res.status(401).json({ success: false, message: "Please sign in." });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { createSession, clearSession, requireSession };
