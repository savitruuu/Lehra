/**
 * Analytics and Practice Logging Module
 * Handles local storage for practice logs and renders custom HTML5 Canvas charts.
 */

const LOGS_STORAGE_KEY = "lehra_practice_logs";

// Save a practice session log to local storage
function savePracticeSession(durationSeconds, taalKey, bpm, instrument) {
  if (durationSeconds < 5) return; // Don't log trivial clicks

  const logs = getPracticeLogs();
  const newLog = {
    id: "log_" + Date.now(),
    date: new Date().toISOString(),
    duration: durationSeconds, // in seconds
    taal: taalKey,
    bpm: bpm,
    instrument: instrument
  };

  logs.push(newLog);
  localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
}

// Retrieve practice logs
function getPracticeLogs() {
  const stored = localStorage.getItem(LOGS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Error parsing practice logs:", e);
    return [];
  }
}

// Calculate summary stats
function calculateAnalyticsStats() {
  const logs = getPracticeLogs();
  
  let totalSeconds = 0;
  const taalCounts = {};
  let bpmSum = 0;
  let bpmCount = 0;

  logs.forEach(log => {
    totalSeconds += log.duration;
    
    // Count taals
    taalCounts[log.taal] = (taalCounts[log.taal] || 0) + 1;
    
    // Sum BPM
    if (log.bpm) {
      bpmSum += log.bpm;
      bpmCount++;
    }
  });

  // Find favorite taal
  let favoriteTaal = "None";
  let maxCount = 0;
  for (const t in taalCounts) {
    if (taalCounts[t] > maxCount) {
      maxCount = taalCounts[t];
      favoriteTaal = TAAL_DATA[t] ? TAAL_DATA[t].name : t;
    }
  }

  const avgBpm = bpmCount > 0 ? Math.round(bpmSum / bpmCount) : 0;
  const totalMinutes = Math.round(totalSeconds / 60);

  return {
    totalMinutes: totalMinutes,
    totalSessions: logs.length,
    favoriteTaal: favoriteTaal,
    avgBpm: avgBpm
  };
}

// Draw a beautiful custom gradient bar chart on canvas
function renderWeeklyPracticeChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  
  // Set dimensions based on client bounding rect for high DPI
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Clear Canvas
  ctx.clearRect(0, 0, width, height);

  // Get data for the last 7 days (including today)
  const logs = getPracticeLogs();
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

  // Aggregate log durations by day
  logs.forEach(log => {
    const logDate = new Date(log.date);
    logDate.setHours(0, 0, 0, 0);
    const logDateStr = logDate.toDateString();
    
    const matchedDay = last7Days.find(day => day.dateStr === logDateStr);
    if (matchedDay) {
      matchedDay.minutes += log.duration / 60;
    }
  });

  // Calculate scaling factors
  const maxMinutes = Math.max(...last7Days.map(d => d.minutes), 10); // Minimum scale limit of 10m
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Draw grid lines & Y labels
  const gridCount = 4;
  ctx.strokeStyle = getThemeColor("--panel-border") || "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.fillStyle = getThemeColor("--text-secondary") || "#94a3b8";
  ctx.font = "11px Outfit, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= gridCount; i++) {
    const val = (maxMinutes / gridCount) * i;
    const y = paddingTop + chartHeight - (val / maxMinutes) * chartHeight;
    
    // Draw grid line
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    // Draw Y axis labels
    ctx.fillText(Math.round(val) + "m", paddingLeft - 8, y);
  }

  // Draw Bars & X labels
  const barGap = 15;
  const totalBarSpacingWidth = chartWidth - (barGap * (last7Days.length - 1));
  const barWidth = totalBarSpacingWidth / last7Days.length;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  last7Days.forEach((day, index) => {
    const x = paddingLeft + index * (barWidth + barGap);
    const barHeight = (day.minutes / maxMinutes) * chartHeight;
    const y = paddingTop + chartHeight - barHeight;

    // Draw Bar
    if (day.minutes > 0) {
      const grad = ctx.createLinearGradient(x, y, x, paddingTop + chartHeight);
      grad.addColorStop(0, getThemeColor("--accent-cyan") || "#00f2fe");
      grad.addColorStop(1, getThemeColor("--accent-purple") || "#9b51e0");

      ctx.fillStyle = grad;
      // Draw rounded rectangle for bar tops
      drawRoundedRect(ctx, x, y, barWidth, barHeight, Math.min(6, barHeight));
      
      // Draw minute value text above the bar
      ctx.fillStyle = getThemeColor("--text-primary") || "#fff";
      ctx.font = "bold 11px Outfit, sans-serif";
      ctx.fillText(Math.round(day.minutes) + "m", x + barWidth / 2, y - 14);
    } else {
      // Draw subtle placeholder dot/bar for 0 minutes
      ctx.fillStyle = getThemeColor("--panel-border") || "rgba(255, 255, 255, 0.08)";
      drawRoundedRect(ctx, x, paddingTop + chartHeight - 4, barWidth, 4, 2);
    }

    // Draw X labels
    ctx.fillStyle = getThemeColor("--text-secondary") || "#94a3b8";
    ctx.font = "11px Outfit, sans-serif";
    ctx.fillText(day.dayLabel, x + barWidth / 2, paddingTop + chartHeight + 8);
  });
}

// Helper to draw a rounded rectangle
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

// Helper to fetch computed CSS variables dynamically
function getThemeColor(variableName) {
  return getComputedStyle(document.body).getPropertyValue(variableName).trim();
}
