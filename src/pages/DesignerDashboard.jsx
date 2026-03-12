import { useEffect, useMemo, useState } from "react";
import { superboardApi } from "../api/superboardApi.js";

const roleDesigner = "designer";

function toStatusLabel(status) {
  return (
    {
      brief_received: "Brief Received",
      ideation: "Ideation",
      designing: "Designing",
      internal_review: "Internal Review",
      client_review: "Client Review",
      revision: "Revision",
      approved: "Approved",
      published: "Published",
    }[status] || status
  );
}

export default function DesignerDashboard() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedDesignerId, setSelectedDesignerId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setError("");
      try {
        const [allUsers, allTasks] = await Promise.all([
          superboardApi.users.listAll({ page_size: 200 }),
          superboardApi.tasks.originalsAll({ page_size: 200 }),
        ]);

        const designers = allUsers.filter((user) => user.role === roleDesigner);

        if (!cancelled) {
          setUsers(designers);
          setTasks(allTasks);
          setSelectedDesignerId((prev) => {
            if (prev && designers.some((designer) => String(designer.id) === prev)) return prev;
            return designers[0] ? String(designers[0].id) : "";
          });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Failed to load designer tasks");
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTasks = useMemo(() => {
    if (!selectedDesignerId) return [];
    return tasks.filter((task) => String(task.designer) === selectedDesignerId);
  }, [tasks, selectedDesignerId]);

  const selectedDesigner = users.find((user) => String(user.id) === selectedDesignerId);

  return (
    <section>
      <h2>Designer Dashboard</h2>
      <p className="muted">My assigned work, timelines, and delivery status.</p>
      {error ? <p className="muted">{error}</p> : null}

      <div className="panel" style={{ marginBottom: 14 }}>
        <label htmlFor="designer-filter" style={{ display: "block", marginBottom: 8 }}>
          Designer
        </label>
        <select
          id="designer-filter"
          value={selectedDesignerId}
          onChange={(event) => setSelectedDesignerId(event.target.value)}
          style={{ minWidth: 280, padding: 8 }}
        >
          {users.map((designer) => (
            <option key={designer.id} value={designer.id}>
              {designer.first_name || designer.last_name
                ? `${designer.first_name} ${designer.last_name}`.trim()
                : designer.email}
            </option>
          ))}
        </select>
      </div>

      <div className="panel">
        {filteredTasks.length === 0 ? (
          <p className="muted">No tasks found for {selectedDesigner?.email || "selected designer"}.</p>
        ) : (
          filteredTasks.map((task) => (
            <div className="task-row" key={task.id}>
              <div>
                <strong>{task.task_name}</strong>
                <p>{task.client_name}</p>
              </div>
              <span className="badge">{toStatusLabel(task.status)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
