/**
 * Practice logging and the weekly chart.
 *
 * ON-DEVICE ONLY. Every read and write below goes to this browser's
 * localStorage and nowhere else - there is no fetch in this file, and there
 * must never be one. Accounts exist in this app to know who uses it, not to
 * collect what they practise; the API has no route that would accept this data
 * even if something here tried to send it.
 */
import { TAAL_DATA } from "../engine/taalData.js";

const LOGS_STORAGE_KEY = "lehra_practice_logs";

/** Save a practice session log to local storage. */
export function savePracticeSession(durationSeconds, taalKey, bpm, instrument) {
  if (durationSeconds < 5) return; // Don't log trivial clicks

  const logs = getPracticeLogs();
  logs.push({
    id: "log_" + Date.now(),
    date: new Date().toISOString(),
    duration: durationSeconds, // in seconds
    taal: taalKey,
    bpm,
    instrument
  });

  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Could not save the practice log:", e);
  }
}

/** Retrieve practice logs, oldest first. */
export function getPracticeLogs() {
  const stored = localStorage.getItem(LOGS_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error parsing practice logs:", e);
    return [];
  }
}

/** Totals for the four stat cards on the Analytics screen. */
export function calculateAnalyticsStats(logs = getPracticeLogs()) {
  let totalSeconds = 0;
  const taalCounts = {};
  let bpmSum = 0;
  let bpmCount = 0;

  logs.forEach((log) => {
    totalSeconds += log.duration;
    taalCounts[log.taal] = (taalCounts[log.taal] || 0) + 1;
    if (log.bpm) {
      bpmSum += log.bpm;
      bpmCount++;
    }
  });

  let favoriteTaal = "None";
  let maxCount = 0;
  for (const t in taalCounts) {
    if (taalCounts[t] > maxCount) {
      maxCount = taalCounts[t];
      favoriteTaal = TAAL_DATA[t] ? TAAL_DATA[t].name : t;
    }
  }

  return {
    totalMinutes: Math.round(totalSeconds / 60),
    totalSessions: logs.length,
    favoriteTaal,
    avgBpm: bpmCount > 0 ? Math.round(bpmSum / bpmCount) : 0
  };
}

/** Helper to fetch computed CSS variables dynamically. */
export function getThemeColor(variableName) {
  return getComputedStyle(document.body).getPropertyValue(variableName).trim();
}

/** Helper to draw a rounded rectangle. */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (height === 0) return;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw the last seven days as a gradient bar chart.
 *
 * Takes the canvas element rather than an id - the React component that owns it
 * already holds a ref, and looking it up again by id would only reintroduce the
 * global lookup the port exists to remove.
 */
export function renderWeeklyPracticeChart(canvas, logs = getPracticeLogs()) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const last7Days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    last7Days.push({
      dateStr: d.toDateString(),
      dayLabel: dayNames[d.getDay()],
      minutes: 0
    });
  }

  logs.forEach((log) => {
    const logDate = new Date(log.date);
    logDate.setHours(0, 0, 0, 0);
    const matchedDay = last7Days.find(
      (day) => day.dateStr === logDate.toDateString()
    );
    if (matchedDay) matchedDay.minutes += log.duration / 60;
  });

  // Minimum scale limit of 10m, so a single short session does not fill the
  // panel and read as a heroic week.
  const maxMinutes = Math.max(...last7Days.map((d) => d.minutes), 10);
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const gridCount = 4;
  ctx.strokeStyle = getThemeColor("--panel-border") || "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.fillStyle = getThemeColor("--text-secondary") || "#94a3b8";
  ctx.font = "11px 'Work Sans', sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= gridCount; i++) {
    const val = (maxMinutes / gridCount) * i;
    const y = paddingTop + chartHeight - (val / maxMinutes) * chartHeight;

    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    ctx.fillText(Math.round(val) + "m", paddingLeft - 8, y);
  }

  const barGap = 15;
  const totalBarSpacingWidth = chartWidth - barGap * (last7Days.length - 1);
  const barWidth = totalBarSpacingWidth / last7Days.length;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  last7Days.forEach((day, index) => {
    const x = paddingLeft + index * (barWidth + barGap);
    const barHeight = (day.minutes / maxMinutes) * chartHeight;
    const y = paddingTop + chartHeight - barHeight;

    if (day.minutes > 0) {
      const grad = ctx.createLinearGradient(x, y, x, paddingTop + chartHeight);
      grad.addColorStop(0, getThemeColor("--accent-cyan") || "#00f2fe");
      grad.addColorStop(1, getThemeColor("--accent-purple") || "#9b51e0");

      ctx.fillStyle = grad;
      drawRoundedRect(ctx, x, y, barWidth, barHeight, Math.min(6, barHeight));

      ctx.fillStyle = getThemeColor("--text-primary") || "#fff";
      ctx.font = "bold 11px 'Work Sans', sans-serif";
      ctx.fillText(Math.round(day.minutes) + "m", x + barWidth / 2, y - 14);
    } else {
      ctx.fillStyle =
        getThemeColor("--panel-border") || "rgba(255, 255, 255, 0.08)";
      drawRoundedRect(ctx, x, paddingTop + chartHeight - 4, barWidth, 4, 2);
    }

    ctx.fillStyle = getThemeColor("--text-secondary") || "#94a3b8";
    ctx.font = "11px 'Work Sans', sans-serif";
    ctx.fillText(day.dayLabel, x + barWidth / 2, paddingTop + chartHeight + 8);
  });
}
