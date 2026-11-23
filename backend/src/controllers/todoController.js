const todoModel = require("../models/todoModel");

/**
 * Controller handling To-Do CRUD business logic
 */
class TodoController {
  /**
   * GET /api/todos
   * Retrieve all tasks with optional search, status filtering, and sorting
   */
  async getTodos(req, res, next) {
    try {
      const { search, filter, status, priority, sortBy, order } = req.query;
      const effectiveStatus = status || filter;

      const todos = await todoModel.findAll(req.user.id, {
        search,
        status: effectiveStatus,
        priority,
        sortBy,
        order,
      });

      return res.status(200).json({
        success: true,
        count: todos.length,
        data: todos,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/todos/summary
   * Get task counts (total, pending, completed) for dashboard metrics
   */
  async getSummary(req, res, next) {
    try {
      const summary = await todoModel.getSummary(req.user.id);
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/todos/:id
   * Retrieve an individual task by its ID
   */
  async getTodoById(req, res, next) {
    try {
      const { id } = req.params;
      const todo = await todoModel.findById(req.user.id, id);

      if (!todo) {
        return res.status(404).json({
          success: false,
          message: `Task with ID '${id}' was not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        data: todo,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/todos
   * Create a new task
   */
  async createTodo(req, res, next) {
    try {
      const { title, description, priority, dueDate, completed, category } = req.body;

      const newTask = await todoModel.create(req.user.id, {
        title,
        description,
        priority,
        dueDate,
        completed,
        category,
      });

      return res.status(201).json({
        success: true,
        message: "Task created successfully.",
        data: newTask,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/todos/:id or PATCH /api/todos/:id
   * Update an existing task
   */
  async updateTodo(req, res, next) {
    try {
      const { id } = req.params;
      const updatedTask = await todoModel.update(req.user.id, id, req.body);

      if (!updatedTask) {
        return res.status(404).json({
          success: false,
          message: `Task with ID '${id}' was not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Task updated successfully.",
        data: updatedTask,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/todos/:id/status
   * Mark a task as completed or pending, or toggle current status
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { completed, status } = req.body;
      const newStatus = status === undefined ? completed : completed ?? (status.toLowerCase() === "completed");
      const updatedTask = await todoModel.updateStatus(req.user.id, id, newStatus);

      if (!updatedTask) {
        return res.status(404).json({
          success: false,
          message: `Task with ID '${id}' was not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Task marked as ${updatedTask.completed ? "Completed" : "Pending"}.`,
        data: updatedTask,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/todos/:id
   * Delete a task by ID
   */
  async deleteTodo(req, res, next) {
    try {
      const { id } = req.params;
      const deletedTask = await todoModel.delete(req.user.id, id);

      if (!deletedTask) {
        return res.status(404).json({
          success: false,
          message: `Task with ID '${id}' was not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Task deleted successfully.",
        data: deletedTask,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TodoController();
