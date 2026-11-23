const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const databaseUrl = process.env.TEST_DATABASE_URL;
const schema = `test_${randomUUID().replaceAll("-", "")}`;
if (databaseUrl) {
  process.env.NODE_ENV = "test";
  const connection = new URL(databaseUrl);
  connection.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = connection.toString();
}

describe("VIT Team 3 - To-Do Backend API Test Suite", {
  skip: databaseUrl ? false : "Set TEST_DATABASE_URL to run the PostgreSQL integration suite.",
}, () => {
  const app = require("../src/app");
  const db = require("../src/config/db");
  const todoModel = require("../src/models/todoModel");
  let server;
  let baseUrl;
  let cookie;
  let userId;

  before(async () => {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(readFileSync(join(__dirname, "../db/schema.sql"), "utf8"));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const signup = await apiRequest("/api/auth/signup", {
      method: "POST",
      body: { name: "Task owner", email: "owner@example.com", password: "test-password" },
    });
    assert.equal(signup.status, 201);
    cookie = signup.cookie;
    userId = signup.data.data.id;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    try {
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await db.end();
    }
  });

  beforeEach(async () => {
    await db.query("DELETE FROM todos WHERE user_id = $1", [userId]);
    await db.query(
      `INSERT INTO todos (id, user_id, title, priority, completed) VALUES
       ('1', $1, 'Complete Virtusa Backend API', 'High', false),
       ('2', $1, 'Verify Frontend Integration', 'Medium', false),
       ('3', $1, 'Initial Team Setup', 'Low', true)`,
      [userId]
    );
  });

  // Helper function to make JSON HTTP requests
  async function apiRequest(endpoint, { method = "GET", body = null, headers = {} } = {}) {
    const reqHeaders = { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }), ...headers };
    const options = {
      method,
      headers: reqHeaders,
    };
    if (body !== null) {
      options.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const response = await fetch(`${baseUrl}${endpoint}`, options);
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }

  // ============================================
  // System & Health Endpoints
  // ============================================
  test("GET / - returns API information", async () => {
    const { status, data } = await apiRequest("/");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.name, "VIT Team 3 To-Do Application API");
  });

  test("GET /api/health - returns healthy status", async () => {
    const { status, data } = await apiRequest("/api/health");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.status, "healthy");
    assert.ok(data.timestamp);
  });

  test("GET /api/unknown-route - returns 404 structured response", async () => {
    const { status, data } = await apiRequest("/api/non-existent-endpoint");
    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes("Resource not found"));
  });

  // ============================================
  // GET /api/todos & Filters
  // ============================================
  test("GET /api/todos - returns all tasks and count", async () => {
    const { status, data } = await apiRequest("/api/todos");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(Array.isArray(data.data), true);
    assert.strictEqual(data.count, 3);
  });

  test("GET /api/todos?search=Backend - filters tasks by search term", async () => {
    const { status, data } = await apiRequest("/api/todos?search=Backend");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.count >= 1);
    const allMatch = data.data.every(
      (t) =>
        t.title.toLowerCase().includes("backend") ||
        (t.description && t.description.toLowerCase().includes("backend"))
    );
    assert.strictEqual(allMatch, true);
  });

  test("GET /api/todos?status=completed - returns only completed tasks", async () => {
    const { status, data } = await apiRequest("/api/todos?status=completed");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    for (const t of data.data) {
      assert.strictEqual(t.completed, true);
    }
  });

  test("GET /api/todos?status=pending - returns only pending tasks", async () => {
    const { status, data } = await apiRequest("/api/todos?status=pending");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    for (const t of data.data) {
      assert.strictEqual(t.completed, false);
    }
  });

  test("GET /api/todos?priority=high - returns only high priority tasks", async () => {
    const { status, data } = await apiRequest("/api/todos?priority=high");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    for (const t of data.data) {
      assert.strictEqual(t.priority, "High");
    }
  });

  // ============================================
  // GET /api/todos/summary
  // ============================================
  test("GET /api/todos/summary - returns correct task metrics", async () => {
    const { status, data } = await apiRequest("/api/todos/summary");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.total, 3);
    assert.strictEqual(data.data.completed, 1);
    assert.strictEqual(data.data.pending, 2);
  });

  // ============================================
  // GET /api/todos/:id
  // ============================================
  test("GET /api/todos/:id - returns task for existing ID", async () => {
    const { status, data } = await apiRequest("/api/todos/1");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.id, "1");
    assert.strictEqual(data.data.title, "Complete Virtusa Backend API");
  });

  test("GET /api/todos/:id - returns 404 for non-existent ID", async () => {
    const { status, data } = await apiRequest("/api/todos/nonexistent-999");
    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes("was not found"));
  });

  // ============================================
  // POST /api/todos (Create Task)
  // ============================================
  test("POST /api/todos - creates a new task with valid data", async () => {
    const newTask = {
      title: "Write End-to-End API Documentation",
      description: "Document all endpoints, sample payloads, and curl commands",
      priority: "High",
      category: "Work",
      dueDate: "2026-11-25",
      completed: false,
    };

    const { status, data } = await apiRequest("/api/todos", {
      method: "POST",
      body: newTask,
    });

    assert.strictEqual(status, 201);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.id);
    assert.strictEqual(data.data.title, newTask.title);
    assert.strictEqual(data.data.priority, "High");
    assert.strictEqual(data.data.category, "Work");
    assert.strictEqual(data.data.dueDate, newTask.dueDate);
    assert.strictEqual(data.data.completed, false);
    assert.ok(data.data.createdAt);
  });

  test("POST /api/todos - rejects missing title", async () => {
    const { status, data } = await apiRequest("/api/todos", {
      method: "POST",
      body: { description: "Missing title", priority: "Low" },
    });

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.errors.some((e) => e.includes("title")));
  });

  test("POST /api/todos - rejects empty/whitespace title", async () => {
    const { status, data } = await apiRequest("/api/todos", {
      method: "POST",
      body: { title: "   ", priority: "Medium" },
    });

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.errors.some((e) => e.includes("empty")));
  });

  test("POST /api/todos - rejects invalid priority value", async () => {
    const { status, data } = await apiRequest("/api/todos", {
      method: "POST",
      body: { title: "Valid Title", priority: "UrgentNotAllowed" },
    });

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.errors.some((e) => e.includes("priority")));
  });

  test("POST /api/todos - rejects invalid dueDate format", async () => {
    const { status, data } = await apiRequest("/api/todos", {
      method: "POST",
      body: { title: "Valid Title", dueDate: "invalid-date-string" },
    });

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.errors.some((e) => e.includes("dueDate")));
  });

  // ============================================
  // PUT /api/todos/:id (Update Task)
  // ============================================
  test("PUT /api/todos/:id - successfully updates existing task", async () => {
    const updates = {
      title: "Updated Virtusa Task Title",
      priority: "Low",
      completed: true,
    };

    const { status, data } = await apiRequest("/api/todos/1", {
      method: "PUT",
      body: updates,
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.title, updates.title);
    assert.strictEqual(data.data.priority, "Low");
    assert.strictEqual(data.data.completed, true);
  });

  test("PUT /api/todos/:id - rejects empty body with no fields", async () => {
    const { status, data } = await apiRequest("/api/todos/1", {
      method: "PUT",
      body: {},
    });

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.errors.some((e) => e.includes("At least one valid field")));
  });

  test("PUT /api/todos/:id - returns 404 for non-existent ID", async () => {
    const { status, data } = await apiRequest("/api/todos/missing-id-404", {
      method: "PUT",
      body: { title: "Something" },
    });

    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
  });

  // ============================================
  // PATCH /api/todos/:id/status (Toggle & Set Status)
  // ============================================
  test("PATCH /api/todos/:id/status - toggles status when body is empty", async () => {
    const initial = await todoModel.findById(userId, "1");
    const wasCompleted = initial.completed;

    const { status, data } = await apiRequest("/api/todos/1/status", {
      method: "PATCH",
      body: {},
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.completed, !wasCompleted);
    assert.ok(data.data.completedAt);
  });

  test("PATCH /api/todos/:id/status - sets completed status explicitly", async () => {
    const { status, data } = await apiRequest("/api/todos/1/status", {
      method: "PATCH",
      body: { completed: true },
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.completed, true);
  });

  test("PATCH /api/todos/:id/status - supports status='Pending' string", async () => {
    const { status, data } = await apiRequest("/api/todos/3/status", {
      method: "PATCH",
      body: { status: "Pending" },
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.completed, false);
  });

  test("PATCH /api/todos/:id/status - rejects invalid status value", async () => {
    const { status, data } = await apiRequest("/api/todos/1/status", {
      method: "PATCH",
      body: { status: "NotAValidStatus" },
    });

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  // ============================================
  // DELETE /api/todos/:id (Delete Task)
  // ============================================
  test("DELETE /api/todos/:id - deletes existing task", async () => {
    const { status, data } = await apiRequest("/api/todos/1", {
      method: "DELETE",
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.id, "1");

    // Verify it is gone
    const fetchAfter = await apiRequest("/api/todos/1");
    assert.strictEqual(fetchAfter.status, 404);
  });

  test("DELETE /api/todos/:id - returns 404 for non-existent ID", async () => {
    const { status, data } = await apiRequest("/api/todos/unknown-delete-id", {
      method: "DELETE",
    });

    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
  });

  test("accounts authenticate, and sessions cannot access another account's tasks", async () => {
    const anonymous = await apiRequest("/api/todos", { headers: { Cookie: "" } });
    assert.equal(anonymous.status, 401);

    const credentials = { name: "Other user", email: "other@example.com", password: "another-password" };
    const signup = await apiRequest("/api/auth/signup", { method: "POST", body: credentials });
    assert.equal(signup.status, 201);
    const invalid = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { ...credentials, password: "wrong-password" },
    });
    assert.equal(invalid.status, 401);

    const login = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { ...credentials, email: credentials.email.toUpperCase() },
      headers: { Cookie: signup.cookie },
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.data.email, credentials.email);
    assert.equal(login.data.data.password_hash, undefined);
    const headers = { Cookie: login.cookie };

    const list = await apiRequest("/api/todos", { headers });
    assert.deepEqual(list.data.data, []);
    const summary = await apiRequest("/api/todos/summary", { headers });
    assert.deepEqual(summary.data.data, { completed: 0, pending: 0, total: 0 });

    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
      const body = ["PUT", "PATCH"].includes(method) ? { title: "Replacement title" } : null;
      const result = await apiRequest("/api/todos/1", { method, headers, body });
      assert.equal(result.status, 404);
    }
    const toggle = await apiRequest("/api/todos/1/status", { method: "PATCH", headers, body: {} });
    assert.equal(toggle.status, 404);

    const logout = await apiRequest("/api/auth/logout", { method: "POST", headers, body: {} });
    assert.equal(logout.status, 200);
    const session = await apiRequest("/api/auth/session", { headers });
    assert.equal(session.status, 401);
  });

  // ============================================
  // Malformed Request Body
  // ============================================
  test("POST /api/todos - returns 400 for malformed JSON", async () => {
    const { status, data } = await apiRequest("/api/todos", {
      method: "POST",
      body: "{ malformed json string:",
      headers: { "Content-Type": "application/json" },
    });

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes("Malformed JSON"));
  });
});
