import { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "../account-planning-swiper.css";
import { superboardApi } from "../api/superboardApi.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function formatDate(day, month, year) {
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

function formatDateFromIso(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function getTaskTypeLabel(task) {
  if (task?.redo_of) return "Redo";
  if (task?.revision_of) return "Revision";
  return "Original";
}

function getTaskDateParts(task) {
  const rawValue = task?.created_at;
  if (!rawValue) return null;

  const rawText = String(rawValue);
  const match = rawText.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]) - 1,
      day: Number(match[3]),
    };
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return {
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth(),
    day: parsedDate.getDate(),
  };
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
          superboardApi.tasks.listAll({ page_size: 200 }),
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

  useEffect(() => {
    if (!allTasks.length) return;

    const tasksForClient = allTasks.filter((task) => !selectedClient || task.client_name === selectedClient);
    if (!tasksForClient.length) return;

    const hasVisibleTask = tasksForClient.some((task) => {
      const parts = getTaskDateParts(task);
      return parts && parts.year === selectedYear && parts.month === selectedMonth;
    });

    if (hasVisibleTask) return;

    const firstTaskWithDate = tasksForClient
      .map((task) => ({ task, parts: getTaskDateParts(task) }))
      .filter(({ parts }) => parts)
      .sort((a, b) => {
        const aTime = new Date(a.parts.year, a.parts.month, a.parts.day).getTime();
        const bTime = new Date(b.parts.year, b.parts.month, b.parts.day).getTime();
        return aTime - bTime;
      })[0];

    if (!firstTaskWithDate) return;

    setSelectedYear(firstTaskWithDate.parts.year);
    setSelectedMonth(firstTaskWithDate.parts.month);
  }, [allTasks, selectedClient, selectedMonth, selectedYear]);

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
        tasks: group.tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
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
          const targetDate = new Date(task.created_at);
          return (
            !Number.isNaN(targetDate.getTime()) &&
            targetDate.getFullYear() === selectedYear &&
            targetDate.getMonth() === selectedMonth &&
            targetDate.getDate() === day
          );
        })
        .map((task) => ({
          id: task.id,
          client: task.client_name,
          name: task.task_name,
          instruction: task.instructions,
          statusLabel: getTaskTypeLabel(task),
          designerName: task.designer_name || "Unassigned",
          targetDate: formatDateFromIso(task.created_at),
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
                        <span>{getTaskTypeLabel(task)}</span>
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
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger aria-label="Select client" className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
              {allClients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
              <SelectTrigger aria-label="Select month" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
              {monthNames.map((month, idx) => (
                <SelectItem key={month} value={String(idx)}>
                  {month}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
              <SelectTrigger aria-label="Select year" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
              {Array.from({ length: yearEnd - yearStart + 1 }, (_, idx) => yearStart + idx).map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
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
                          <Select value={task.statusLabel} disabled>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              <SelectItem value={task.statusLabel}>{task.statusLabel}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="ap2-button-wrapper">
                          <label>Client:</label>
                          <Select value={selectedClient} disabled>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              <SelectItem value={selectedClient}>{selectedClient}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="ap2-task-footer-row">
                        <div className="ap2-button-wrapper">
                          <label>Target date:</label>
                          <p>{task.targetDate}</p>
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
