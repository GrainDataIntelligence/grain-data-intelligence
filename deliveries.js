const state = {
  deliveryType: "Maize",
  methodology: "SAGIS",
  commodity: "White Maize",
  chartType: "line",
  deliveryMetric: "cumulative",
  selectedYears: new Set(),
  weekStart: 1,
  weekEnd: 52,
  showAverage: true,
  gradeCommodity: "White Maize",
  grade: "WM1",
  gradeMetric: "cumulative",
  gradeSelectedYears: new Set(),
};

const colours = ["#2e6fbb", "#2f7d57", "#b7791f", "#b64d4d", "#1d7f8c", "#7759a6", "#596579", "#9a5b30"];
const avgColour = "#1f2937";
const currentYearColour = "#d62828";
const fmt = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

let deliveryData = null;

const el = {
  deliveryType: document.querySelector("#deliveryType"),
  methodologySection: document.querySelector("#methodologySection"),
  methodology: document.querySelector("#methodology"),
  methodologyHint: document.querySelector("#methodologyHint"),
  maizeCommoditySection: document.querySelector("#maizeCommoditySection"),
  commodity: document.querySelector("#commodity"),
  chartType: document.querySelector("#chartType"),
  deliveryMetric: document.querySelector("#deliveryMetric"),
  years: document.querySelector("#years"),
  clearYears: document.querySelector("#clearYears"),
  latestYears: document.querySelector("#latestYears"),
  weekStart: document.querySelector("#weekStart"),
  weekEnd: document.querySelector("#weekEnd"),
  averageToggle: document.querySelector("#averageToggle"),
  averageHint: document.querySelector("#averageHint"),
  summary: document.querySelector("#summary"),
  deliveryChart: document.querySelector("#deliveryChart"),
  deliveryTooltip: document.querySelector("#deliveryTooltip"),
  deliveryTitle: document.querySelector("#deliveryTitle"),
  deliveryEyebrow: document.querySelector("#deliveryEyebrow"),
  deliveryLegend: document.querySelector("#deliveryLegend"),
  gradeCommodity: document.querySelector("#gradeCommodity"),
  grade: document.querySelector("#grade"),
  gradeMetric: document.querySelector("#gradeMetric"),
  gradeYears: document.querySelector("#gradeYears"),
  clearGradeYears: document.querySelector("#clearGradeYears"),
  latestGradeYears: document.querySelector("#latestGradeYears"),
  gradeChart: document.querySelector("#gradeChart"),
  gradeTooltip: document.querySelector("#gradeTooltip"),
  gradeTitle: document.querySelector("#gradeTitle"),
  gradeLegend: document.querySelector("#gradeLegend"),
  gradePanel: document.querySelector("#gradePanel"),
  totalsTable: document.querySelector("#totalsTable"),
};

fetch("data/deliveries.json?v=20260601-oilseeds")
  .then((response) => response.json())
  .then((data) => {
    deliveryData = data;
    initialiseControls();
    render();
  })
  .catch((error) => {
    console.error(error);
  });

