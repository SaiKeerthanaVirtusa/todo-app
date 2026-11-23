const ALLOWED_CATEGORIES = ["Work", "Personal", "Study", "Other"];
const ALLOWED_PRIORITIES = ["low", "medium", "high"];

/**
 * Validates date string (e.g., YYYY-MM-DD or ISO 8601)
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== "string") return false;
  // Check regex format YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (regex.test(dateStr)) {
    const date = new Date(dateStr + "T00:00:00Z");
    return !isNaN(date) && date.toISOString().slice(0, 10) === dateStr && !dateStr.startsWith("0000");
  }
  // Also check standard ISO
  const date = new Date(dateStr);
  return !isNaN(date) && date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999;
}

/**
 * Validate request body for creating a new task
 */
function validateCreateTodo(req) {
  const errors = [];
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return ["Request body must be a valid JSON object."];
  }

  // Title validation (required)
  if (body.title === undefined || body.title === null) {
    errors.push("Field 'title' is required.");
  } else if (typeof body.title !== "string") {
    errors.push("Field 'title' must be a string.");
  } else if (!body.title.trim()) {
    errors.push("Task title cannot be empty or contain only whitespace.");
  } else if (body.title.trim().length > 200) {
    errors.push("Task title cannot exceed 200 characters.");
  }

  // Description validation (optional)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      errors.push("Field 'description' must be a string.");
    } else if (body.description.length > 2000) {
      errors.push("Description cannot exceed 2000 characters.");
    }
  }

  // Priority validation (optional, defaults to Medium)
  if (body.priority !== undefined && body.priority !== null) {
    if (typeof body.priority !== "string") {
      errors.push("Field 'priority' must be a string.");
    } else if (!ALLOWED_PRIORITIES.includes(body.priority.toLowerCase())) {
      errors.push("Field 'priority' must be one of: 'Low', 'Medium', 'High'.");
    }
  }

  if (body.category !== undefined && !ALLOWED_CATEGORIES.includes(body.category)) {
    errors.push("Category must be Work, Personal, Study, or Other.");
  }

  // Due Date validation (optional)
  if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "") {
    if (!isValidDate(body.dueDate)) {
      errors.push("Field 'dueDate' must be a valid date format (YYYY-MM-DD).");
    }
  }

  // Completed validation (optional, defaults to false)
  if (body.completed !== undefined && body.completed !== null) {
    if (typeof body.completed !== "boolean") {
      errors.push("Field 'completed' must be a boolean (true or false).");
    }
  }

  return errors;
}

/**
 * Validate request body for updating an existing task
 */
function validateUpdateTodo(req) {
  const errors = [];
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return ["Request body must be a valid JSON object."];
  }

  const allowedFields = ["title", "description", "priority", "dueDate", "completed", "category"];
  const providedFields = Object.keys(body).filter((key) => allowedFields.includes(key));

  if (providedFields.length === 0) {
    return ["At least one valid field ('title', 'description', 'priority', 'dueDate', 'completed', 'category') must be provided for update."];
  }

  // Title validation (if provided)
  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      errors.push("Field 'title' must be a string.");
    } else if (!body.title.trim()) {
      errors.push("Task title cannot be empty or contain only whitespace.");
    } else if (body.title.trim().length > 200) {
      errors.push("Task title cannot exceed 200 characters.");
    }
  }

  // Description validation (if provided)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      errors.push("Field 'description' must be a string.");
    } else if (body.description.length > 2000) {
      errors.push("Description cannot exceed 2000 characters.");
    }
  }

  // Priority validation (if provided)
  if (body.priority !== undefined && body.priority !== null) {
    if (typeof body.priority !== "string") {
      errors.push("Field 'priority' must be a string.");
    } else if (!ALLOWED_PRIORITIES.includes(body.priority.toLowerCase())) {
      errors.push("Field 'priority' must be one of: 'Low', 'Medium', 'High'.");
    }
  }

  if (body.category !== undefined && !ALLOWED_CATEGORIES.includes(body.category)) {
    errors.push("Category must be Work, Personal, Study, or Other.");
  }

  // Due Date validation (if provided)
  if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "") {
    if (!isValidDate(body.dueDate)) {
      errors.push("Field 'dueDate' must be a valid date format (YYYY-MM-DD).");
    }
  }

  // Completed validation (if provided)
  if (body.completed !== undefined && body.completed !== null) {
    if (typeof body.completed !== "boolean") {
      errors.push("Field 'completed' must be a boolean (true or false).");
    }
  }

  return errors;
}

/**
 * Validate request body for status update (PATCH /api/todos/:id/status)
 */
function validateStatusUpdate(req) {
  const errors = [];
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return ["Request body must be a valid JSON object."];
  }

  // Check if body is empty - allowed if intended as toggle
  if (Object.keys(body).length === 0) {
    return []; // No errors, controller will toggle current status
  }

  const hasCompleted = body.completed !== undefined;
  const hasStatus = body.status !== undefined;

  if (!hasCompleted && !hasStatus) {
    errors.push("Request body must include either 'completed' (boolean) or 'status' ('Completed' / 'Pending').");
  }

  if (hasCompleted && typeof body.completed !== "boolean") {
    errors.push("Field 'completed' must be a boolean (true or false).");
  }

  if (hasStatus) {
    if (typeof body.status !== "string") {
      errors.push("Field 'status' must be a string.");
    } else {
      const s = body.status.toLowerCase();
      if (s !== "completed" && s !== "pending") {
        errors.push("Field 'status' must be either 'Completed' or 'Pending'.");
      }
    }
  }

  return errors;
}

/**
 * Validate ID route parameter
 */
function validateIdParam(req) {
  const errors = [];
  const id = req.params.id;

  if (!id || !id.toString().trim()) {
    errors.push("Route parameter 'id' is required.");
  } else if (id.length > 100) {
    errors.push("Invalid 'id' parameter format.");
  }

  return errors;
}

module.exports = {
  validateCreateTodo,
  validateUpdateTodo,
  validateStatusUpdate,
  validateIdParam,
};
