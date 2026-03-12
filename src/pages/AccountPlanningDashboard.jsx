import { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "../account-planning-swiper.css";
import { superboardApi } from "../api/superboardApi.js";

const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const yearStart = 2026;
const yearEnd = 2026;

const indiaPublicHolidays2026 = {
  "01-01": "New Year's Day",
  "14-01": "Makar Sankranti",
  "26-01": "Republic Day",
  "04-03": "Holi",
  "21-03": "Id-ul-Fitr",
  "26-03": "Ram Navami",
  "31-03": "Mahavir Jayanti",
  "03-04": "Good Friday",
  "01-05": "Buddha Purnima",
  "27-05": "Id-ul-Zuha (Bakrid)",
  "26-06": "Muharram",
  "15-08": "Independence Day",
  "26-08": "Milad-un-Nabi",
  "04-09": "Janmashtami",
  "02-10": "Gandhi Jayanti",
  "20-10": "Dussehra",
  "08-11": "Diwali",
  "24-11": "Guru Nanak Jayanti",
  "25-12": "Christmas Day",
};

const taskStatusLabels = {
  brief_received: "Brief Received",
  ideation: "Ideation",
  designing: "Designing",
  internal_review: "Internal Review",
  client_review: "Client Review",
  revision: "Revision",
  approved: "Approved",
  published: "Published",
};

function formatDate(day, month, year) {
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

function formatDateFromIso(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function addDaysFromIso(isoString, daysToAdd) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  date.setDate(date.getDate() + daysToAdd);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function getStatusLabel(statusValue) {
  return taskStatusLabels[statusValue] || statusValue || "Unknown";
}

export default function AccountPlanningDashboard() {
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(2);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [allTasks, setAllTasks] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const swiperRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [clients, tasks] = await Promise.all([
          superboardApi.clients.listAll({ page_size: 200 }),
          superboardApi.tasks.originalsAll({ page_size: 200 }),
        ]);

        const clientsFromApi = clients.map((client) => client.name);
        const clientsFromTasks = tasks.map((task) => task.client_name).filter(Boolean);
        const mergedClients = [...new Set([...clientsFromApi, ...clientsFromTasks])].sort((a, b) =>
          a.localeCompare(b),
        );

        if (!isCancelled) {
          setAllTasks(tasks);
          setAllClients(mergedClients);
          setSelectedClient((prev) => (mergedClients.includes(prev) ? prev : mergedClients[0] || ""));
        }
      } catch (fetchError) {
        if (!isCancelled) {
          setError(fetchError.message || "Failed to load API data");
          setAllTasks([]);
          setAllClients([]);
          setSelectedClient("");
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  const clientWiseTasks = useMemo(() => {
    const groupedByClient = allTasks.reduce((acc, task) => {
      const clientName = task.client_name || "Unknown Client";
      if (!acc[clientName]) {
        acc[clientName] = {
          clientName,
          tasks: [],
        };
      }
      acc[clientName].tasks.push(task);
      return acc;
    }, {});

    return Object.values(groupedByClient)
      .map((group) => ({
        ...group,
        tasks: group.tasks.sort((a, b) => new Date(b.given_at) - new Date(a.given_at)),
      }))
      .sort((a, b) => b.tasks.length - a.tasks.length || a.clientName.localeCompare(b.clientName));
  }, [allTasks]);

  const slides = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const dateObj = new Date(selectedYear, selectedMonth, day);
      const weekDay = dateObj.getDay();
      const holidayKey = `${String(day).padStart(2, "0")}-${String(selectedMonth + 1).padStart(2, "0")}`;
      const holidayName = indiaPublicHolidays2026[holidayKey];

      const tasksForDay = allTasks
        .filter((task) => {
          if (!selectedClient || task.client_name !== selectedClient) return false;
          const givenDate = new Date(task.given_at);
          return (
            !Number.isNaN(givenDate.getTime()) &&
            givenDate.getFullYear() === selectedYear &&
            givenDate.getMonth() === selectedMonth &&
            givenDate.getDate() === day
          );
        })
        .map((task) => ({
          id: task.id,
          client: task.client_name,
          name: task.task_name,
          instruction: task.instructions,
          statusLabel: getStatusLabel(task.status),
          points: task.points,
          designerName: task.designer_name || "Unassigned",
          givenAt: formatDateFromIso(task.given_at),
          submittedAt: formatDateFromIso(task.submitted_at),
          dueAt: addDaysFromIso(task.given_at, 2),
        }));

      return { day, weekDay, holidayName, tasks: tasksForDay, totalDays };
    });
  }, [allTasks, selectedClient, selectedMonth, selectedYear]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (swiperRef.current) {
        swiperRef.current.update();
        swiperRef.current.slideTo(0, 0);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedClient, selectedMonth, selectedYear]);

  return (
    <section className="ap-swiper-page">
      <div className="ap2-month">
        <div className="ap2-client-wise-panel">
          <div className="ap2-client-wise-header">
            <h2>Tasks Client Wise</h2>
            <span>{clientWiseTasks.reduce((total, group) => total + group.tasks.length, 0)} Tasks</span>
          </div>

          {loading ? <p className="ap2-client-meta">Loading client-wise tasks...</p> : null}
          {error ? <p className="ap2-client-error">{error}</p> : null}

          {!loading && !error ? (
            <div className="ap2-client-wise-grid">
              {clientWiseTasks.map((group) => (
                <article key={group.clientName} className="ap2-client-wise-card">
                  <div className="ap2-client-wise-card-head">
                    <h3>{group.clientName}</h3>
                    <small>{group.tasks.length} task(s)</small>
                  </div>
                  <ul>
                    {group.tasks.slice(0, 4).map((task) => (
                      <li key={task.id}>
                        <p className="ap2-client-wise-task">{task.task_name}</p>
                        <span>{getStatusLabel(task.status)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ap2-month-header">
          <div className="ap2-calendar-controls">
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} aria-label="Select client">
              {allClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} aria-label="Select month">
              {monthNames.map((month, idx) => (
                <option key={month} value={idx}>
                  {month}
                </option>
              ))}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} aria-label="Select year">
              {Array.from({ length: yearEnd - yearStart + 1 }, (_, idx) => yearStart + idx).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="ap2-calendar-nav">
            <div className="ap2-swiper-button-prev" aria-label="Previous day">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.5 4.5L8 12l7.5 7.5" />
              </svg>
            </div>
            <div className="ap2-swiper-button-next" aria-label="Next day">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.5 4.5L16 12l-7.5 7.5" />
              </svg>
            </div>
          </div>
        </div>

        <Swiper
          className="ap2-swiper"
          modules={[Navigation, Keyboard]}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            swiper.update();
          }}
          navigation={{ nextEl: ".ap2-swiper-button-next", prevEl: ".ap2-swiper-button-prev" }}
          keyboard={{ enabled: true }}
          observer
          observeParents
          updateOnWindowResize
          slidesPerView={3}
          spaceBetween={12}
          breakpoints={{
            0: { slidesPerView: 1 },
            900: { slidesPerView: 2 },
            1280: { slidesPerView: 3 },
          }}
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.day} className="ap2-swiper-slide">
              <div className="ap2-slide-header">
                <h1>{`${dayShort[slide.weekDay]} ${slide.day}`}</h1>
                {slide.holidayName ? <small className="ap2-holiday-chip">Holiday</small> : null}
              </div>

              {slide.holidayName ? (
                <div className="ap2-holiday-card">
                  <small>India Public Holiday</small>
                  <h2>{slide.holidayName}</h2>
                  <p>{formatDate(slide.day, selectedMonth, selectedYear)}</p>
                </div>
              ) : null}

              {slide.weekDay === 0
                ? null
                : slide.tasks.map((task) => (
                    <div className="ap2-task-card" key={task.id}>
                      <small className="ap2-task-item-brand">{task.client}</small>
                      <h3 className="ap2-task-item-name">{task.name}</h3>
                      <p className="ap2-task-item-instruction">{task.instruction || "No instructions"}</p>

                      <div className="ap2-task-footer-row">
                        <div className="ap2-button-wrapper">
                          <label>Status</label>
                          <select defaultValue={task.statusLabel}>
                            <option>{task.statusLabel}</option>
                          </select>
                        </div>
                        <div className="ap2-button-wrapper">
                          <label>Client:</label>
                          <select defaultValue={selectedClient}>
                            <option>{selectedClient}</option>
                          </select>
                        </div>
                        <div className="ap2-button-wrapper">
                          <label>Points:</label>
                          <p>{task.points}</p>
                        </div>
                      </div>

                      <div className="ap2-task-footer-row">
                        <div className="ap2-button-wrapper">
                          <label>Given at:</label>
                          <p>{task.givenAt}</p>
                        </div>
                        <div className="ap2-button-wrapper">
                          <label>Submitted at:</label>
                          <p>{task.submittedAt}</p>
                        </div>
                        <div className="ap2-button-wrapper">
                          <label>Due at:</label>
                          <p>{task.dueAt}</p>
                        </div>
                      </div>
                    </div>
                  ))}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
