"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const CATEGORIES = ["Work", "Personal", "Study", "Other"];
const FILTERS = ["All tasks", "Today", "Upcoming", "Completed", "Overdue"];

function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey() {
  return dateKey(new Date());
}

function taskRequest(path = "", options) {
  return apiRequest(`/todos${path}`, options);
}

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [apiError, setApiError] = useState("");

  const [view, setView] = useState("All tasks");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedDate, setSelectedDate] = useState("");
  const [sort, setSort] = useState("date");

  const [theme, setTheme] = useState("light");
  const [month, setMonth] = useState(new Date());

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    dueDate: "",
    category: "Personal",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const session = await apiRequest("/auth/session");
        if (cancelled) return;

        setTheme(localStorage.getItem("taskly-theme") || "light");
        setUser(session.data);

        const response = await taskRequest();
        if (!cancelled) setTasks(response.data);
      } catch (error) {
        if (cancelled) return;
        if (error.status === 401) {
          setUser(null);
          router.replace("/login");
        } else {
          setApiError(`Could not load workspace: ${error.message}`);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadWorkspace();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (user) localStorage.setItem("taskly-theme", theme);
  }, [theme, user]);

  function handleTaskError(message, error) {
    if (error.status === 401) {
      setUser(null);
      setTasks([]);
      router.replace("/login");
    } else {
      setApiError(`${message}: ${error.message}`);
    }
  }

  // Dashboard calculations
  const today = todayKey();

  const completed = tasks.filter((t) => t.completed).length;
  const pending = tasks.length - completed;

  const overdue = tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate < today
  ).length;

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  const todaysTasks = tasks.filter(
    (t) => !t.completed && t.dueDate === today
  );

  const upcoming = tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate > today
  );

  // Search, filter and sort tasks
  const visibleTasks = useMemo(() => {
    let result = tasks.filter((t) => {
      const q = search.toLowerCase();

      const matchSearch =
        t.title.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q);

      const matchCategory =
        categoryFilter === "All" ||
        (t.category || "Personal") === categoryFilter;

      const matchSelectedDate =
        !selectedDate || t.dueDate === selectedDate;

      let matchView = true;

      if (view === "Today") {
        matchView = t.dueDate === today;
      }

      if (view === "Upcoming") {
        matchView =
          !t.completed && t.dueDate && t.dueDate > today;
      }

      if (view === "Completed") {
        matchView = t.completed;
      }

      if (view === "Overdue") {
        matchView =
          !t.completed && t.dueDate && t.dueDate < today;
      }

      return (
        matchSearch &&
        matchView &&
        matchCategory &&
        matchSelectedDate
      );
    });

    result.sort((a, b) => {
      if (sort === "priority") {
        return (
          ({ High: 0, Medium: 1, Low: 2 }[a.priority] ?? 1) -
          ({ High: 0, Medium: 1, Low: 2 }[b.priority] ?? 1)
        );
      }

      if (sort === "title") {
        return a.title.localeCompare(b.title);
      }

      return (a.dueDate || "9999").localeCompare(
        b.dueDate || "9999"
      );
    });

    return result;
  }, [
    tasks,
    view,
    search,
    sort,
    today,
    categoryFilter,
    selectedDate,
  ]);

  // Form helpers
  function updateForm(key, value) {
    setForm((old) => ({
      ...old,
      [key]: value,
    }));
  }

  function resetForm() {
    setForm({
      title: "",
      description: "",
      priority: "Medium",
      dueDate: "",
      category: "Personal",
    });

    setEditingId(null);
    setShowForm(false);
  }

  // CREATE task or UPDATE task
  async function saveTask(e) {
    e.preventDefault();

    if (!form.title.trim()) return;

    setApiError("");

    const payload = {
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      dueDate: form.dueDate || "",
      category: form.category,
    };

    try {
      if (editingId !== null) {
        const { data: updated } = await taskRequest(`/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setTasks((old) => old.map((task) => task.id === editingId ? updated : task));
      } else {
        const { data: created } = await taskRequest("", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setTasks((old) => [created, ...old]);
      }
      resetForm();
    } catch (error) {
      handleTaskError("Could not save task", error);
    }
  }

  // Open edit form
  function editTask(task) {
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "Medium",
      dueDate: task.dueDate || "",
      category: task.category || "Personal",
    });

    setEditingId(task.id);
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // DELETE task
  async function deleteTask(id) {
    if (
      !window.confirm("Are you sure you want to delete this task?")
    ) {
      return;
    }

    setApiError("");

    try {
      await taskRequest(`/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      setTasks((old) => old.filter((task) => task.id !== id));
    } catch (error) {
      handleTaskError("Could not delete task", error);
    }
  }

  // MARK task complete or pending
  async function toggleTask(id) {
    const task = tasks.find((item) => item.id === id);

    if (!task) return;

    const nextCompleted = !task.completed;

    setApiError("");

    try {
      const { data: updated } = await taskRequest(`/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ completed: nextCompleted }),
      });
      setTasks((old) => old.map((item) => item.id === id ? updated : item));
    } catch (error) {
      handleTaskError("Could not update task status", error);
    }
  }

  // Calendar calculations
  const monthStart = new Date(
    month.getFullYear(),
    month.getMonth(),
    1
  );

  const startOffset = (monthStart.getDay() + 6) % 7;

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();

  const calendarCells = Array.from(
    {
      length: Math.ceil((startOffset + daysInMonth) / 7) * 7,
    },
    (_, i) => {
      const day = i - startOffset + 1;

      return day > 0 && day <= daysInMonth ? day : null;
    }
  );

  const tasksForDay = (day) =>
    tasks.filter(
      (t) =>
        t.dueDate ===
        dateKey(
          new Date(month.getFullYear(), month.getMonth(), day)
        )
    );

  // Weekly productivity chart
  const weekStats = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));

    const key = dateKey(d);

    return {
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
      }),
      count: tasks.filter(
        (t) =>
          t.completed &&
          dateKey(t.completedAt || t.createdAt) === key
      ).length,
    };
  });

  const maxWeek = Math.max(1, ...weekStats.map((x) => x.count));

  // Logout
  async function logout() {
    setSigningOut(true);
    try {
      await apiRequest("/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
      setTasks([]);
      router.replace("/login");
    } catch (error) {
      setApiError(`Could not log out: ${error.message}`);
      setSigningOut(false);
    }
  }

  // Authentication loading screen
  if (!user) {
    return (
      <main className="auth-loading">
        <div className="loading-mark">✓</div>
        <p role={apiError ? "alert" : undefined}>{apiError || "Opening your workspace..."}</p>
      </main>
    );
  }

  return (
    <main className={`app-shell ${theme === "dark" ? "dark-theme" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-mark">✓</span>
          <span>
            taskly<span className="brand-dot">.</span>
          </span>
        </a>

        <div className="side-label">WORKSPACE</div>

        <nav className="side-nav">
          {FILTERS.map((name, i) => (
            <button
              key={name}
              className={view === name ? "nav-item active" : "nav-item"}
              onClick={() => setView(name)}
            >
              <span className="nav-icon">
                {["▦", "◷", "▤", "✓", "!"][i]}
              </span>

              {name}

              <span className="nav-count">
                {name === "All tasks"
                  ? tasks.length
                  : name === "Today"
                  ? todaysTasks.length
                  : name === "Upcoming"
                  ? upcoming.length
                  : name === "Completed"
                  ? completed
                  : overdue}
              </span>
            </button>
          ))}
        </nav>

        <div className="side-label category-label">CATEGORIES</div>

        {CATEGORIES.map((c, i) => (
          <button
            key={c}
            className="category-link"
            onClick={() => {
              setView("All tasks");
              setSelectedDate("");
              setCategoryFilter(c);
              setSearch("");
            }}
          >
            <span className={`category-dot dot-${i}`}></span>
            {c}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="mini-progress">
            <div className="mini-progress-top">
              <span>Weekly progress</span>
              <b>{progress}%</b>
            </div>

            <div className="progress-track">
              <i style={{ width: `${progress}%` }} />
            </div>

            <small>
              {completed} of {tasks.length} tasks completed
            </small>
          </div>

          <div className="profile">
            <span className="avatar">{user.name[0].toUpperCase()}</span>

            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{view}</b>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              title="Overdue task notifications"
              onClick={() => setNotice(!notice)}
            >
              ♧
              {overdue > 0 && <i className="notification-dot" />}
            </button>

            <button
              className="theme-button"
              onClick={() =>
                setTheme(theme === "light" ? "dark" : "light")
              }
            >
              {theme === "light" ? "☾" : "☀"}
              <span>
                {theme === "light" ? "Dark mode" : "Light mode"}
              </span>
            </button>

            <span className="avatar">{user.name[0].toUpperCase()}</span>

            <button className="logout-button" onClick={logout} disabled={signingOut}>
              Log out ↗
            </button>
          </div>

          {notice && (
            <div className="notification-pop">
              <b>Task reminders</b>

              <p>
                {overdue
                  ? `You have ${overdue} overdue task${
                      overdue > 1 ? "s" : ""
                    }. Take a look below.`
                  : "You're all caught up. No overdue tasks!"}
              </p>

              <button
                onClick={() => {
                  setView("Overdue");
                  setNotice(false);
                }}
              >
                View overdue tasks
              </button>
            </div>
          )}
        </header>

        <div className="content">
          {apiError && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background: "#fff1f0",
                color: "#a32620",
              }}
            >
              {apiError}
            </div>
          )}

          {!loaded && (
            <p style={{ marginBottom: 16 }}>
              Loading tasks from the backend...
            </p>
          )}

          <section className="hero">
            <div>
              <p className="eyebrow">YOUR PRODUCTIVITY SPACE</p>

              <h1>
                Make today <span>count.</span>
              </h1>

              <p className="welcome-copy">
                A little progress each day adds up to big results.
                Let’s get things done.
              </p>

              <div className="today-line">
                ✦{" "}
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>

            <button
              className="primary-btn hero-add"
              onClick={() => {
                setEditingId(null);
                setForm({
                  title: "",
                  description: "",
                  priority: "Medium",
                  dueDate: "",
                  category: "Personal",
                });
                setShowForm(true);
              }}
            >
              ＋ Add new task
            </button>
          </section>

          <section className="stats">
            <article className="stat-card">
              <div className="stat-icon purple">▦</div>
              <span>Total tasks</span>
              <strong>{tasks.length}</strong>
              <small>Across all categories</small>
            </article>

            <article className="stat-card">
              <div className="stat-icon amber">◷</div>
              <span>In progress</span>
              <strong>{pending}</strong>
              <small>{todaysTasks.length} due today</small>
            </article>

            <article className="stat-card">
              <div className="stat-icon green">✓</div>
              <span>Completed</span>
              <strong>{completed}</strong>
              <small>{progress}% completion rate</small>
            </article>

            <article className="stat-card">
              <div className="stat-icon rose">!</div>
              <span>Overdue</span>
              <strong>{overdue}</strong>
              <small>Need your attention</small>
            </article>
          </section>

          {showForm && (
            <section className="form-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">
                    {editingId ? "UPDATE DETAILS" : "PLAN SOMETHING GREAT"}
                  </p>

                  <h2>{editingId ? "Edit task" : "Create a new task"}</h2>
                </div>

                <button className="close-button" onClick={resetForm}>
                  ×
                </button>
              </div>

              <form onSubmit={saveTask}>
                <div className="form-grid">
                  <div className="field full">
                    <label>Task title *</label>

                    <input
                      autoFocus
                      value={form.title}
                      onChange={(e) => updateForm("title", e.target.value)}
                      placeholder="What needs to get done?"
                      required
                    />
                  </div>

                  <div className="field full">
                    <label>Description</label>

                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        updateForm("description", e.target.value)
                      }
                      placeholder="Add a few details..."
                      rows="2"
                    />
                  </div>

                  <div className="field">
                    <label>Priority</label>

                    <select
                      value={form.priority}
                      onChange={(e) =>
                        updateForm("priority", e.target.value)
                      }
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Due date</label>

                    <input
                      type="date"
                      min={today}
                      value={form.dueDate}
                      onChange={(e) =>
                        updateForm("dueDate", e.target.value)
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Category</label>

                    <select
                      value={form.category}
                      onChange={(e) =>
                        updateForm("category", e.target.value)
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>

                  <button className="primary-btn" type="submit">
                    {editingId ? "Save changes" : "Create task"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <div className="dashboard-grid">
            <section className="panel task-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">STAY ON TRACK</p>

                  <h2>
                    {view}
                    <span className="task-count">{visibleTasks.length}</span>
                  </h2>
                </div>
              </div>

              <div className="toolbar">
                <div className="search-box">
                  <span>⌕</span>

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your tasks..."
                  />
                </div>

                <select
                  className="sort-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="date">Sort: Due date</option>
                  <option value="priority">Sort: Priority</option>
                  <option value="title">Sort: Name</option>
                </select>
              </div>

              <div className="task-list">
                {visibleTasks.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-illustration">✧</div>

                    <h3>
                      {search
                        ? "No matching tasks"
                        : "Nothing here just yet"}
                    </h3>

                    <p>
                      {search
                        ? "Try another search term."
                        : "Add a task and make your day more productive."}
                    </p>

                    <button
                      className="primary-btn"
                      onClick={() => setShowForm(true)}
                    >
                      ＋ Create a task
                    </button>
                  </div>
                ) : (
                  visibleTasks.map((task) => (
                    <article
                      className={`task-card ${
                        task.completed ? "task-done" : ""
                      }`}
                      key={task.id}
                    >
                      <label className="task-check">
                        <input
                          type="checkbox"
                          checked={!!task.completed}
                          onChange={() => toggleTask(task.id)}
                        />

                        <span className="checkmark">✓</span>
                      </label>

                      <div className="task-content">
                        <h3>{task.title}</h3>

                        {task.description && (
                          <p className="task-description">
                            {task.description}
                          </p>
                        )}

                        <div className="task-meta">
                          <span
                            className={`priority ${
                              (task.priority || "Medium").toLowerCase()
                            }`}
                          >
                            {task.priority || "Medium"}
                          </span>

                          <span className="category-pill">
                            {task.category || "Personal"}
                          </span>

                          {task.dueDate && (
                            <span
                              className={
                                !task.completed && task.dueDate < today
                                  ? "due overdue"
                                  : "due"
                              }
                            >
                              ▦{" "}
                              {new Date(
                                task.dueDate + "T00:00:00"
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="task-actions">
                        <button
                          title="Edit task"
                          onClick={() => editTask(task)}
                        >
                          ✎
                        </button>

                        <button
                          title="Delete task"
                          onClick={() => deleteTask(task.id)}
                        >
                          ⌫
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <div className="right-column">
              <section className="panel calendar-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">PLAN AHEAD</p>
                    <h2>Calendar</h2>
                  </div>

                  <div className="calendar-nav">
                    <button
                      onClick={() =>
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() - 1,
                            1
                          )
                        )
                      }
                    >
                      ‹
                    </button>

                    <button
                      onClick={() =>
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            1
                          )
                        )
                      }
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="month-title">
                  {month.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>

                <div className="calendar-grid">
                  {["M", "T", "W", "T", "F", "S", "S"].map(
                    (d, i) => (
                      <span className="weekday" key={i}>
                        {d}
                      </span>
                    )
                  )}

                  {calendarCells.map((day, i) =>
                    day ? (
                      <button
                        key={i}
                        className={`calendar-day ${
                          dateKey(
                            new Date(
                              month.getFullYear(),
                              month.getMonth(),
                              day
                            )
                          ) === today
                            ? "is-today"
                            : ""
                        }`}
                        onClick={() => {
                          setView("All tasks");
                          setCategoryFilter("All");

                          setSelectedDate(
                            dateKey(
                              new Date(
                                month.getFullYear(),
                                month.getMonth(),
                                day
                              )
                            )
                          );
                        }}
                        title={
                          tasksForDay(day)
                            .map((t) => t.title)
                            .join(", ") || "No tasks"
                        }
                      >
                        {day}
                        {tasksForDay(day).length > 0 && <i />}
                      </button>
                    ) : (
                      <span key={i} />
                    )
                  )}
                </div>

                <div className="calendar-legend">
                  <span>
                    <i /> Tasks scheduled
                  </span>

                  <span>
                    <b /> Today
                  </span>
                </div>
              </section>

              <section className="panel analytics-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">YOUR ACTIVITY</p>
                    <h2>Productivity</h2>
                  </div>

                  <span className="chart-tag">Last 7 days</span>
                </div>

                <div className="chart-area">
                  {weekStats.map((d, i) => (
                    <div className="bar-column" key={i}>
                      <div className="bar-value">{d.count || ""}</div>

                      <div className="bar-track">
                        <i
                          style={{
                            height: `${Math.max(
                              5,
                              (d.count / maxWeek) * 100
                            )}%`,
                          }}
                        />
                      </div>

                      <span>{d.label}</span>
                    </div>
                  ))}
                </div>

                <div className="chart-foot">
                  <span>Tasks completed</span>
                  <b>{completed} total</b>
                </div>
              </section>

              <section className="focus-card">
                <div className="focus-star">✦</div>

                <h3>Keep your momentum</h3>

                <p>
                  Every completed task is a step closer to your goals.
                  Keep going!
                </p>

                <div className="focus-progress">
                  <span style={{ width: `${progress}%` }} />
                </div>

                <small>{progress}% of your tasks completed</small>
              </section>
            </div>
          </div>

          <footer className="app-footer">
            Made for your goals <span>♥</span> One task at a time.
          </footer>
        </div>
      </section>
    </main>
  );
}