function initialiseControls() {
  state.selectedYears = new Set(deliveryData.marketingYears.slice(-4));
  state.gradeSelectedYears = new Set(deliveryData.marketingYears.slice(-4));
  fillSelect(el.commodity, deliveryData.commodities);
  fillSelect(el.gradeCommodity, deliveryData.commodities);
  refreshGradeOptions();
  el.weekStart.value = state.weekStart;
  el.weekEnd.value = state.weekEnd;

  el.commodity.addEventListener("change", () => {
    state.commodity = el.commodity.value;
    render();
  });
  el.gradeCommodity.addEventListener("change", () => {
    state.gradeCommodity = el.gradeCommodity.value;
    refreshGradeOptions();
    render();
  });
  el.grade.addEventListener("change", () => {
    state.grade = el.grade.value;
    render();
  });

  const updateWeekStart = (commit = false) => {
    if (el.weekStart.value === "" && !commit) return;
    state.weekStart = clampWeek(el.weekStart.value, state.weekStart || 1);
    if (state.weekStart > state.weekEnd) state.weekEnd = state.weekStart;
    render();
  };
  const updateWeekEnd = (commit = false) => {
    if (el.weekEnd.value === "" && !commit) return;
    state.weekEnd = clampWeek(el.weekEnd.value, state.weekEnd || 52);
    if (state.weekEnd < state.weekStart) state.weekStart = state.weekEnd;
    render();
  };
  el.weekStart.addEventListener("change", () => updateWeekStart(true));
  el.weekStart.addEventListener("blur", () => updateWeekStart(true));
  el.weekStart.addEventListener("input", () => updateWeekStart(false));
  el.weekEnd.addEventListener("change", () => updateWeekEnd(true));
  el.weekEnd.addEventListener("blur", () => updateWeekEnd(true));
  el.weekEnd.addEventListener("input", () => updateWeekEnd(false));
  el.averageToggle.addEventListener("change", () => {
    state.showAverage = el.averageToggle.checked;
    render();
  });
  el.clearYears.addEventListener("click", () => {
    state.selectedYears = new Set();
    renderYearChecks();
    render();
  });
  el.latestYears.addEventListener("click", () => {
    state.selectedYears = new Set(deliveryData.marketingYears.slice(-4));
    renderYearChecks();
    render();
  });
  el.clearGradeYears.addEventListener("click", () => {
    state.gradeSelectedYears = new Set();
    renderGradeYearChecks();
    render();
  });
  el.latestGradeYears.addEventListener("click", () => {
    state.gradeSelectedYears = new Set(deliveryData.marketingYears.slice(-4));
    renderGradeYearChecks();
    render();
  });

  setupSegmented(el.methodology, "methodology");
  setupSegmented(el.deliveryType, "deliveryType");
  setupSegmented(el.chartType, "chartType");
  setupSegmented(el.deliveryMetric, "deliveryMetric");
  setupSegmented(el.gradeMetric, "gradeMetric");
  renderYearChecks();
  renderGradeYearChecks();
}

function fillSelect(select, values) {
  select.replaceChildren(...values.map((value) => new Option(value, value)));
}

function refreshGradeOptions() {
  fillSelect(el.grade, deliveryData.gradeOptions[state.gradeCommodity]);
  state.grade = deliveryData.gradeOptions[state.gradeCommodity][0];
  el.grade.value = state.grade;
}

function setupSegmented(container, key) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    state[key] = button.dataset.value;
    for (const item of container.querySelectorAll("button")) item.classList.toggle("active", item === button);
    render();
  });
}

function renderYearChecks() {
  el.years.replaceChildren(
    ...deliveryData.marketingYears.map((year) => {
      const label = document.createElement("label");
      label.className = "year-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = year;
      input.checked = state.selectedYears.has(year);
      input.addEventListener("change", () => {
        input.checked ? state.selectedYears.add(year) : state.selectedYears.delete(year);
        render();
      });
      label.append(input, year);
      return label;
    })
  );
}

function renderGradeYearChecks() {
  el.gradeYears.replaceChildren(
    ...deliveryData.marketingYears.map((year) => {
      const label = document.createElement("label");
      label.className = "year-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = year;
      input.checked = state.gradeSelectedYears.has(year);
      input.addEventListener("change", () => {
        input.checked ? state.gradeSelectedYears.add(year) : state.gradeSelectedYears.delete(year);
        render();
      });
      label.append(input, year);
      return label;
    })
  );
}

function clampWeek(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(52, Math.round(numeric)));
}

function activeCommodity() {
  return state.deliveryType === "Maize" ? state.commodity : state.deliveryType;
}

function activeMethodology() {
  return state.deliveryType === "Maize" ? state.methodology : "Standard";
}

function activeFamily(row) {
  if (state.deliveryType === "Maize") return row.family === "Maize";
  return row.family === "Oilseeds";
}

function applyVisibility() {
  const isMaize = state.deliveryType === "Maize";
  el.methodologySection.classList.toggle("hidden", !isMaize);
  el.maizeCommoditySection.classList.toggle("hidden", !isMaize);
  el.gradePanel.classList.toggle("hidden", !isMaize);
}

