const state = {
  commodity: "",
  destinations: new Set(["Total Exports"]),
  metric: "cumulative",
  chartType: "line",
  selectedYears: new Set(),
  weekStart: 1,
  weekEnd: 52,
  showAverage: true,
};

const colours = ["#2e6fbb", "#2f7d57", "#b7791f", "#b64d4d", "#1d7f8c", "#7759a6", "#596579", "#9a5b30"];
const avgColour = "#1f2937";
const currentYearColour = "#d62828";

let exportData = null;

const fmt = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const el = {
  commodity: document.querySelector("#commodity"),
  destinations: document.querySelector("#destinations"),
  clearDestinations: document.querySelector("#clearDestinations"),
  selectTotal: document.querySelector("#selectTotal"),
  metric: document.querySelector("#metric"),
  chartType: document.querySelector("#chartType"),
  years: document.querySelector("#years"),
  clearYears: document.querySelector("#clearYears"),
  latestYears: document.querySelector("#latestYears"),
  weekStart: document.querySelector("#weekStart"),
  weekEnd: document.querySelector("#weekEnd"),
  averageToggle: document.querySelector("#averageToggle"),
  averageHint: document.querySelector("#averageHint"),
  summary: document.querySelector("#summary"),
  chart: document.querySelector("#chart"),
  tooltip: document.querySelector("#tooltip"),
  chartTitle: document.querySelector("#chartTitle"),
  chartEyebrow: document.querySelector("#chartEyebrow"),
  legend: document.querySelector("#legend"),
  totalsTable: document.querySelector("#totalsTable"),
};

fetch("data/exports.json")
  .then((response) => response.json())
  .then((data) => {
    exportData = data;
    initialiseControls();
    render();
  })
  .catch((error) => {
    console.error(error);
  });

function initialiseControls() {
  state.commodity = exportData.commodities[0];
  state.selectedYears = new Set(exportData.marketingYears.slice(-4));

  fillSelect(el.commodity, exportData.commodities);
  el.commodity.value = state.commodity;
  el.weekStart.value = state.weekStart;
  el.weekEnd.value = state.weekEnd;

  el.commodity.addEventListener("change", () => {
    state.commodity = el.commodity.value;
    render();
  });

  el.clearDestinations.addEventListener("click", () => {
    state.destinations = new Set();
    renderDestinationChecks();
    render();
  });

  el.selectTotal.addEventListener("click", () => {
    state.destinations = new Set(["Total Exports"]);
    renderDestinationChecks();
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
    state.selectedYears = new Set(exportData.marketingYears.slice(-4));
    renderYearChecks();
    render();
  });

  setupSegmented(el.metric, "metric");
  setupSegmented(el.chartType, "chartType");
  renderDestinationChecks();
  renderYearChecks();
}

function fillSelect(select, values) {
  select.replaceChildren(...values.map((value) => new Option(value, value)));
}

function setupSegmented(container, key) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    state[key] = button.dataset.value;
    for (const item of container.querySelectorAll("button")) {
      item.classList.toggle("active", item === button);
    }
    render();
  });
}

function renderDestinationChecks() {
  el.destinations.replaceChildren(
    ...exportData.destinations.map((destination) => {
      const label = document.createElement("label");
      label.className = "destination-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = destination;
      input.checked = state.destinations.has(destination);
      input.addEventListener("change", () => {
        if (input.checked && destination === "Total Exports") {
          state.destinations = new Set(["Total Exports"]);
        } else if (input.checked) {
          state.destinations.delete("Total Exports");
          state.destinations.add(destination);
        } else {
          state.destinations.delete(destination);
        }
        renderDestinationChecks();
        render();
      });
      label.append(input, destination);
      return label;
    })
  );
}

