# VIT Team 3 – To-Do App | Backend API

Robust, modular RESTful API built with **Node.js** and **Express.js** for the VIT Team 3 To-Do Application.

## Team Details

- **Project:** VIT Team 3 To-Do Application
- **Backend Developers:**
  - **Kaligotla Venkata Vasistha Ramana Rao (Vasistha)** — GitHub: [@VasisthaVirtusa](https://github.com/VasisthaVirtusa)
  - **Krish Gupta**

---

## Run locally

1. Start PostgreSQL and create a dedicated database. For an existing local server and role, run `createdb taskly`.
2. From the project root, set up and start Express.

   ```bash
   cd backend
   npm ci
   cp .env.example .env
   # Edit DATABASE_URL in .env to match your PostgreSQL connection.
   npm run db:migrate
   npm run dev
   ```

3. In a second terminal, start Next.js from the project root.

   ```bash
   npm ci
   npm run dev
   ```

4. Open http://localhost:3000/login and choose **Create an account**. The previous demo login did not register accounts. Each new account starts with an empty workspace.

Next.js forwards authentication and task requests to Express on port 5500. If Express runs elsewhere, set `API_BACKEND_URL` in the project-root `.env.local` before starting or building Next.js. If you change `PORT` in `backend/.env`, set `API_BACKEND_URL` to the matching address. Keep the browser on the Next.js origin. Production sessions use secure cookies. For a local HTTP production build, set `COOKIE_SECURE=false` in the backend environment.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create an account with `name`, `email`, and `password`, then sign in |
| POST | `/api/auth/login` | Sign in with `email` and `password` |
| GET | `/api/auth/session` | Read the signed-in account |
| POST | `/api/auth/logout` | End the current session |
| GET, POST | `/api/todos` | List or create tasks |
| GET | `/api/todos/summary` | Read task counts |
| GET, PUT, PATCH, DELETE | `/api/todos/:id` | Read, update, or delete a task |
| PATCH | `/api/todos/:id/status` | Set or toggle completion |

Send JSON for signup, login, logout, and task writes. Account emails are case-insensitive. Passwords are salted and hashed with scrypt. Signup and login return an HTTP-only session cookie. All task routes derive ownership from that session. The database stores categories and completion timestamps with each task.

The task list accepts `search`, `status` (or `filter`), `priority`, `sortBy`, and `order`. The status endpoint accepts `completed` (a Boolean), `status` (`Completed` or `Pending`), or an empty JSON object to toggle.

## Request & Response Samples

### 1. Get All Tasks
- **Request:** `GET /api/todos?search=Virtusa&status=pending`
- **Response:** `200 OK`
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-47a8-9012-abcdef123456",
      "title": "Complete Virtusa Backend API",
      "description": "Implement modular Express.js REST API with full CRUD operations and validation.",
      "priority": "High",
      "dueDate": "2026-11-20",
      "completed": false,
      "createdAt": "2026-11-15T16:00:00.000Z",
      "updatedAt": "2026-11-15T16:00:00.000Z"
    }
  ]
}
```

### 2. Get Task Summary
- **Request:** `GET /api/todos/summary`
- **Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "total": 3,
    "pending": 2,
    "completed": 1
  }
}
```

### 3. Create a New Task
- **Request:** `POST /api/todos`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "title": "Build Presentation Slides",
  "description": "Prepare architecture diagrams and demo walkthrough for project evaluation.",
  "priority": "High",
  "dueDate": "2026-11-25",
  "completed": false
}
```
- **Response:** `201 Created`
```json
{
  "success": true,
  "message": "Task created successfully.",
  "data": {
    "id": "c1f7f502-39f2-45e6-993d-d60fdfb5eb7b",
    "title": "Build Presentation Slides",
    "description": "Prepare architecture diagrams and demo walkthrough for project evaluation.",
    "priority": "High",
    "dueDate": "2026-11-25",
    "completed": false,
    "createdAt": "2026-11-16T16:50:00.000Z",
    "updatedAt": "2026-11-16T16:50:00.000Z"
  }
}
```

### 4. Update Task Status
- **Request:** `PATCH /api/todos/1/status`
- **Body:**
```json
{
  "completed": true
}
```
- **Response:** `200 OK`
```json
{
  "success": true,
  "message": "Task marked as Completed.",
  "data": {
    "id": "a1b2c3d4-e5f6-47a8-9012-abcdef123456",
    "title": "Complete Virtusa Backend API",
    "completed": true,
    "updatedAt": "2026-11-16T16:52:00.000Z"
  }
}
```

### 5. Validation Error (Example)
- **Request:** `POST /api/todos`
- **Body:** `{ "title": "   ", "priority": "InvalidPriority" }`
- **Response:** `400 Bad Request`
```json
{
  "success": false,
  "message": "Validation Error",
  "errors": [
    "Task title cannot be empty or contain only whitespace.",
    "Field 'priority' must be one of: 'Low', 'Medium', 'High'."
  ]
}
```

### 6. Resource Not Found (Example)
- **Request:** `GET /api/todos/99999`
- **Response:** `404 Not Found`
```json
{
  "success": false,
  "message": "Task with ID '99999' was not found."
}
```

---

## Tests

From `backend`, point the suite at a PostgreSQL test database. The test role needs permission to create schemas. The suite applies the migration in a temporary schema and removes that schema afterward.

```bash
TEST_DATABASE_URL=postgresql://localhost/taskly_test npm test
```