function deliveryRows(selectedOnly = true) {
  return deliveryData.deliveryRows.filter(
    (row) =>
      activeFamily(row) &&
      row.methodology === activeMethodology() &&
      row.commodity === activeCommodity() &&
      (!selectedOnly || state.selectedYears.has(row.marketingYear)) &&
      row.weekNumber >= state.weekStart &&
      row.weekNumber <= state.weekEnd &&
      row.weekNumber <= 52
  );
}

function gradeRows(selectedOnly = true) {
  return deliveryData.gradeRows.filter(
    (row) =>
      row.methodology === state.methodology &&
      row.commodity === state.gradeCommodity &&
      row.grade === state.grade &&
      (!selectedOnly || state.gradeSelectedYears.has(row.marketingYear)) &&
      row.weekNumber >= state.weekStart &&
      row.weekNumber <= state.weekEnd &&
      row.weekNumber <= 52
  );
}

function seriesFromRows(rows, valueForPoint) {
  const byYear = new Map();
  for (const row of rows) {
    if (!byYear.has(row.marketingYear)) byYear.set(row.marketingYear, []);
    byYear.get(row.marketingYear).push(row);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, values]) => ({
      year,
      values: values
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((row) => ({
          week: row.weekNumber,
          label: row.weekLabel || "",
          weekly: row.weeklyTons,
          cumulative: row.cumulativeTons,
          cec: row.cecEstimate,
          percent: row.percentDelivered,
          value: valueForPoint(row),
        }))
        .filter((point) => point.value !== null && Number.isFinite(point.value)),
    }));
}

function averageSeries(series, selectedYears) {
  if (!state.showAverage || selectedYears.size === 0) return null;
  const latest = [...selectedYears].sort().at(-1);
  const averageYears = deliveryData.marketingYears.filter((year) => year < latest).slice(-5);
  const included = series.filter((item) => averageYears.includes(item.year));
  const byWeek = new Map();
  for (const item of included) {
    for (const point of item.values) {
      if (!byWeek.has(point.week)) byWeek.set(point.week, []);
      byWeek.get(point.week).push(point.value);
    }
  }
  const values = [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, points]) => ({
      week,
      value: points.reduce((sum, value) => sum + value, 0) / points.length,
    }));
  return values.length ? { year: "5-year avg", sourceYears: averageYears, values } : null;
}

function render() {
  if (!deliveryData) return;
  applyVisibility();
  if (document.activeElement !== el.weekStart || el.weekStart.value !== "") el.weekStart.value = state.weekStart;
  if (document.activeElement !== el.weekEnd || el.weekEnd.value !== "") el.weekEnd.value = state.weekEnd;
  el.methodologyHint.textContent =
    state.methodology === "SAGIS" ? "Runs from 1 May to end April." : "Includes maize earlies from 1 March to end February.";

  const deliveryMetric = state.chartType === "bar" ? "weekly" : state.deliveryMetric;
  const valueForDelivery = (row) => {
    if (deliveryMetric === "percent") return row.percentDelivered;
    if (deliveryMetric === "weekly") return row.weeklyTons;
    return row.cumulativeTons;
  };
  const valueForGrade = (row) => {
    if (state.gradeMetric === "percent") return row.percentOfTotalDelivered;
    return row.cumulativeTons;
  };
  const deliverySeries = seriesFromRows(deliveryRows(true), valueForDelivery);
  const deliveryAverage = averageSeries(seriesFromRows(deliveryRows(false), valueForDelivery), state.selectedYears);
  const gradeSeries = state.deliveryType === "Maize" ? seriesFromRows(gradeRows(true), valueForGrade) : [];
  const gradeAverage = state.deliveryType === "Maize" ? averageSeries(seriesFromRows(gradeRows(false), valueForGrade), state.gradeSelectedYears) : null;

  renderSummary(deliverySeries);
  renderLegend(el.deliveryLegend, deliverySeries, deliveryAverage);
  if (state.deliveryType === "Maize") renderLegend(el.gradeLegend, gradeSeries, gradeAverage);
  renderDeliveryTitles(deliveryMetric);
  renderChart(el.deliveryChart, el.deliveryTooltip, deliverySeries, deliveryAverage, {
    chartType: state.chartType,
    valueKind: deliveryMetric,
    emptyText: "Select at least one marketing year",
  });
  if (state.deliveryType === "Maize") {
    renderChart(el.gradeChart, el.gradeTooltip, gradeSeries, gradeAverage, {
      chartType: "line",
      valueKind: state.gradeMetric === "percent" ? "percent" : "cumulative",
      emptyText: "Select at least one marketing year and grade",
    });
  }
  renderTable(deliverySeries);

  if (state.deliveryType === "Maize") {
    el.gradeTitle.textContent = `${state.grade} ${state.gradeMetric === "percent" ? "% of total delivered" : "cumulative deliveries"} | ${state.methodology}`;
  }
  el.averageHint.textContent = deliveryAverage?.sourceYears.length
    ? `Average uses ${deliveryAverage.sourceYears.join(", ")}.`
    : "Select a later year to calculate a prior 5-year average.";
}

