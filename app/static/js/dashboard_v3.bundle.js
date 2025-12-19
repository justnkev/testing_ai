var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// app/static/js/dashboard_utils.js
var require_dashboard_utils = __commonJS({
  "app/static/js/dashboard_utils.js"(exports, module) {
    "use strict";
    function parseDate(value) {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.valueOf()) ? null : parsed;
    }
    function startOfDay(date) {
      const copy = new Date(date);
      copy.setHours(0, 0, 0, 0);
      return copy;
    }
    function startOfWeek(date) {
      const copy = startOfDay(date);
      const day = copy.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      copy.setDate(copy.getDate() + diff);
      return copy;
    }
    function startOfMonth(date) {
      const copy = startOfDay(date);
      copy.setDate(1);
      return copy;
    }
    function formatBucketLabel(start, timeframe) {
      if (timeframe === "day") {
        return start.toLocaleDateString(void 0, { month: "short", day: "numeric" });
      }
      if (timeframe === "week") {
        return `Week of ${start.toLocaleDateString(void 0, { month: "short", day: "numeric" })}`;
      }
      return start.toLocaleDateString(void 0, { month: "short", year: "2-digit" });
    }
    function buildBuckets2(timeframe) {
      const today = startOfDay(/* @__PURE__ */ new Date());
      if (timeframe === "day") {
        return Array.from({ length: 7 }, (_, idx) => {
          const start = new Date(today);
          start.setDate(today.getDate() - (6 - idx));
          const end = new Date(start);
          end.setDate(start.getDate() + 1);
          return { start, end, label: formatBucketLabel(start, timeframe) };
        });
      }
      if (timeframe === "week") {
        const base = startOfWeek(today);
        return Array.from({ length: 4 }, (_, idx) => {
          const start = new Date(base);
          start.setDate(base.getDate() - (3 - idx) * 7);
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          return { start, end, label: formatBucketLabel(start, timeframe) };
        });
      }
      const baseMonth = startOfMonth(today);
      return Array.from({ length: 6 }, (_, idx) => {
        const start = startOfMonth(new Date(baseMonth.getFullYear(), baseMonth.getMonth() - (5 - idx), 1));
        const end = startOfMonth(new Date(start.getFullYear(), start.getMonth() + 1, 1));
        return { start, end, label: formatBucketLabel(start, timeframe) };
      });
    }
    function parseSleepHours2(text, fallback) {
      if (typeof text === "number") return text;
      if (!text && typeof fallback === "number") return fallback;
      const textValue = String(text || "").toLowerCase();
      const hoursMatch = textValue.match(/(\d+(?:\.\d+)?)\s*h/);
      const minutesMatch = textValue.match(/(\d+(?:\.\d+)?)\s*m/);
      const hours = hoursMatch ? parseFloat(hoursMatch[1]) : null;
      const minutes = minutesMatch ? parseFloat(minutesMatch[1]) / 60 : 0;
      if (hours !== null) return hours + minutes;
      const numeric = textValue.match(/\d+(?:\.\d+)?/);
      if (numeric) return parseFloat(numeric[0]);
      return typeof fallback === "number" ? fallback : 0;
    }
    function aggregateMacros2(meals, buckets) {
      return buckets.map((bucket) => {
        const totals = { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 };
        meals.forEach((meal) => {
          const date = parseDate(meal.date_inferred);
          if (date && date >= bucket.start && date < bucket.end) {
            totals.protein_g += Number(meal.protein_g || 0);
            totals.carbs_g += Number(meal.carbs_g || 0);
            totals.fat_g += Number(meal.fat_g || 0);
            totals.calories += Number(meal.calories || 0);
          }
        });
        return { label: bucket.label, ...totals };
      });
    }
    function aggregateSleep2(sleepEntries, buckets) {
      const qualities = [];
      const rows = buckets.map((bucket) => {
        const row = { label: bucket.label };
        sleepEntries.forEach((entry) => {
          const date = parseDate(entry.date_inferred);
          if (date && date >= bucket.start && date < bucket.end) {
            const quality = entry.quality || "Unknown";
            if (!qualities.includes(quality)) qualities.push(quality);
            const hours = parseSleepHours2(entry.time_asleep, entry.hours);
            row[quality] = (row[quality] || 0) + hours;
          }
        });
        return row;
      });
      return { rows, qualities };
    }
    function aggregateWorkouts2(workouts, buckets) {
      if (!buckets.length) return [];
      const rangeStart = buckets[0].start;
      const rangeEnd = buckets[buckets.length - 1].end;
      const totals = {};
      workouts.forEach((workout) => {
        const date = parseDate(workout.date_inferred);
        if (date && date >= rangeStart && date < rangeEnd) {
          const type = workout.workout_type || "Other";
          if (!totals[type]) {
            totals[type] = { type, count: 0, duration: 0 };
          }
          totals[type].count += 1;
          totals[type].duration += Number(workout.duration_min || 0);
        }
      });
      return Object.values(totals).sort((a, b) => b.count - a.count);
    }
    var exported = {
      parseDate,
      startOfDay,
      startOfWeek,
      startOfMonth,
      formatBucketLabel,
      buildBuckets: buildBuckets2,
      parseSleepHours: parseSleepHours2,
      aggregateMacros: aggregateMacros2,
      aggregateSleep: aggregateSleep2,
      aggregateWorkouts: aggregateWorkouts2
    };
    module.exports = exported;
  }
});

