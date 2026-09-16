(() => {
  const SESSION_KEY = "tm_dashboard_test_session";
  const API = "https://target-media.onrender.com";
  let activeData;
  let selectedPeriod = "7d";
  let selectedTrend = "hourly";
  let selectedComparison = "daily";
  const DEMO_DATA = {
    periods: {
      "7d": {
        passers:18426, lookRate:34.7, stopRate:9.4, looked:6394, stopped:1732,
        deltaPassers:8.2, deltaLook:2.4, deltaStop:0.7, avgLookTime:2.8,
        bestWindow:"17:00–19:00", bestDay:"Friday", weakWindow:"10:00–11:00",
        demographics:{ age:[['18–24',16],['25–34',31],['35–44',24],['45–54',17],['55+',12]], gender:[['Women',53],['Men',44],['Unknown',3]] }
      },
      "30d": {
        passers:78960, lookRate:33.9, stopRate:9.0, looked:26768, stopped:7106,
        deltaPassers:6.1, deltaLook:1.8, deltaStop:0.4, avgLookTime:2.6,
        bestWindow:"17:00–19:00", bestDay:"Saturday", weakWindow:"09:00–10:00",
        demographics:{ age:[['18–24',15],['25–34',29],['35–44',25],['45–54',18],['55+',13]], gender:[['Women',52],['Men',45],['Unknown',3]] }
      },
      "quarter": {
        passers:218470, lookRate:32.8, stopRate:8.7, looked:71658, stopped:19007,
        deltaPassers:11.2, deltaLook:2.1, deltaStop:0.8, avgLookTime:2.7,
        bestWindow:"16:00–19:00", bestDay:"Friday", weakWindow:"10:00–11:00",
        demographics:{ age:[['18–24',14],['25–34',30],['35–44',24],['45–54',18],['55+',14]], gender:[['Women',51],['Men',46],['Unknown',3]] }
      }
    },
    trends: {
      hourly: { labels:["09","10","11","12","13","14","15","16","17","18","19","20"], values:[128,102,140,188,222,245,276,314,382,421,389,254], caption:"Average traffic by hour across the selected period.", peak:"Peak 18:00" },
      daily: { labels:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], values:[2410,2285,2512,2688,3184,2910,2437], caption:"Passer-by traffic by day for the latest sample week.", peak:"Peak Friday" },
      weekly: { labels:["W1","W2","W3","W4","W5","W6","W7","W8","W9","W10","W11","W12","W13"], values:[15720,16110,15940,16680,17010,16840,17290,17540,17320,18110,17920,18480,19310], caption:"Weekly traffic across the illustrative quarter.", peak:"Peak W13" }
    },
    comparisons: {
      daily: {
        lead:"Compare the current daily range against the previous equivalent period.",
        caption:"Example: latest 24 hours vs the 24 hours before that.",
        traffic:{current:88,previous:81,delta:"+6.4%"},
        look:{current:85,previous:79,delta:"+1.9pp"},
        stop:{current:76,previous:72,delta:"+0.5pp"}
      },
      weekly: {
        lead:"Compare the current weekly range against the previous equivalent period.",
        caption:"Example: latest 7 days vs the 7 days before that.",
        traffic:{current:91,previous:84,delta:"+8.2%"},
        look:{current:87,previous:81,delta:"+2.4pp"},
        stop:{current:78,previous:72,delta:"+0.7pp"}
      },
      monthly: {
        lead:"Compare the current monthly range against the previous equivalent period.",
        caption:"Example: latest 30 days vs the 30 days before that.",
        traffic:{current:93,previous:86,delta:"+9.1%"},
        look:{current:84,previous:79,delta:"+1.8pp"},
        stop:{current:77,previous:73,delta:"+0.4pp"}
      }
    }
  };
  activeData = DEMO_DATA;

  const form = document.getElementById("dashboardLogin");
  const loginView = document.getElementById("loginView");
  const clientApp = document.getElementById("clientApp");
  const navLogout = document.getElementById("navLogout");
  const user = document.getElementById("dashboardUser");
  const password = document.getElementById("dashboardPassword");
  const error = document.getElementById("loginError");
  const fmtInt = new Intl.NumberFormat("en-GB");
  const animatedValues = new Map();
  const byId = id => document.getElementById(id);

  function formatValue(value, format) {
    if (format === "pct") return Number(value).toFixed(1) + "%";
    return fmtInt.format(Math.round(value));
  }

  function animateNumber(el, to, format) {
    if (to == null) { el.textContent = "—"; animatedValues.delete(el); return; }
    const start = animatedValues.get(el) ?? 0;
    const duration = 700;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (to - start) * eased;
      el.textContent = formatValue(current, format);
      if (progress < 1) requestAnimationFrame(tick);
      else animatedValues.set(el, to);
    }
    requestAnimationFrame(tick);
  }

  function signed(value, suffix) {
    const n = Number(value);
    return (n >= 0 ? "+" : "") + n.toFixed(1) + suffix;
  }

  function ratioText(base, divisor) {
    if (!divisor) return "—";
    return "1 in " + (base / divisor).toFixed(1);
  }

  function renderStack(targetId, rows) {
    const container = byId(targetId);
    if (!rows || !rows.length) {
      container.textContent = "Not available for this location.";
      return;
    }
    const allowedLabels = new Set(["18–24", "25–34", "35–44", "45–54", "55+", "Women", "Men", "Unknown"]);
    rows = rows.filter(([label]) => allowedLabels.has(label)).map(([label, value]) => [label, Math.max(0, Math.min(100, Number(value) || 0))]);
    container.innerHTML = rows.map(([label, value]) => `
      <div class="stack-row">
        <label>${label}</label>
        <div class="bar"><i style="width:${value}%"></i></div>
        <strong>${value}%</strong>
      </div>`).join("");
  }

  function renderPeriod(key) {
    const d = activeData.periods[key];
    if (!d) return;

    animateNumber(byId("kpiPassers"), d.passers, "int");
    animateNumber(byId("kpiLookRate"), d.lookRate, "pct");
    animateNumber(byId("kpiStopRate"), d.stopRate, "pct");
    animateNumber(byId("sidePassers"), d.passers, "int");
    animateNumber(byId("sideStopped"), d.stopped, "int");
    animateNumber(byId("funnelPassersCount"), d.passers, "int");
    animateNumber(byId("funnelLookedCount"), d.looked, "int");
    animateNumber(byId("funnelStoppedCount"), d.stopped, "int");

    byId("deltaPassers").textContent = d.deltaPassers == null ? "—" : signed(d.deltaPassers, "%");
    byId("deltaLook").textContent = d.deltaLook == null ? "—" : signed(d.deltaLook, " pp");
    byId("deltaStop").textContent = d.deltaStop == null ? "—" : signed(d.deltaStop, " pp");

    byId("footerPassers").textContent = "Avg " + fmtInt.format(Math.round(d.passers / (key === "7d" ? 7 : key === "30d" ? 30 : activeData.periodDays || 91))) + " / day";
    byId("footerLook").textContent = ratioText(d.passers, d.looked) + " looked";
    byId("footerStop").textContent = ratioText(d.passers, d.stopped) + " stopped";
    byId("funnelLookPct").textContent = d.lookRate == null ? "—" : d.lookRate.toFixed(1) + "%";
    byId("funnelStopPct").textContent = d.stopRate == null ? "—" : d.stopRate.toFixed(1) + "%";
    byId("avgLookTime").textContent = d.avgLookTime == null ? "—" : d.avgLookTime.toFixed(1) + "s";
    byId("sideAvgLookTime").textContent = d.avgLookTime == null ? "—" : d.avgLookTime.toFixed(1) + "s";
    byId("attentionStoryHeadline").textContent = d.lookRate == null || d.stopRate == null ? "Rates unavailable without passer-by events." :
      "Out of every 100 passer-by events, around " + Math.round(d.lookRate) + " looked and " + Math.round(d.stopRate) + " stopped.";
    byId("bestWindow").textContent = d.bestWindow;
    byId("bestDay").textContent = d.bestDay;
    byId("weakWindow").textContent = d.weakWindow;

    renderStack("ageMix", d.demographics && d.demographics.age);
    renderStack("genderMix", d.demographics && d.demographics.gender);

    document.querySelectorAll("[data-period]").forEach(btn => btn.classList.toggle("active", btn.dataset.period === key));
  }

  function renderTrend(key) {
    const data = activeData.trends[key];
    if (!data) return;
    if (!data.values.length) {
      byId("chartLine").setAttribute("d", "");
      byId("chartArea").setAttribute("d", "");
      byId("chartDots").textContent = "";
      byId("chartLabels").textContent = "";
      byId("chartCaption").textContent = "No observed intervals for this trend.";
      byId("chartPeak").textContent = "No peak";
      return;
    }
    const width = 720, left = 28, right = 704, top = 28, bottom = 215;
    const min = Math.min(...data.values), max = Math.max(...data.values);
    const span = Math.max(1, max - min);
    const points = data.values.map((value, index) => {
      const x = left + (right - left) * (index / Math.max(1, data.values.length - 1));
      const y = bottom - ((value - min) / span) * (bottom - top);
      return { x, y, value, label: data.labels[index] };
    });
    const line = points.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
    byId("chartLine").setAttribute("d", line);
    byId("chartArea").setAttribute("d", line + " L " + right + " " + bottom + " L " + left + " " + bottom + " Z");
    byId("chartDots").innerHTML = points.map((p, i) => '<circle class="chart-dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" style="animation-delay:' + (0.07 + i * 0.025).toFixed(2) + 's"></circle>').join("");
    const labelEvery = data.labels.length > 9 ? 2 : 1;
    byId("chartLabels").innerHTML = points.map((p, i) => i % labelEvery === 0 ? '<text class="chart-axis" x="' + p.x.toFixed(1) + '" y="252" text-anchor="middle">' + p.label + '</text>' : "").join("");
    byId("chartCaption").textContent = data.caption;
    byId("chartPeak").textContent = data.peak;
    document.querySelectorAll("[data-trend]").forEach(btn => btn.classList.toggle("active", btn.dataset.trend === key));
  }

  function renderComparison(range) {
    const c = activeData.comparisons[range];
    if (!c) return;
    byId("compareLead").textContent = c.lead;
    byId("compareCaption").textContent = c.caption;
    byId("compareTrafficCurrent").style.width = c.traffic.current + "%";
    byId("compareTrafficPrevious").style.width = c.traffic.previous + "%";
    byId("compareTrafficDelta").textContent = c.traffic.delta;
    byId("compareLookCurrent").style.width = c.look.current + "%";
    byId("compareLookPrevious").style.width = c.look.previous + "%";
    byId("compareLookDelta").textContent = c.look.delta;
    byId("compareStopCurrent").style.width = c.stop.current + "%";
    byId("compareStopPrevious").style.width = c.stop.previous + "%";
    byId("compareStopDelta").textContent = c.stop.delta;
    document.querySelectorAll("[data-compare-range]").forEach(btn => btn.classList.toggle("active", btn.dataset.compareRange === range));
  }

  function pct(value) { return value == null ? "—" : Number(value).toFixed(1) + "%"; }
  function deltaPercent(current, previous) { return previous > 0 ? (current / previous - 1) * 100 : null; }
  function makeComparison(current, previous, rate) {
    const max = Math.max(current || 0, previous || 0, 0.1);
    const delta = previous == null || current == null ? "—" : rate ? signed(current - previous, "pp") :
      (previous > 0 ? signed((current / previous - 1) * 100, "%") : "—");
    return { current: Math.round(100 * (current || 0) / max), previous: Math.round(100 * (previous || 0) / max), delta };
  }
  function adaptResponse(raw, period) {
    const t = raw.totals, p = raw.previous;
    const trends = {};
    for (const key of ["hourly", "daily", "weekly"]) {
      const points = raw.trends[key] || [];
      const max = points.reduce((best, item) => item.value > (best?.value ?? -1) ? item : best, null);
      trends[key] = {
        labels: points.map(item => key === "daily" ? item.label.slice(5) : item.label),
        values: points.map(item => Number(item.value) || 0),
        caption: key === "hourly" ? "Average observed passer-by events per hour." : `Observed passer-by events by ${key === "daily" ? "day" : "week"}.`,
        peak: max ? `Peak ${key === "hourly" ? max.label + ":00" : max.label}` : "No peak"
      };
    }
    const comparisons = {};
    for (const [key, c] of Object.entries(raw.comparisons || {})) {
      comparisons[key] = {
        lead: `Compare the latest ${c.days} day${c.days === 1 ? "" : "s"} with the preceding equivalent period.`,
        caption: `Latest ${c.days} day${c.days === 1 ? "" : "s"} vs the preceding ${c.days} day${c.days === 1 ? "" : "s"}.`,
        traffic: makeComparison(c.current.passers, c.previous.passers, false),
        look: makeComparison(c.current.lookRate, c.previous.lookRate, true),
        stop: makeComparison(c.current.stopRate, c.previous.stopRate, true)
      };
    }
    const demo = raw.demographics?.enabled && raw.demographics?.hasData ? {
      age: raw.demographics.age.map(item => [item.label, Math.round(item.percent)]),
      gender: raw.demographics.gender.map(item => [item.label, Math.round(item.percent)])
    } : null;
    const d = {
      passers: t.passers, looked: t.looked, stopped: t.stopped,
      lookRate: t.lookRate, stopRate: t.stopRate, avgLookTime: t.avgLookTimeSeconds,
      deltaPassers: deltaPercent(t.passers, p.passers),
      deltaLook: t.lookRate != null && p.lookRate != null ? t.lookRate - p.lookRate : null,
      deltaStop: t.stopRate != null && p.stopRate != null ? t.stopRate - p.stopRate : null,
      bestWindow: raw.moments?.bestWindow || "—", bestDay: raw.moments?.bestDay || "—",
      weakWindow: raw.moments?.weakWindow || "—", demographics: demo
    };
    return {periods:{[period]:d},trends,comparisons,periodDays:raw.periodDays};
  }
  function renderQuarter(raw) {
    const q = raw.quarterly, t = q?.totals;
    byId("quarterPeriod").textContent = q ? `Quarter-to-date · ${q.from.slice(0, 10)} to ${q.to.slice(0, 10)}.` : "Quarter-to-date metrics unavailable.";
    byId("quarterTraffic").textContent = t?.intervalCount ? fmtInt.format(t.passers) : "—";
    byId("quarterLook").textContent = t?.intervalCount ? pct(t.lookRate) : "—";
    byId("quarterStop").textContent = t?.intervalCount ? pct(t.stopRate) : "—";
    byId("quarterLead").textContent = q?.intervalCount ?
      `Based on ${fmtInt.format(q.intervalCount)} observed intervals. Quarter-to-date, not a complete quarter or a causal performance claim.` :
      "No observed intervals for this quarter. No narrative conclusion is available.";
    byId("quarterTrafficDetail").textContent = "Passer-by events, not unique people across days.";
    byId("quarterLookDetail").textContent = "Looked events / passer-by events.";
    byId("quarterStopDetail").textContent = "Stopped events / passer-by events.";
  }
  async function apiFetch(path, options = {}) {
    const token = sessionStorage.getItem(SESSION_KEY);
    const response = await fetch(API + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...options.headers },
      signal: AbortSignal.timeout(65000)
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error(data.error || "connection_error");
    return data;
  }
  async function loadPeriod(period) {
    byId("dataStatus").textContent = "Loading metrics…";
    const result = await apiFetch("/api/dashboard/metrics?period=" + encodeURIComponent(period));
    const raw = result.data;
    if (raw.dataStatus === "EMPTY") {
      activeData = DEMO_DATA;
      byId("dataStatus").textContent = "Illustrative fallback · no Sheet data";
      byId("dataFoot").textContent = "Illustrative fallback · no observed intervals";
      byId("monitorViewLabel").textContent = "Demo fallback";
      byId("demographicStatus").textContent = "Illustrative only";
      byId("demographicNote").textContent = "Illustrative buckets from the fallback, not observed camera data.";
      renderQuarter(null);
    } else {
      activeData = adaptResponse(raw, period);
      byId("dataStatus").textContent = raw.sample ? "SAMPLE/TEST · Sheet data" : "Observed aggregate data";
      byId("dataFoot").textContent = raw.sample ? "Synthetic Sheet records · no customer data" : "Aggregate observations · authorized location";
      byId("monitorViewLabel").textContent = raw.sample ? "Synthetic test view" : "Authorized location";
      byId("demographicStatus").textContent = raw.demographics?.enabled ? (raw.demographics.hasData ? "Aggregated" : "No data") : "Disabled";
      byId("demographicNote").textContent = raw.demographics?.enabled ? "Optional broad buckets; only when aggregate data is supplied." :
        "Demographics are disabled for this location. No demographic estimates are shown.";
      renderQuarter(raw);
    }
    byId("monitorLocation").textContent = raw.dataStatus === "EMPTY" ?
      `${raw.city || "Location"} · no Sheet intervals in this period; illustrative fallback.` :
      `${raw.city || "Location"} · ${raw.businessName || "Authorized business"} · ${raw.observedDays || 0} observed days in selected period.`;
    selectedPeriod = period;
    renderPeriod(period);
    renderTrend(selectedTrend);
    renderComparison(selectedComparison);
  }
  function showDashboard() {
    loginView.hidden = true;
    clientApp.hidden = false;
    navLogout.hidden = false;
    document.querySelectorAll('.reveal').forEach((el, idx) => el.style.animationDelay = (idx * 0.08) + 's');
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function showLogin() {
    clientApp.hidden = true;
    navLogout.hidden = true;
    loginView.hidden = false;
    password.value = "";
    error.hidden = true;
  }

  document.querySelectorAll("[data-period]").forEach(btn => btn.addEventListener("click", async () => {
    try { await loadPeriod(btn.dataset.period); } catch { byId("dataStatus").textContent = "Connection error · previous period remains visible"; }
  }));
  document.querySelectorAll("[data-trend]").forEach(btn => btn.addEventListener("click", () => { selectedTrend = btn.dataset.trend; renderTrend(selectedTrend); }));
  document.querySelectorAll("[data-compare-range]").forEach(btn => btn.addEventListener("click", () => { selectedComparison = btn.dataset.compareRange; renderComparison(selectedComparison); }));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.hidden = true;
    const enteredUser = user.value.trim().toLowerCase();
    const enteredPassword = password.value;
    if (!enteredUser || !enteredPassword) {
      error.textContent = "Enter both username and password.";
      error.hidden = false;
      return;
    }
    try {
      const data = await apiFetch("/api/dashboard/login", {
        method: "POST", body: JSON.stringify({ username: enteredUser, password: enteredPassword })
      });
      sessionStorage.setItem(SESSION_KEY, data.token);
      password.value = "";
      showDashboard();
      await loadPeriod("7d");
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      showLogin();
      error.textContent = "Test login or Monitor connection unavailable. Check Render configuration.";
      error.hidden = false;
    }
  });

  navLogout.addEventListener("click", async () => {
    try { await apiFetch("/api/dashboard/logout", { method: "POST" }); } catch { /* clear local session regardless */ }
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
    user.focus();
  });

  if (sessionStorage.getItem(SESSION_KEY)) {
    showDashboard();
    loadPeriod("7d").catch(() => { sessionStorage.removeItem(SESSION_KEY); showLogin(); });
  }
})();