function renderDeliveryTitles(metric) {
  const chartMetric =
    metric === "weekly" ? "Weekly deliveries" : metric === "percent" ? "% delivered vs CEC" : "Cumulative deliveries";
  el.deliveryTitle.textContent = `${chartMetric}: ${activeCommodity()}`;
  el.deliveryEyebrow.textContent = state.deliveryType === "Maize" ? `${state.methodology} methodology` : "Standard oilseeds methodology";
}

function renderSummary(series) {
  const latest = series.at(-1);
  const latestPoint = latest?.values.at(-1);
  const cec = latestPoint?.cec ?? deliveryData.cecEstimates[latest?.year]?.[activeCommodity()] ?? 0;
  const weeklyPeak = Math.max(0, ...series.flatMap((item) => item.values.map((point) => point.weekly)));
  const percent = cec && latestPoint?.cumulative ? (latestPoint.cumulative / cec) * 100 : null;
  const cards = [
    ["Latest selected year", latest?.year ?? "-", latestPoint ? `${fmt.format(latestPoint.cumulative)} tons` : "-"],
    ["CEC estimate", cec ? `${fmt.format(cec)} tons` : "-", activeCommodity()],
    ["% delivered", percent === null ? "-" : `${pctFmt.format(percent)}%`, activeMethodology()],
    ["Peak weekly delivery", `${fmt.format(weeklyPeak)} tons`, `Weeks ${state.weekStart} to ${state.weekEnd}`],
  ];
  el.summary.replaceChildren(
    ...cards.map(([label, value, sub]) => {
      const card = document.createElement("article");
      card.className = "summary-card";
      card.innerHTML = `<p class="label">${label}</p><p class="value">${value}</p><p class="sub">${sub}</p>`;
      return card;
    })
  );
}

function renderLegend(target, series, average) {
  const items = series.map((item) => ({ label: item.year, color: yearColor(item.year) }));
  if (average) items.push({ label: "5-year avg", color: avgColour });
  target.replaceChildren(
    ...items.map((item) => {
      const div = document.createElement("div");
      div.className = "legend-item";
      div.innerHTML = `<span class="swatch" style="background:${item.color}"></span>${item.label}`;
      return div;
    })
  );
}