// app/static/js/dashboard_v3.jsx
var import_dashboard_utils = __toESM(require_dashboard_utils());
import React, { createContext, useContext, useEffect, useMemo, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "https://cdn.skypack.dev/recharts@2.12.7";
var { aggregateMacros, aggregateSleep, aggregateWorkouts, buildBuckets, parseSleepHours } = import_dashboard_utils.default;
var TimeframeContext = createContext({ timeframe: "week", setTimeframe: () => {
} });
var TIMEFRAME_LABELS = {
  day: "Day",
  week: "Week",
  month: "Month"
};
var MACRO_COLORS = {
  protein_g: "#8c7bff",
  carbs_g: "#3dd6d0",
  fat_g: "#ffc773"
};
var QUALITY_COLORS = ["#22c55e", "#f97316", "#ef4444", "#a855f7"];
var WORKOUT_COLORS = ["#3dd6d0", "#8c7bff", "#ffc773", "#f472b6", "#22c55e"];
function useTimeframe() {
  return useContext(TimeframeContext);
}
function TimeframeProvider({ children }) {
  const [timeframe, setTimeframe] = useState("week");
  const value = useMemo(() => ({ timeframe, setTimeframe }), [timeframe]);
  return /* @__PURE__ */ React.createElement(TimeframeContext.Provider, { value }, children);
}
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}
var Card = ({ title, subtitle, action, children }) => /* @__PURE__ */ React.createElement("section", { className: "chart-card" }, /* @__PURE__ */ React.createElement("div", { className: "chart-card__header" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("small", null, subtitle), /* @__PURE__ */ React.createElement("h4", { style: { margin: "0.25rem 0 0" } }, title)), action), /* @__PURE__ */ React.createElement("div", { className: "chart-card__canvas" }, children));
function TimeframeToggle() {
  const { timeframe, setTimeframe } = useTimeframe();
  return /* @__PURE__ */ React.createElement("div", { className: "chart-toggle", role: "group", "aria-label": "Select time filter" }, Object.entries(TIMEFRAME_LABELS).map(([key, label]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key,
      type: "button",
      className: `fv-button fv-button--ghost ${timeframe === key ? "is-active" : ""}`,
      onClick: () => setTimeframe(key),
      "data-timeframe": key
    },
    label
  )));
}
function SummaryCard({ label, value, detail }) {
  return /* @__PURE__ */ React.createElement("article", { className: "surface-card stat-card stat-card--compact" }, /* @__PURE__ */ React.createElement("span", { className: "stat-label" }, label), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, value), detail ? /* @__PURE__ */ React.createElement("div", { className: "stat-detail" }, detail) : null);
}
var MacrosTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const totals = payload.reduce((acc, item) => ({ ...acc, [item.dataKey]: item.value || 0 }), {});
  const calories = payload[0]?.payload?.calories || 0;
  return /* @__PURE__ */ React.createElement("div", { className: "chart-tooltip" }, /* @__PURE__ */ React.createElement("strong", null, label), /* @__PURE__ */ React.createElement("div", { className: "chart-tooltip__row" }, "Protein: ", totals.protein_g?.toFixed(1) || "0", " g"), /* @__PURE__ */ React.createElement("div", { className: "chart-tooltip__row" }, "Carbs: ", totals.carbs_g?.toFixed(1) || "0", " g"), /* @__PURE__ */ React.createElement("div", { className: "chart-tooltip__row" }, "Fat: ", totals.fat_g?.toFixed(1) || "0", " g"), /* @__PURE__ */ React.createElement("div", { className: "chart-tooltip__row" }, "Calories: ", calories.toFixed(0)));
};
function MacrosChart({ data }) {
  if (!data.length) {
    return /* @__PURE__ */ React.createElement("p", { className: "stat-detail" }, "No macro data logged yet.");
  }
  return /* @__PURE__ */ React.createElement(ResponsiveContainer, { width: "100%", height: 320 }, /* @__PURE__ */ React.createElement(BarChart, { data }, /* @__PURE__ */ React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(140, 123, 255, 0.18)" }), /* @__PURE__ */ React.createElement(XAxis, { dataKey: "label", tick: { fill: "#cdd4f5", fontSize: 12 }, interval: 0, height: 50, angle: -15, textAnchor: "end" }), /* @__PURE__ */ React.createElement(YAxis, { tick: { fill: "#cdd4f5", fontSize: 12 } }), /* @__PURE__ */ React.createElement(Tooltip, { content: /* @__PURE__ */ React.createElement(MacrosTooltip, null) }), /* @__PURE__ */ React.createElement(Legend, null), /* @__PURE__ */ React.createElement(Bar, { dataKey: "protein_g", stackId: "macros", fill: MACRO_COLORS.protein_g, name: "Protein (g)" }), /* @__PURE__ */ React.createElement(Bar, { dataKey: "carbs_g", stackId: "macros", fill: MACRO_COLORS.carbs_g, name: "Carbs (g)" }), /* @__PURE__ */ React.createElement(Bar, { dataKey: "fat_g", stackId: "macros", fill: MACRO_COLORS.fat_g, name: "Fat (g)" })));
}
function SleepChart({ rows, qualities }) {
  if (!rows.length) {
    return /* @__PURE__ */ React.createElement("p", { className: "stat-detail" }, "No sleep entries in this range.");
  }
  return /* @__PURE__ */ React.createElement(ResponsiveContainer, { width: "100%", height: 320 }, /* @__PURE__ */ React.createElement(BarChart, { data: rows, margin: { top: 10, right: 10, left: 10, bottom: 10 } }, /* @__PURE__ */ React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(140, 123, 255, 0.18)" }), /* @__PURE__ */ React.createElement(XAxis, { dataKey: "label", tick: { fill: "#cdd4f5", fontSize: 12 }, interval: 0, height: 50, angle: -15, textAnchor: "end" }), /* @__PURE__ */ React.createElement(YAxis, { tick: { fill: "#cdd4f5", fontSize: 12 }, label: { value: "Hours asleep", angle: -90, position: "insideLeft", fill: "#cdd4f5" } }), /* @__PURE__ */ React.createElement(Tooltip, { formatter: (value) => `${value.toFixed(1)} hrs` }), /* @__PURE__ */ React.createElement(Legend, null), qualities.map((quality, index) => /* @__PURE__ */ React.createElement(Bar, { key: quality, dataKey: quality, stackId: "sleep", fill: QUALITY_COLORS[index % QUALITY_COLORS.length], name: quality }))));
}
var WorkoutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return /* @__PURE__ */ React.createElement("div", { className: "chart-tooltip" }, /* @__PURE__ */ React.createElement("strong", null, item.type), /* @__PURE__ */ React.createElement("div", { className: "chart-tooltip__row" }, "Sessions: ", item.count), /* @__PURE__ */ React.createElement("div", { className: "chart-tooltip__row" }, "Duration: ", Math.round(item.duration), " min"));
};
function WorkoutChart({ data }) {
  if (!data.length) {
    return /* @__PURE__ */ React.createElement("p", { className: "stat-detail" }, "No workouts logged in this range.");
  }
  const isCompact = useMediaQuery("(max-width: 720px)");
  if (isCompact) {
    return /* @__PURE__ */ React.createElement(ResponsiveContainer, { width: "100%", height: 320 }, /* @__PURE__ */ React.createElement(BarChart, { data, layout: "vertical", margin: { left: 50 } }, /* @__PURE__ */ React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(140, 123, 255, 0.18)" }), /* @__PURE__ */ React.createElement(XAxis, { type: "number", tick: { fill: "#cdd4f5", fontSize: 12 } }), /* @__PURE__ */ React.createElement(YAxis, { type: "category", dataKey: "type", tick: { fill: "#cdd4f5", fontSize: 12 }, width: 120 }), /* @__PURE__ */ React.createElement(Tooltip, { content: /* @__PURE__ */ React.createElement(WorkoutTooltip, null) }), /* @__PURE__ */ React.createElement(Legend, null), /* @__PURE__ */ React.createElement(Bar, { dataKey: "count", fill: "#3dd6d0", name: "Sessions" })));
  }
  return /* @__PURE__ */ React.createElement(ResponsiveContainer, { width: "100%", height: 320 }, /* @__PURE__ */ React.createElement(PieChart, null, /* @__PURE__ */ React.createElement(Pie, { data, dataKey: "count", nameKey: "type", innerRadius: 70, outerRadius: 110, paddingAngle: 4 }, data.map((entry, index) => /* @__PURE__ */ React.createElement(Cell, { key: entry.type, fill: WORKOUT_COLORS[index % WORKOUT_COLORS.length] }))), /* @__PURE__ */ React.createElement(Tooltip, { content: /* @__PURE__ */ React.createElement(WorkoutTooltip, null) }), /* @__PURE__ */ React.createElement(Legend, null)));
}
function DashboardApp() {
  const { timeframe } = useTimeframe();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/dashboard_data");
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const payload = await response.json();
        if (!payload?.data) throw new Error("Missing dashboard payload");
        if (!cancelled) setState({ loading: false, error: null, data: payload.data });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, data: null });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);
  const buckets = useMemo(() => buildBuckets(timeframe), [timeframe]);
  const macros = useMemo(() => aggregateMacros(state.data?.meals || [], buckets), [state.data, buckets]);
  const sleep = useMemo(
    () => aggregateSleep(state.data?.sleep || [], buckets),
    [state.data, buckets]
  );
  const workouts = useMemo(
    () => aggregateWorkouts(state.data?.workouts || [], buckets),
    [state.data, buckets]
  );
  const loadingView = /* @__PURE__ */ React.createElement("section", { className: "surface-card", "aria-live": "polite" }, /* @__PURE__ */ React.createElement("p", { className: "stat-detail" }, "Loading your dashboard\u2026"));
  if (state.loading) return loadingView;
  if (state.error) {
    return /* @__PURE__ */ React.createElement("section", { className: "surface-card", "aria-live": "polite" }, /* @__PURE__ */ React.createElement("p", { className: "stat-detail" }, "Unable to load data right now. Please try again in a moment."), /* @__PURE__ */ React.createElement("p", { className: "stat-detail" }, state.error));
  }
  const totalSleepHours = sleep.rows.reduce(
    (acc, row) => acc + Object.entries(row).reduce((sum, [key, value]) => {
      if (key === "label" || typeof value !== "number") return sum;
      return sum + value;
    }, 0),
    0
  );
  const averageSleep = sleep.rows.length ? totalSleepHours / sleep.rows.length : 0;
  const totalCalories = macros.reduce((acc, entry) => acc + (entry.calories || 0), 0);
  const workoutSessions = workouts.reduce((acc, entry) => acc + entry.count, 0);
  return /* @__PURE__ */ React.createElement("div", { className: "dashboard-panels" }, /* @__PURE__ */ React.createElement("div", { className: "dashboard-toolbar" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("small", null, "Time filter"), /* @__PURE__ */ React.createElement("p", { className: "stat-detail", style: { margin: "0.25rem 0 0" } }, "Switch views to align meals, sleep, and workouts.")), /* @__PURE__ */ React.createElement(TimeframeToggle, null)), /* @__PURE__ */ React.createElement("div", { className: "summary-grid" }, /* @__PURE__ */ React.createElement(SummaryCard, { label: "Average sleep", value: `${averageSleep.toFixed(1)} hrs`, detail: "Across selected buckets" }), /* @__PURE__ */ React.createElement(SummaryCard, { label: "Macro calories", value: `${Math.round(totalCalories)} kcal`, detail: "Sum of logged meals" }), /* @__PURE__ */ React.createElement(SummaryCard, { label: "Workout sessions", value: workoutSessions, detail: "By workout type" })), /* @__PURE__ */ React.createElement("div", { className: "chart-grid", role: "list" }, /* @__PURE__ */ React.createElement(Card, { title: "Macros overview", subtitle: "Stacked by grams" }, /* @__PURE__ */ React.createElement(MacrosChart, { data: macros })), /* @__PURE__ */ React.createElement(Card, { title: "Sleep duration by quality", subtitle: "Grouped by day" }, /* @__PURE__ */ React.createElement(SleepChart, { rows: sleep.rows, qualities: sleep.qualities })), /* @__PURE__ */ React.createElement(Card, { title: "Workouts by type", subtitle: "Session share" }, /* @__PURE__ */ React.createElement(WorkoutChart, { data: workouts }))));
}
function bootstrap() {
  const mountNode = document.querySelector(".dashboard-react-layout");
  if (!mountNode) return;
  const root = createRoot(mountNode);
  root.render(
    /* @__PURE__ */ React.createElement(TimeframeProvider, null, /* @__PURE__ */ React.createElement(DashboardApp, null))
  );
}
document.addEventListener("DOMContentLoaded", bootstrap);
