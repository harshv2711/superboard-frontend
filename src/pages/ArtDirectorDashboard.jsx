import { useEffect, useState } from "react";
import { superboardApi } from "../api/superboardApi.js";

export default function ArtDirectorDashboard() {
  const [cards, setCards] = useState([
    { title: "Clients", value: "-" },
    { title: "Brands", value: "-" },
    { title: "Scope Items", value: "-" },
    { title: "Original Tasks", value: "-" },
    { title: "Revisions", value: "-" },
  ]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setError("");
      try {
        const [clients, brands, scopeItems, tasks, revisions] = await Promise.all([
          superboardApi.clients.listAll({ page_size: 200 }),
          superboardApi.brands.listAll({ page_size: 200 }),
          superboardApi.scopeOfWork.listAll({ page_size: 200 }),
          superboardApi.tasks.originalsAll({ page_size: 200 }),
          superboardApi.tasks.onlyRevisionsAll({ page_size: 200 }),
        ]);

        if (!cancelled) {
          setCards([
            { title: "Clients", value: String(clients.length) },
            { title: "Brands", value: String(brands.length) },
            { title: "Scope Items", value: String(scopeItems.length) },
            { title: "Original Tasks", value: String(tasks.length) },
            { title: "Revisions", value: String(revisions.length) },
          ]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Failed to load dashboard metrics");
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h2>Art Director Dashboard</h2>
      <p className="muted">Creative quality, approvals, and visual direction.</p>
      {error ? <p className="muted">{error}</p> : null}
      <div className="grid-3">
        {cards.map((card) => (
          <article className="stat-card" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