function renderChart(svg, tooltip, series, average, options) {
  const width = Math.max(760, svg.clientWidth || 900);
  const height = Math.max(360, svg.clientHeight || 480);
  const margin = { top: 20, right: 34, bottom: 52, left: options.valueKind === "percent" ? 72 : 86 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();
  tooltip.hidden = true;

  const allPoints = [...series.flatMap((item) => item.values), ...(average?.values ?? [])];
  if (!allPoints.length) {
    appendText(svg, width / 2, height / 2, options.emptyText, "middle");
    return;
  }

  const scale = niceScale(Math.max(1, ...allPoints.map((point) => point.value)), options.valueKind === "percent");
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = (week) => margin.left + ((week - state.weekStart) / Math.max(1, state.weekEnd - state.weekStart)) * plotW;
  const y = (value) => margin.top + plotH - (value / scale.max) * plotH;
  const context = { width, height, margin, plotW, plotH, x, y, yMax: scale.max, yStep: scale.step, xMin: state.weekStart, xMax: state.weekEnd, valueKind: options.valueKind };

  drawAxes(svg, context);
  if (options.chartType === "bar") drawBars(svg, series, average, context);
  else drawLines(svg, series, average, context);
  attachHover(svg, tooltip, series, average, context);
}

function yearColor(year) {
  if (year === deliveryData.marketingYears.at(-1)) return currentYearColour;
  const index = deliveryData.marketingYears.indexOf(year);
  return colours[(index < 0 ? 0 : index) % colours.length];
}

function niceScale(maxValue, isPercent) {
  if (isPercent) {
    const max = Math.min(120, Math.max(10, Math.ceil(maxValue / 10) * 10));
    return { step: max <= 50 ? 10 : 20, max };
  }
  const rawStep = maxValue / 5;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const fraction = rawStep / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * power;
  return { step, max: Math.ceil(maxValue / step) * step };
}

function drawAxes(svg, dims) {
  const { width, height, margin, plotW, plotH, x, y, yMax, yStep, xMin, xMax, valueKind } = dims;
  for (let value = 0; value <= yMax + yStep / 2; value += yStep) {
    const yy = y(value);
    append(svg, "line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "grid-line" });
    appendText(svg, margin.left - 10, yy + 4, formatValue(value, valueKind), "end");
  }
  for (const week of tickWeeks(xMin, xMax)) {
    const xx = x(week);
    append(svg, "line", { x1: xx, y1: margin.top + plotH, x2: xx, y2: margin.top + plotH + 6, stroke: "#aeb8c4" });
    appendText(svg, xx, height - 18, `W${week}`, "middle");
  }
  append(svg, "line", { x1: margin.left, y1: margin.top + plotH, x2: margin.left + plotW, y2: margin.top + plotH, stroke: "#aeb8c4" });
  append(svg, "line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotH, stroke: "#aeb8c4" });
}

function drawLines(svg, series, average, scales) {
  series.forEach((item) => {
    const path = item.values.map((point, i) => `${i ? "L" : "M"} ${scales.x(point.week)} ${scales.y(point.value)}`).join(" ");
    append(svg, "path", { d: path, class: "series-line", stroke: yearColor(item.year), "data-year": item.year });
  });
  if (average) {
    const path = average.values.map((point, i) => `${i ? "L" : "M"} ${scales.x(point.week)} ${scales.y(point.value)}`).join(" ");
    append(svg, "path", { d: path, class: "series-line avg-line", stroke: avgColour, "data-year": average.year });
  }
}

function drawBars(svg, series, average, scales) {
  const active = [...series, ...(average ? [average] : [])];
  const groups = Math.max(1, active.length);
  const band = scales.x(state.weekStart + 1) - scales.x(state.weekStart) || 14;
  const barW = Math.max(2, Math.min(18, (band * 0.78) / groups));
  active.forEach((item, seriesIndex) => {
    const color = item.year === "5-year avg" ? avgColour : yearColor(item.year);
    for (const point of item.values) {
      const baseX = scales.x(point.week) - (barW * groups) / 2 + seriesIndex * barW;
      const barH = scales.margin.top + scales.plotH - scales.y(point.value);
      append(svg, "rect", { x: baseX, y: scales.y(point.value), width: Math.min(barW - 1, 16), height: Math.max(0, barH), fill: color, class: "bar" });
    }
  });
}

function drawValueLabels(svg, series, average, scales, chartType) {
  const active = [...series, ...(average ? [average] : [])];
  const groups = Math.max(1, active.length);
  const band = scales.x(state.weekStart + 1) - scales.x(state.weekStart) || 14;
  const barW = Math.max(2, Math.min(18, (band * 0.78) / groups));
  active.forEach((item, seriesIndex) => {
    for (const point of item.values) {
      const labelX = chartType === "bar" ? scales.x(point.week) - (barW * groups) / 2 + seriesIndex * barW + barW / 2 : scales.x(point.week);
      const labelY = scales.y(point.value) - 7 - (chartType === "line" ? (seriesIndex % 2) * 10 : 0);
      appendText(svg, labelX, Math.max(12, labelY), formatValue(point.value, scales.valueKind), "middle", "value-label");
    }
  });
}

function attachHover(svg, tooltip, series, average, scales) {
  const overlay = append(svg, "rect", { x: scales.margin.left, y: scales.margin.top, width: scales.plotW, height: scales.plotH, fill: "transparent" });
  const hoverLine = append(svg, "line", {
    x1: scales.margin.left,
    y1: scales.margin.top,
    x2: scales.margin.left,
    y2: scales.margin.top + scales.plotH,
    class: "hover-line",
    visibility: "hidden",
  });
  const active = [...series, ...(average ? [average] : [])];
  overlay.addEventListener("mousemove", (event) => {
    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * scales.width;
    const week = Math.max(scales.xMin, Math.min(scales.xMax, Math.round(scales.xMin + ((svgX - scales.margin.left) / scales.plotW) * (scales.xMax - scales.xMin))));
    const xPos = scales.x(week);
    hoverLine.setAttribute("x1", xPos);
    hoverLine.setAttribute("x2", xPos);
    hoverLine.setAttribute("visibility", "visible");
    showTooltip(tooltip, event, week, active, scales.valueKind);
  });
  overlay.addEventListener("mouseleave", () => {
    hoverLine.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  });
}

function showTooltip(tooltip, event, week, activeSeries, valueKind) {
  const rows = activeSeries
    .map((item) => {
      const point = item.values.find((value) => value.week === week);
      const color = item.year === "5-year avg" ? avgColour : yearColor(item.year);
      return point
        ? `<div class="tooltip-row" style="color:${color}"><span>${item.year}</span><strong>${formatValue(point.value, valueKind)}</strong></div>`
        : "";
    })
    .join("");
  tooltip.innerHTML = `<div class="tooltip-title">Week ${week}</div>${rows}`;
  tooltip.hidden = false;
  const wrap = tooltip.parentElement.getBoundingClientRect();
  const left = Math.min(wrap.width - tooltip.offsetWidth - 12, Math.max(12, event.clientX - wrap.left + 14));
  const top = Math.min(wrap.height - tooltip.offsetHeight - 12, Math.max(12, event.clientY - wrap.top - 20));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function renderTable(series) {
  el.totalsTable.replaceChildren(
    ...series.map((item) => {
      const weekly = item.values.reduce((sum, point) => sum + point.weekly, 0);
      const latest = item.values.at(-1);
      const cumulative = latest?.cumulative ?? 0;
      const percent = latest?.cec ? (cumulative / latest.cec) * 100 : null;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.year}</td><td>${item.values.length}</td><td>${fmt.format(weekly)}</td><td>${fmt.format(cumulative)}</td><td>${percent === null ? "-" : `${pctFmt.format(percent)}%`}</td><td>${latest?.cec ? fmt.format(latest.cec) : "-"}</td>`;
      return tr;
    })
  );
}

function formatValue(value, kind) {
  if (kind === "percent") return `${pctFmt.format(value)}%`;
  return fmt.format(value);
}

function tickWeeks(start, end) {
  const span = end - start;
  const step = span > 34 ? 8 : span > 18 ? 4 : span > 8 ? 2 : 1;
  const ticks = [];
  for (let week = start; week <= end; week += step) ticks.push(week);
  if (!ticks.includes(end)) ticks.push(end);
  return ticks;
}

function append(parent, name, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent.appendChild(node);
  return node;
}

function appendText(parent, x, y, text, anchor, className) {
  const attrs = { x, y, "text-anchor": anchor, fill: "#637083", "font-size": 11 };
  if (className) attrs.class = className;
  const node = append(parent, "text", attrs);
  node.textContent = text;
  return node;
}