function renderYearChecks() {
  el.years.replaceChildren(
    ...exportData.marketingYears.map((year) => {
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

function clampWeek(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(52, Math.round(numeric)));
}

function destinationLabel() {
  const selected = [...state.destinations];
  if (!selected.length) return "No destinations selected";
  if (selected.length <= 3) return selected.join(" + ");
  return `${selected.length} selected destinations`;
}

function filteredRows() {
  if (!state.destinations.size) return [];
  return exportData.rows.filter(
    (row) =>
      row.commodity === state.commodity &&
      state.destinations.has(row.destination) &&
      row.weekNumber >= state.weekStart &&
      row.weekNumber <= state.weekEnd &&
      row.weekNumber <= 52
  );
}

function selectedSeries() {
  const rows = filteredRows().filter((row) => state.selectedYears.has(row.marketingYear));
  return seriesFromRows(rows);
}

function seriesFromRows(rows) {
  const byYearWeek = new Map();
  for (const row of rows) {
    const key = `${row.marketingYear}|${row.weekNumber}`;
    if (!byYearWeek.has(key)) {
      byYearWeek.set(key, {
        marketingYear: row.marketingYear,
        weekNumber: row.weekNumber,
        weekLabel: row.weekLabel,
        weeklyTons: 0,
      });
    }
    byYearWeek.get(key).weeklyTons += row.weeklyTons;
  }

  const byYear = new Map();
  for (const row of byYearWeek.values()) {
    if (!byYear.has(row.marketingYear)) byYear.set(row.marketingYear, []);
    byYear.get(row.marketingYear).push(row);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, values]) => {
      let cumulative = 0;
      const points = values
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((row) => {
          cumulative += row.weeklyTons;
          return {
            week: row.weekNumber,
            label: row.weekLabel,
            weekly: row.weeklyTons,
            cumulative,
            value: state.metric === "cumulative" ? cumulative : row.weeklyTons,
          };
        });
      return { year, values: points };
    });
}

function averageSeries() {
  if (!state.showAverage || state.selectedYears.size === 0 || !state.destinations.size) return null;
  const latest = [...state.selectedYears].sort().at(-1);
  const averageYears = exportData.marketingYears.filter((year) => year < latest).slice(-5);
  const rows = filteredRows().filter((row) => averageYears.includes(row.marketingYear));
  const grouped = seriesFromRows(rows);
  const byWeek = new Map();
  for (const series of grouped) {
    for (const point of series.values) {
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
  return { year: "5-year avg", sourceYears: averageYears, values };
}

function render() {
  if (!exportData) return;
  if (document.activeElement !== el.weekStart || el.weekStart.value !== "") el.weekStart.value = state.weekStart;
  if (document.activeElement !== el.weekEnd || el.weekEnd.value !== "") el.weekEnd.value = state.weekEnd;

  const series = selectedSeries();
  const average = averageSeries();
  const titleMetric = state.metric === "cumulative" ? "Cumulative export pace" : "Weekly export volumes";
  el.chartTitle.textContent = `${titleMetric}: ${destinationLabel()}`;
  el.chartEyebrow.textContent = `${state.commodity} exports`;
  el.averageHint.textContent = average?.sourceYears.length
    ? `Average uses ${average.sourceYears.join(", ")}.`
    : "Select a later year to calculate a prior 5-year average.";
  renderSummary(series, average);
  renderLegend(series, average);
  renderChart(series, average);
  renderTable(series, average);
}

function renderSummary(series, average) {
  const latest = series.at(-1);
  const latestValue = latest?.values.at(-1)?.cumulative ?? 0;
  const weeklyPeak = Math.max(0, ...series.flatMap((item) => item.values.map((point) => point.weekly)));
  const avgValue = average?.values.at(-1)?.value ?? 0;
  const variance = avgValue ? ((latestValue - avgValue) / avgValue) * 100 : null;

  const cards = [
    ["Latest selected year", latest?.year ?? "-", `${fmt.format(latestValue)} tons`],
    ["Peak weekly volume", `${fmt.format(weeklyPeak)} tons`, `${state.weekStart} to ${state.weekEnd}`],
    ["Destinations", fmt.format(state.destinations.size), destinationLabel()],
    ["Vs 5-year average", variance === null ? "-" : `${pctFmt.format(variance)}%`, avgValue ? `${fmt.format(avgValue)} tons avg` : "No average available"],
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

function renderLegend(series, average) {
  const items = series.map((item) => ({ label: item.year, color: yearColor(item.year) }));
  if (average) items.push({ label: "5-year avg", color: avgColour });
  el.legend.replaceChildren(
    ...items.map((item) => {
      const div = document.createElement("div");
      div.className = "legend-item";
      div.innerHTML = `<span class="swatch" style="background:${item.color}"></span>${item.label}`;
      return div;
    })
  );
}

function renderChart(series, average) {
  const svg = el.chart;
  const width = Math.max(760, svg.clientWidth || 900);
  const height = Math.max(390, svg.clientHeight || 520);
  const margin = { top: 20, right: 34, bottom: 52, left: 86 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();
  hideTooltip();

  const allPoints = [...series.flatMap((item) => item.values), ...(average?.values ?? [])];
  if (!allPoints.length) {
    drawEmpty(svg, width, height);
    return;
  }

  const xMin = state.weekStart;
  const xMax = state.weekEnd;
  const scale = niceScale(Math.max(1, ...allPoints.map((point) => point.value)));
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = (week) => margin.left + ((week - xMin) / Math.max(1, xMax - xMin)) * plotW;
  const y = (value) => margin.top + plotH - (value / scale.max) * plotH;
  const chartContext = { width, height, margin, plotW, plotH, x, y, yMax: scale.max, yStep: scale.step, xMin, xMax };

  drawAxes(svg, chartContext);

  if (state.chartType === "bar") {
    drawBars(svg, series, average, chartContext);
  } else {
    drawLines(svg, series, average, chartContext);
  }

  attachHover(svg, series, average, chartContext);
}

function yearColor(year) {
  if (year === exportData.marketingYears.at(-1)) return currentYearColour;
  const index = exportData.marketingYears.indexOf(year);
  return colours[(index < 0 ? 0 : index) % colours.length];
}

function niceScale(maxValue) {
  const targetTicks = 5;
  const rawStep = maxValue / targetTicks;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const fraction = rawStep / power;
  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  const step = niceFraction * power;
  return { step, max: Math.ceil(maxValue / step) * step };
}

function drawAxes(svg, dims) {
  const { width, height, margin, plotW, plotH, x, y, yMax, yStep, xMin, xMax } = dims;

  for (let value = 0; value <= yMax + yStep / 2; value += yStep) {
    const yy = y(value);
    append(svg, "line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "grid-line" });
    appendText(svg, margin.left - 10, yy + 4, fmt.format(value), "end");
  }

  const weekTicks = tickWeeks(xMin, xMax);
  for (const week of weekTicks) {
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
      append(svg, "rect", {
        x: baseX,
        y: scales.y(point.value),
        width: Math.min(barW - 1, 16),
        height: Math.max(0, barH),
        fill: color,
        class: "bar",
      });
    }
  });
}

function attachHover(svg, series, average, scales) {
  const overlay = append(svg, "rect", {
    x: scales.margin.left,
    y: scales.margin.top,
    width: scales.plotW,
    height: scales.plotH,
    fill: "transparent",
  });
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
    const week = Math.max(state.weekStart, Math.min(state.weekEnd, Math.round(scales.xMin + ((svgX - scales.margin.left) / scales.plotW) * (scales.xMax - scales.xMin))));
    const xPos = scales.x(week);
    hoverLine.setAttribute("x1", xPos);
    hoverLine.setAttribute("x2", xPos);
    hoverLine.setAttribute("visibility", "visible");
    showTooltip(event, week, active);
  });

  overlay.addEventListener("mouseleave", () => {
    hoverLine.setAttribute("visibility", "hidden");
    hideTooltip();
  });
}

function showTooltip(event, week, activeSeries) {
  const titlePoint = activeSeries.flatMap((item) => item.values).find((point) => point.week === week);
  const metricLabel = state.metric === "cumulative" ? "Cumulative" : "Weekly";
  const rows = activeSeries
    .map((item) => {
      const point = item.values.find((value) => value.week === week);
      const color = item.year === "5-year avg" ? avgColour : yearColor(item.year);
      return point ? `<div class="tooltip-row" style="color:${color}"><span>${item.year}</span><strong>${fmt.format(point.value)}</strong></div>` : "";
    })
    .join("");
  el.tooltip.innerHTML = `<div class="tooltip-title">Week ${week}${titlePoint?.label ? ` | ${titlePoint.label}` : ""}</div><div>${metricLabel} tons</div>${rows}`;
  el.tooltip.hidden = false;

  const wrap = el.tooltip.parentElement.getBoundingClientRect();
  const left = Math.min(wrap.width - el.tooltip.offsetWidth - 12, Math.max(12, event.clientX - wrap.left + 14));
  const top = Math.min(wrap.height - el.tooltip.offsetHeight - 12, Math.max(12, event.clientY - wrap.top - 20));
  el.tooltip.style.left = `${left}px`;
  el.tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  el.tooltip.hidden = true;
}

function renderTable(series, average) {
  const avgFinal = average?.values.at(-1)?.value ?? 0;
  el.totalsTable.replaceChildren(
    ...series.map((item) => {
      const weekly = item.values.reduce((sum, point) => sum + point.weekly, 0);
      const cumulative = item.values.at(-1)?.cumulative ?? 0;
      const variance = avgFinal ? `${pctFmt.format(((cumulative - avgFinal) / avgFinal) * 100)}%` : "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.year}</td><td>${item.values.length}</td><td>${fmt.format(weekly)}</td><td>${fmt.format(cumulative)}</td><td>${variance}</td>`;
      return tr;
    })
  );
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

function drawEmpty(svg, width, height) {
  appendText(svg, width / 2, height / 2, "Select at least one marketing year and destination", "middle");
}
