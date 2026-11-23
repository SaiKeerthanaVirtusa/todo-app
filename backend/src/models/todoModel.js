const { randomUUID } = require("node:crypto");
const db = require("../config/db");

const taskColumns = `
  id, title, description, priority, category, coalesce(due_date::text, '') AS "dueDate",
  completed, completed_at AS "completedAt", created_at AS "createdAt", updated_at AS "updatedAt"
`;

function normalizePriority(priority) {
  return priority[0].toUpperCase() + priority.slice(1).toLowerCase();
}

function normalizeDate(value) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date(value).toISOString().slice(0, 10);
}

class TodoModel {
  async findAll(userId, { search, status, priority, sortBy = "createdAt", order = "desc" } = {}) {
    const { rows } = await db.query(
      `SELECT ${taskColumns} FROM todos WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    let result = rows;

    // Search query filter (matches title or description)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (status && status.toLowerCase() !== "all") {
      const s = status.toLowerCase();
      if (s === "completed") {
        result = result.filter((t) => t.completed === true);
      } else if (s === "pending") {
        result = result.filter((t) => t.completed === false);
      }
    }

    // Priority filter
    if (priority && priority.toLowerCase() !== "all") {
      const p = priority.toLowerCase();
      result = result.filter((t) => t.priority.toLowerCase() === p);
    }

    // Sorting
    const priorityWeight = { High: 3, Medium: 2, Low: 1 };
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "priority") {
        comparison = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      } else if (sortBy === "dueDate") {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = dateA - dateB;
      } else if (sortBy === "title") {
        comparison = a.title.localeCompare(b.title);
      } else {
        // Default: createdAt
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        comparison = dateB - dateA; // newest first by default
      }

      return order.toLowerCase() === "asc" ? -comparison : comparison;
    });

    return result;
  }

  async findById(userId, id) {
    const { rows } = await db.query(
      `SELECT ${taskColumns} FROM todos WHERE user_id = $1 AND id = $2`, [userId, id]
    );
    return rows[0];
  }

  async create(userId, task) {
    const { rows } = await db.query(
      `INSERT INTO todos (user_id, id, title, description, priority, category, due_date, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 THEN now() END)
       RETURNING ${taskColumns}`,
      [userId, randomUUID(), task.title.trim(), (task.description || "").trim(),
        normalizePriority(task.priority || "Medium"), task.category || "Personal",
        normalizeDate(task.dueDate), Boolean(task.completed)]
    );
    return rows[0];
  }

  async update(userId, id, updates) {
    const { rows } = await db.query(
      `UPDATE todos SET
         title = coalesce($3, title),
         description = coalesce($4, description),
         priority = coalesce($5, priority),
         category = coalesce($6, category),
         due_date = CASE WHEN $7 THEN $8 ELSE due_date END,
         completed_at = CASE WHEN $9::boolean IS NULL THEN completed_at
                             WHEN NOT $9 THEN NULL
                             ELSE coalesce(completed_at, now()) END,
         completed = coalesce($9, completed),
         updated_at = now()
       WHERE user_id = $1 AND id = $2 RETURNING ${taskColumns}`,
      [userId, id, updates.title?.trim(),
        updates.description === undefined ? null : (updates.description || "").trim(),
        updates.priority ? normalizePriority(updates.priority) : null,
        updates.category, updates.dueDate !== undefined, normalizeDate(updates.dueDate),
        updates.completed === undefined ? null : Boolean(updates.completed)]
    );
    return rows[0];
  }

  async updateStatus(userId, id, completed) {
    const { rows } = await db.query(
      `UPDATE todos SET
         completed_at = CASE WHEN coalesce($3, NOT completed) THEN coalesce(completed_at, now()) END,
         completed = coalesce($3, NOT completed),
         updated_at = now()
       WHERE user_id = $1 AND id = $2 RETURNING ${taskColumns}`,
      [userId, id, completed]
    );
    return rows[0];
  }

  async delete(userId, id) {
    const { rows } = await db.query(
      `DELETE FROM todos WHERE user_id = $1 AND id = $2 RETURNING ${taskColumns}`, [userId, id]
    );
    return rows[0];
  }

  async getSummary(userId) {
    const { rows: [summary] } = await db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE completed)::int AS completed,
              count(*) FILTER (WHERE NOT completed)::int AS pending
       FROM todos WHERE user_id = $1`, [userId]
    );
    return summary;
  }
}

module.exports = new TodoModel();
