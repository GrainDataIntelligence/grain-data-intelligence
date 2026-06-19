import { useEffect, useMemo, useRef, useState } from "react";
import FundamentalsChart from "../components/FundamentalsChart";
import { averageColor, averageSeries, clampWeek, fmt, formatWeekRange, niceScale, pctFmt, seriesFromRows, yearColor } from "./fundamentalsUtils";

function ToggleGroup({ value, onChange, options, columns = 2 }) {
  return (
    <div className="grid overflow-hidden rounded-md border border-slate-300" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)} className={`min-h-9 px-3 text-sm ${value === option.value ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

const TOTAL_GRADE_BY_COMMODITY = {
  "White Maize": "White Total",
  "Yellow Maize": "Yellow Total",
  "Total Maize": "Grand Total",
};

const LOWER_GRADE_BY_COMMODITY = {
  "White Maize": ["WM2", "WM3", "WMO"],
  "Yellow Maize": ["YM2", "YM3", "YMO"],
};

const tablePctFmt = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

function gradeSelectionLabel(grades) {
  const selected = [...grades];
  if (!selected.length) return "No grade";
  return selected.length === 1 ? selected[0] : selected.join(" + ");
}

function aggregateGradeRows(rows, totalRowsByKey) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.methodology}||${row.marketingYear}||${row.weekNumber}||${row.commodity}`;
    const existing = grouped.get(key) || {
      methodology: row.methodology,
      marketingYear: row.marketingYear,
      weekNumber: row.weekNumber,
      commodity: row.commodity,
      grade: "Selected grades",
      weeklyTons: 0,
      cumulativeTons: 0,
      totalWeeklyTons: 0,
      percentOfTotalDelivered: null,
      percentOfWeeklyDelivered: null,
    };

    existing.weeklyTons += row.weeklyTons || 0;
    existing.cumulativeTons += row.cumulativeTons || 0;
    existing.totalWeeklyTons += row.totalWeeklyTons || 0;
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .map((row) => {
      const total = totalRowsByKey.get(`${row.methodology}||${row.marketingYear}||${row.weekNumber}||${row.commodity}`);
      return {
        ...row,
        percentOfTotalDelivered: total?.cumulativeTons ? (row.cumulativeTons / total.cumulativeTons) * 100 : null,
        percentOfWeeklyDelivered: total?.weeklyTons ? (row.weeklyTons / total.weeklyTons) * 100 : null,
      };
    })
    .sort((a, b) => a.marketingYear.localeCompare(b.marketingYear) || a.weekNumber - b.weekNumber);
}

function chartLegendItems(series, average, years) {
  return [
    ...series.map((item) => ({ label: item.year, color: yearColor(item.year, years) })),
    ...(average ? [{ label: "5-year avg", color: averageColor }] : []),
  ];
}

function safeFileName(value) {
  return String(value || "chart")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function exportValue(value, kind) {
  if (kind === "percent") return `${pctFmt.format(value)}%`;
  return fmt.format(value);
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function exportTooltipPosition({ pointX, pointY, clusterTop, clusterBottom, linePoints, plotLeft, plotRight, plotTop, plotBottom, tooltipWidth, tooltipHeight }) {
  const pad = 12;
  const lineBandTop = Math.max(plotTop, clusterTop - 34);
  const lineBandBottom = Math.min(plotBottom, clusterBottom + 34);
  const roomRight = plotRight - pointX;
  const roomLeft = pointX - plotLeft;
  const preferRight = roomRight >= tooltipWidth + 36 || roomRight >= roomLeft;
  const sideX = preferRight ? pointX + 24 : pointX - tooltipWidth - 24;
  const otherSideX = preferRight ? pointX - tooltipWidth - 24 : pointX + 24;

  const candidates = [
    { x: sideX, y: pointY - tooltipHeight / 2 },
    { x: sideX, y: pointY + 18 },
    { x: sideX, y: pointY - tooltipHeight - 18 },
    { x: otherSideX, y: pointY - tooltipHeight / 2 },
    { x: otherSideX, y: pointY + 18 },
    { x: otherSideX, y: pointY - tooltipHeight - 18 },
    { x: pointX - tooltipWidth / 2, y: pointY + 24 },
    { x: pointX - tooltipWidth / 2, y: pointY - tooltipHeight - 24 },
    { x: sideX, y: (clusterTop + clusterBottom) / 2 - tooltipHeight / 2 },
  ];

  const overlapArea = (candidate, top, bottom) => {
    const overlapY = Math.max(0, Math.min(candidate.y + tooltipHeight, bottom) - Math.max(candidate.y, top));
    return overlapY * tooltipWidth;
  };

  const distanceToRect = (candidate) => {
    const dx = Math.max(candidate.x - pointX, 0, pointX - (candidate.x + tooltipWidth));
    const dy = Math.max(candidate.y - pointY, 0, pointY - (candidate.y + tooltipHeight));
    return Math.hypot(dx, dy);
  };

  const score = (candidate) => {
    const coveredPoints = linePoints.filter(
      (point) =>
        point.x >= candidate.x - 8 &&
        point.x <= candidate.x + tooltipWidth + 8 &&
        point.y >= candidate.y - 8 &&
        point.y <= candidate.y + tooltipHeight + 8
    ).length;
    const crossesPoint =
      pointX >= candidate.x &&
      pointX <= candidate.x + tooltipWidth &&
      pointY >= candidate.y &&
      pointY <= candidate.y + tooltipHeight;
    return distanceToRect(candidate) * 12 + coveredPoints * 280 + overlapArea(candidate, lineBandTop, lineBandBottom) * 0.02 + (crossesPoint ? 10000 : 0);
  };

  return candidates
    .map((candidate) => ({
      x: Math.max(plotLeft + pad, Math.min(plotRight - tooltipWidth - pad, candidate.x)),
      y: Math.max(plotTop + pad, Math.min(plotBottom - tooltipHeight - pad, candidate.y)),
    }))
    .sort((a, b) => score(a) - score(b))[0];
}

function latestSeriesWeek(series, weekStart, weekEnd) {
  const latest = [...series].sort((a, b) => a.year.localeCompare(b.year)).at(-1);
  const latestWeeks = latest?.values
    ?.filter((point) => point.week >= weekStart && point.week <= weekEnd && Number.isFinite(point.value))
    .map((point) => point.week);
  return latestWeeks?.length ? Math.max(...latestWeeks) : null;
}

function drawExportTooltip(ctx, { series, average, years, valueKind, chartType, weekStart, weekEnd, svgWidth, svgHeight, chartX, chartY, chartWidth, chartHeight, referenceYear, calendarStartMonth }) {
  const active = [...series, ...(average ? [average] : [])];
  const allPoints = active.flatMap((item) => item.values);
  const pointValues = allPoints.map((point) => point.value).filter((value) => Number.isFinite(value));
  if (!pointValues.length) return;

  const margin = { top: 20, right: 34, bottom: 70, left: valueKind === "percent" ? 76 : 92 };
  const plotW = svgWidth - margin.left - margin.right;
  const plotH = svgHeight - margin.top - margin.bottom;
  const maxValue = Math.max(...pointValues);
  const minValue = Math.min(...pointValues);
  const scale = niceScale(Math.max(1, maxValue), valueKind === "percent", minValue, valueKind === "percent" && chartType !== "bar");
  const svgX = (week) => margin.left + ((week - weekStart) / Math.max(1, weekEnd - weekStart)) * plotW;
  const svgY = (value) => margin.top + plotH - ((value - scale.min) / Math.max(1, scale.max - scale.min)) * plotH;
  const toCanvasX = (value) => chartX + (value / svgWidth) * chartWidth;
  const toCanvasY = (value) => chartY + (value / svgHeight) * chartHeight;
  const plotTop = toCanvasY(margin.top);
  const plotBottom = toCanvasY(margin.top + plotH);
  const plotRight = toCanvasX(margin.left + plotW);
  const plotLeft = toCanvasX(margin.left);
  const week = latestSeriesWeek(series, weekStart, weekEnd) ?? Math.max(...allPoints.map((point) => point.week).filter((value) => value >= weekStart && value <= weekEnd));
  if (!Number.isFinite(week)) return;

  const rows = active
    .map((item) => {
      const point = item.values.find((value) => value.week === week);
      if (!point) return null;
      const color = item.year === "5-year avg" ? averageColor : yearColor(item.year, years);
      return { year: item.year, value: point.value, color, y: toCanvasY(svgY(point.value)) };
    })
    .filter(Boolean);
  if (!rows.length) return;

  const weekX = toCanvasX(svgX(week));
  const pointY = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
  const clusterTop = Math.min(...rows.map((row) => row.y));
  const clusterBottom = Math.max(...rows.map((row) => row.y));
  const tooltipWidth = 282;
  const tooltipHeight = 42 + rows.length * 24;
  const linePoints = active.flatMap((item) =>
    item.values
      .filter((point) => point.week >= weekStart && point.week <= weekEnd && Number.isFinite(point.value))
      .map((point) => ({
        x: toCanvasX(svgX(point.week)),
        y: toCanvasY(svgY(point.value)),
      }))
  );
  const { x, y } = exportTooltipPosition({
    pointX: weekX,
    pointY,
    clusterTop,
    clusterBottom,
    linePoints,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    tooltipWidth,
    tooltipHeight,
  });

  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(weekX, plotTop);
  ctx.lineTo(weekX, plotBottom);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  roundedRect(ctx, x, y, tooltipWidth, tooltipHeight, 7);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  roundedRect(ctx, x, y, tooltipWidth, tooltipHeight, 7);
  ctx.stroke();

  ctx.fillStyle = "#020617";
  ctx.font = "800 15px Arial, sans-serif";
  const dateLabel = referenceYear ? ` | ${formatWeekRange(referenceYear, week, calendarStartMonth, true)}` : "";
  ctx.fillText(`Week ${week}${dateLabel}`, x + 14, y + 24);

  ctx.font = "800 15px Arial, sans-serif";
  rows.forEach((row, index) => {
    const rowY = y + 50 + index * 24;
    ctx.fillStyle = row.color;
    ctx.fillText(row.year, x + 14, rowY);
    const value = exportValue(row.value, valueKind);
    ctx.fillText(value, x + tooltipWidth - 14 - ctx.measureText(value).width, rowY);
  });
}

async function exportChartPng({ container, title, eyebrow, legendItems, fileName, series, average, years, valueKind, chartType, weekStart, weekEnd, includeLabels, referenceYear, calendarStartMonth }) {
  const svg = container?.querySelector("svg");
  if (!svg) return;

  const clone = svg.cloneNode(true);
  const viewBox = clone.getAttribute("viewBox")?.split(/\s+/).map(Number) || [0, 0, 1000, 480];
  const svgWidth = viewBox[2] || 1000;
  const svgHeight = viewBox[3] || 480;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(svgWidth));
  clone.setAttribute("height", String(svgHeight));

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = await loadImage(svgUrl);
    const exportWidth = 1600;
    const padding = 48;
    const headerHeight = 118;
    const chartWidth = exportWidth - padding * 2;
    const chartHeight = Math.round((chartWidth / svgWidth) * svgHeight);
    const exportHeight = headerHeight + chartHeight + padding;
    const pixelRatio = 2;
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth * pixelRatio;
    canvas.height = exportHeight * pixelRatio;
    const ctx = canvas.getContext("2d");
    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 18px Arial, sans-serif";
    ctx.fillText(String(eyebrow || "").toUpperCase(), padding, 36);
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 26px Arial, sans-serif";
    ctx.fillText(title, padding, 70);

    let legendX = exportWidth - padding;
    let legendY = 34;
    ctx.font = "700 15px Arial, sans-serif";
    for (const item of [...legendItems].reverse()) {
      const textWidth = ctx.measureText(item.label).width;
      const itemWidth = textWidth + 28;
      if (legendX - itemWidth < exportWidth * 0.45) {
        legendX = exportWidth - padding;
        legendY += 26;
      }
      legendX -= itemWidth;
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY - 12, 12, 12);
      ctx.fillStyle = "#475569";
      ctx.fillText(item.label, legendX + 18, legendY - 1);
      legendX -= 18;
    }

    ctx.drawImage(image, padding, headerHeight, chartWidth, chartHeight);
    if (includeLabels) {
      drawExportTooltip(ctx, {
        series,
        average,
        years,
        valueKind,
        chartType,
        weekStart,
        weekEnd,
        svgWidth,
        svgHeight,
        chartX: padding,
        chartY: headerHeight,
        chartWidth,
        chartHeight,
        referenceYear,
        calendarStartMonth,
      });
    }

    const link = document.createElement("a");
    link.download = `${safeFileName(fileName || title)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function FundamentalsDeliveries() {
  const [data, setData] = useState(null);
  const [deliveryType, setDeliveryType] = useState("Maize");
  const [methodology, setMethodology] = useState("SAGIS");
  const [commodity, setCommodity] = useState("White Maize");
  const [chartType, setChartType] = useState("line");
  const [deliveryMetric, setDeliveryMetric] = useState("cumulative");
  const [selectedYears, setSelectedYears] = useState(new Set());
  const [weekStart, setWeekStart] = useState(1);
  const [weekEnd, setWeekEnd] = useState(52);
  const [showAverage, setShowAverage] = useState(true);
  const [showDeliveryLabels, setShowDeliveryLabels] = useState(true);
  const [gradeCommodity, setGradeCommodity] = useState("White Maize");
  const [gradeMethodology, setGradeMethodology] = useState("SAGIS");
  const [selectedGrades, setSelectedGrades] = useState(new Set(["WM1"]));
  const [gradeMetric, setGradeMetric] = useState("cumulative");
  const [gradePercentMetric, setGradePercentMetric] = useState("cumulative");
  const [gradeSelectedYears, setGradeSelectedYears] = useState(new Set());
  const [gradeWeekStart, setGradeWeekStart] = useState(1);
  const [gradeWeekEnd, setGradeWeekEnd] = useState(52);
  const [showGradeAverage, setShowGradeAverage] = useState(true);
  const [showGradeLabels, setShowGradeLabels] = useState(true);
  const [tableMethodology, setTableMethodology] = useState("Earlies");
  const [tableCommodity, setTableCommodity] = useState("White Maize");
  const [tableYear, setTableYear] = useState("");
  const [tableBasis, setTableBasis] = useState("weekly");
  const gradeChartRef = useRef(null);

  useEffect(() => {
    fetch("/data/fundamentals/deliveries.json")
      .then((response) => response.json())
      .then((payload) => {
        setData(payload);
        setSelectedYears(new Set(payload.marketingYears.slice(-4)));
        setGradeSelectedYears(new Set(payload.marketingYears.slice(-4)));
        setTableYear(payload.marketingYears.at(-1) || "");
      });
  }, []);

  const activeCommodity = deliveryType === "Maize" ? commodity : deliveryType;
  const activeMethodology = deliveryType === "Maize" ? methodology : "Standard";
  const calendarStartMonth = deliveryType === "Maize" && methodology === "SAGIS" ? 5 : 3;
  const gradeCalendarStartMonth = gradeMethodology === "SAGIS" ? 5 : 3;
  const metric = chartType === "bar" ? "weekly" : deliveryMetric;

  const deliveryRows = useMemo(() => {
    if (!data) return [];
    return data.deliveryRows.filter(
      (row) =>
        (deliveryType === "Maize" ? row.family === "Maize" : row.family === "Oilseeds") &&
        row.methodology === activeMethodology &&
        row.commodity === activeCommodity &&
        row.weekNumber >= weekStart &&
        row.weekNumber <= weekEnd &&
        row.weekNumber <= 52
    );
  }, [data, deliveryType, activeCommodity, activeMethodology, weekStart, weekEnd]);

  const valueForDelivery = (row) => {
    if (metric === "percent") return row.percentDelivered;
    if (metric === "weekly") return row.weeklyTons;
    return row.cumulativeTons;
  };
  const deliverySeries = useMemo(() => seriesFromRows(deliveryRows.filter((row) => selectedYears.has(row.marketingYear)), valueForDelivery), [deliveryRows, selectedYears, metric]);
  const deliveryAverage = useMemo(() => (data ? averageSeries(seriesFromRows(deliveryRows, valueForDelivery), selectedYears, data.marketingYears, showAverage) : null), [data, deliveryRows, selectedYears, showAverage, metric]);

  const gradeOptions = data?.gradeOptions?.[gradeCommodity] || [];
  const gradeOptionsKey = gradeOptions.join("|");
  useEffect(() => {
    if (!data || !gradeOptions.length) return;
    setSelectedGrades((current) => {
      const validGrades = [...current].filter((item) => gradeOptions.includes(item));
      return validGrades.length ? new Set(validGrades) : new Set([gradeOptions[0]]);
    });
  }, [data, gradeCommodity, gradeOptionsKey]);

  const gradeRows = useMemo(() => {
    if (!data || deliveryType !== "Maize") return [];
    const totalGrade = TOTAL_GRADE_BY_COMMODITY[gradeCommodity];
    const totalRowsByKey = new Map();
    for (const row of data.gradeRows) {
      if (
        row.methodology === gradeMethodology &&
        row.commodity === gradeCommodity &&
        row.grade === totalGrade &&
        row.weekNumber >= gradeWeekStart &&
        row.weekNumber <= gradeWeekEnd &&
        row.weekNumber <= 52
      ) {
        totalRowsByKey.set(`${row.methodology}||${row.marketingYear}||${row.weekNumber}||${row.commodity}`, row);
      }
    }

    const selectedRows = data.gradeRows.filter(
      (row) =>
        row.methodology === gradeMethodology &&
        row.commodity === gradeCommodity &&
        selectedGrades.has(row.grade) &&
        row.weekNumber >= gradeWeekStart &&
        row.weekNumber <= gradeWeekEnd &&
        row.weekNumber <= 52
    );

    return aggregateGradeRows(selectedRows, totalRowsByKey);
  }, [data, deliveryType, gradeMethodology, gradeCommodity, selectedGrades, gradeWeekStart, gradeWeekEnd]);
  const valueForGrade = (row) => {
    if (gradeMetric !== "percent") return row.cumulativeTons;
    return gradePercentMetric === "weekly" ? row.percentOfWeeklyDelivered : row.percentOfTotalDelivered;
  };
  const gradeSeries = useMemo(() => seriesFromRows(gradeRows.filter((row) => gradeSelectedYears.has(row.marketingYear)), valueForGrade), [gradeRows, gradeSelectedYears, gradeMetric, gradePercentMetric]);
  const gradeAverage = useMemo(() => (data ? averageSeries(seriesFromRows(gradeRows, valueForGrade), gradeSelectedYears, data.marketingYears, showGradeAverage) : null), [data, gradeRows, gradeSelectedYears, showGradeAverage, gradeMetric, gradePercentMetric]);

  if (!data) return <div className="min-h-screen bg-slate-100 p-8 text-slate-700">Loading deliveries data...</div>;

  const latest = deliverySeries.at(-1);
  const referenceYear = [...selectedYears].sort().at(-1);
  const gradeReferenceYear = [...gradeSelectedYears].sort().at(-1);
  const selectedGradeTitle = gradeSelectionLabel(selectedGrades);
  const gradeMetricTitle = gradeMetric === "percent"
    ? `${gradePercentMetric === "weekly" ? "weekly" : "cumulative"} % of total delivered`
    : "cumulative deliveries";
  const gradeBasisDescription = gradeMetric === "percent"
    ? gradePercentMetric === "weekly"
      ? `Of ${gradeCommodity} delivered in that week, what percentage was ${selectedGradeTitle}?`
      : `Of all ${gradeCommodity} delivered so far, what percentage was ${selectedGradeTitle}?`
    : `Cumulative tons delivered for ${selectedGradeTitle}.`;
  const tableGradeOptions = data.gradeOptions?.[tableCommodity] || [];
  const tableTotalGrade = TOTAL_GRADE_BY_COMMODITY[tableCommodity];
  const tableGrades = tableGradeOptions.filter((grade) => grade !== tableTotalGrade);
  const tableRows = buildGradeTableRows(data.gradeRows, tableMethodology, tableCommodity, tableYear, tableGrades, tableTotalGrade, tableBasis);
  const latestPoint = latest?.values.at(-1);
  const cec = latestPoint?.cec ?? data.cecEstimates[latest?.year]?.[activeCommodity] ?? 0;
  const percent = cec && latestPoint?.cumulative ? (latestPoint.cumulative / cec) * 100 : null;
  const weeklyPeak = Math.max(0, ...deliverySeries.flatMap((item) => item.values.map((point) => point.weekly)));
  const setWeekInput = (setter, fallback) => (event) => {
    if (event.target.value === "") return;
    setter(clampWeek(event.target.value, fallback));
  };

  const cards = [
    ["Latest selected year", latest?.year ?? "-", latestPoint ? `${fmt.format(latestPoint.cumulative)} tons` : "-"],
    ["CEC estimate", cec ? `${fmt.format(cec)} tons` : "-", activeCommodity],
    ["% delivered", percent === null ? "-" : `${pctFmt.format(percent)}%`, activeMethodology],
    ["Peak weekly delivery", `${fmt.format(weeklyPeak)} tons`, `Weeks ${weekStart} to ${weekEnd}`],
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <p className="text-xs font-bold uppercase text-slate-500">Fundamentals</p>
        <h1 className="text-3xl font-extrabold">Deliveries</h1>
      </div>
      <main className="grid grid-cols-[290px_minmax(0,1fr)] gap-6 p-6">
        <aside className="self-start rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
          <div className="grid gap-5">
            <section className="grid gap-2">
              <label className="text-sm font-bold">Delivery type</label>
              <ToggleGroup columns={3} value={deliveryType} onChange={setDeliveryType} options={[{ value: "Maize", label: "Maize" }, { value: "Sunflowers", label: "Sunflowers" }, { value: "Soybeans", label: "Soybeans" }]} />
            </section>
            {deliveryType === "Maize" && (
              <>
                <section className="grid gap-2">
                  <label className="text-sm font-bold">Methodology</label>
                  <ToggleGroup value={methodology} onChange={setMethodology} options={[{ value: "SAGIS", label: "SAGIS" }, { value: "Earlies", label: "Earlies" }]} />
                  <p className="text-xs text-slate-500">{methodology === "SAGIS" ? "Runs from 1 May to end April." : "Includes maize earlies from 1 March to end February."}</p>
                </section>
                <label className="grid gap-2 text-sm font-bold">
                  Deliveries commodity
                  <select value={commodity} onChange={(event) => setCommodity(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal">
                    {data.commodities.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </>
            )}
            <section className="grid gap-2">
              <label className="text-sm font-bold">Chart type</label>
              <ToggleGroup value={chartType} onChange={setChartType} options={[{ value: "line", label: "Line" }, { value: "bar", label: "Bar" }]} />
            </section>
            <section className="grid gap-2">
              <label className="text-sm font-bold">Line metric</label>
              <ToggleGroup value={deliveryMetric} onChange={setDeliveryMetric} options={[{ value: "cumulative", label: "Tons" }, { value: "percent", label: "%" }]} />
            </section>
            <YearChecks years={data.marketingYears} selectedYears={selectedYears} setSelectedYears={setSelectedYears} />
            <section className="grid gap-2">
              <label className="text-sm font-bold">Week range</label>
              <div className="grid grid-cols-2 gap-2">
                <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="1" max="52" value={weekStart} onChange={setWeekInput(setWeekStart, 1)} />
                <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="1" max="52" value={weekEnd} onChange={setWeekInput(setWeekEnd, 52)} />
              </div>
            </section>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={showAverage} onChange={(event) => setShowAverage(event.target.checked)} />Show 5-year average</label>
            <p className="text-xs text-slate-500">{deliveryAverage?.sourceYears?.length ? `Average uses ${deliveryAverage.sourceYears.join(", ")}.` : "Select a later year to calculate a prior 5-year average."}</p>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="grid grid-cols-4 gap-4">
            {cards.map(([label, value, sub]) => <SummaryCard key={label} label={label} value={value} sub={sub} />)}
          </div>
          <ChartPanel
            title={`${metric === "weekly" ? "Weekly deliveries" : metric === "percent" ? "% delivered vs CEC" : "Cumulative deliveries"}: ${activeCommodity}`}
            eyebrow={deliveryType === "Maize" ? `${methodology} methodology` : "Standard oilseeds methodology"}
            series={deliverySeries}
            average={deliveryAverage}
            years={data.marketingYears}
            chartType={chartType}
            valueKind={metric === "percent" ? "percent" : "tons"}
            weekStart={weekStart}
            weekEnd={weekEnd}
            calendarStartMonth={calendarStartMonth}
            referenceYear={referenceYear}
            showLabels={showDeliveryLabels}
            onToggleLabels={() => setShowDeliveryLabels((current) => !current)}
            fileName={`deliveries-${activeCommodity}-${activeMethodology}`}
          />
        </section>

        {deliveryType === "Maize" && (
          <section className="col-span-2 grid grid-cols-[290px_minmax(0,1fr)] gap-6">
              <aside className="self-start rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
                <div className="grid gap-5">
                  <section className="grid gap-2">
                    <label className="text-sm font-bold">Grade methodology</label>
                    <ToggleGroup value={gradeMethodology} onChange={setGradeMethodology} options={[{ value: "SAGIS", label: "SAGIS" }, { value: "Earlies", label: "Earlies" }]} />
                  </section>

                  <label className="grid gap-2 text-sm font-bold">
                    Grade commodity
                    <select value={gradeCommodity} onChange={(event) => setGradeCommodity(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal">
                      {data.commodities.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>

                  <section className="grid gap-2">
                    <label className="text-sm font-bold">Grades</label>
                    <div className="grid max-h-40 grid-cols-2 gap-2 overflow-auto text-sm">
                      {gradeOptions.map((item) => (
                        <label key={item} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedGrades.has(item)}
                            onChange={(event) => {
                              const next = new Set(selectedGrades);
                              event.target.checked ? next.add(item) : next.delete(item);
                              if (!next.size && gradeOptions.length) next.add(gradeOptions[0]);
                              setSelectedGrades(next);
                            }}
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-2">
                    <label className="text-sm font-bold">Grade metric</label>
                    <ToggleGroup value={gradeMetric} onChange={setGradeMetric} options={[{ value: "cumulative", label: "Tons" }, { value: "percent", label: "%" }]} />
                  </section>

                  {gradeMetric === "percent" && (
                    <section className="grid gap-2">
                      <label className="text-sm font-bold">Percentage basis</label>
                      <ToggleGroup value={gradePercentMetric} onChange={setGradePercentMetric} options={[{ value: "cumulative", label: "Cumulative %" }, { value: "weekly", label: "Weekly %" }]} />
                    </section>
                  )}

                  <YearChecks label="Grade marketing years" years={data.marketingYears} selectedYears={gradeSelectedYears} setSelectedYears={setGradeSelectedYears} />

                  <section className="grid gap-2">
                    <label className="text-sm font-bold">Grade week range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="1" max="52" value={gradeWeekStart} onChange={setWeekInput(setGradeWeekStart, 1)} />
                      <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="1" max="52" value={gradeWeekEnd} onChange={setWeekInput(setGradeWeekEnd, 52)} />
                    </div>
                  </section>

                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={showGradeAverage} onChange={(event) => setShowGradeAverage(event.target.checked)} />
                    Show grade 5-year average
                  </label>
                </div>
              </aside>

              <section ref={gradeChartRef} className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Grade deliveries</p>
                    <h2 className="text-lg font-extrabold">{selectedGradeTitle} {gradeMetricTitle} | {gradeMethodology}</h2>
                    <p className="mt-1 max-w-2xl text-xs font-semibold text-slate-500">{gradeBasisDescription}</p>
                  </div>
                  <div className="grid justify-items-end gap-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => setShowGradeLabels((current) => !current)}>
                        {showGradeLabels ? "Hide Labels" : "Show Labels"}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        onClick={() =>
                          exportChartPng({
                            container: gradeChartRef.current,
                            eyebrow: "Grade deliveries",
                            title: `${selectedGradeTitle} ${gradeMetricTitle} | ${gradeMethodology}`,
                            legendItems: chartLegendItems(gradeSeries, gradeAverage, data.marketingYears),
                            fileName: `grade-deliveries-${selectedGradeTitle}-${gradeMetricTitle}-${gradeMethodology}`,
                            series: gradeSeries,
                            average: gradeAverage,
                            years: data.marketingYears,
                            valueKind: gradeMetric === "percent" ? "percent" : "tons",
                            chartType: "line",
                            weekStart: gradeWeekStart,
                            weekEnd: gradeWeekEnd,
                            referenceYear: gradeReferenceYear,
                            calendarStartMonth: gradeCalendarStartMonth,
                            includeLabels: showGradeLabels,
                          })
                        }
                      >
                        Download PNG
                      </button>
                    </div>
                    <Legend series={gradeSeries} average={gradeAverage} years={data.marketingYears} />
                  </div>
                </div>
                <FundamentalsChart
                  series={gradeSeries}
                  average={gradeAverage}
                  years={data.marketingYears}
                  chartType="line"
                  valueKind={gradeMetric === "percent" ? "percent" : "tons"}
                  weekStart={gradeWeekStart}
                  weekEnd={gradeWeekEnd}
                  calendarStartMonth={gradeCalendarStartMonth}
                  referenceYear={gradeReferenceYear}
                  showLabels={showGradeLabels}
                />
              </section>

              <GradeDataTable
                methodology={tableMethodology}
                setMethodology={setTableMethodology}
                commodity={tableCommodity}
                setCommodity={setTableCommodity}
                year={tableYear}
                setYear={setTableYear}
                basis={tableBasis}
                setBasis={setTableBasis}
                commodities={data.commodities}
                years={data.marketingYears}
                grades={tableRows.grades}
                rows={tableRows.rows}
                totals={tableRows.totals}
              />
            </section>
        )}
      </main>
    </div>
  );
}

function buildGradeTableRows(sourceRows, methodology, commodity, year, grades, totalGrade, basis = "weekly") {
  if (!year || !grades.length || !totalGrade) return { grades, rows: [], totals: null };
  const rowsByWeek = new Map();
  const lowerGradeParts = LOWER_GRADE_BY_COMMODITY[commodity] || [];
  const lowerGradeIndex = lowerGradeParts.length ? grades.findIndex((grade) => grade === lowerGradeParts.at(-1)) : -1;
  const tableGrades = lowerGradeIndex >= 0
    ? [...grades.slice(0, lowerGradeIndex + 1), "Lower Grade", ...grades.slice(lowerGradeIndex + 1)]
    : grades;

  for (const row of sourceRows) {
    if (row.methodology !== methodology || row.commodity !== commodity || row.marketingYear !== year || row.weekNumber > 52) continue;
    if (![...grades, totalGrade].includes(row.grade)) continue;
    if (!rowsByWeek.has(row.weekNumber)) {
      rowsByWeek.set(row.weekNumber, {
        week: row.weekNumber,
        values: Object.fromEntries(grades.map((grade) => [grade, 0])),
        total: 0,
      });
    }
    const tableRow = rowsByWeek.get(row.weekNumber);
    const value = basis === "cumulative" ? row.cumulativeTons || 0 : row.weeklyTons || 0;
    if (row.grade === totalGrade) tableRow.total = value;
    if (grades.includes(row.grade)) tableRow.values[row.grade] = value;
  }

  const rows = [...rowsByWeek.values()]
    .filter((row) => row.total || grades.some((grade) => row.values[grade]))
    .sort((a, b) => a.week - b.week)
    .map((row) => {
      const values = {
        ...row.values,
        ...(lowerGradeParts.length ? { "Lower Grade": lowerGradeParts.reduce((sum, grade) => sum + (row.values[grade] || 0), 0) } : {}),
      };
      return {
        ...row,
        values,
        percents: Object.fromEntries(tableGrades.map((grade) => [grade, row.total ? (values[grade] / row.total) * 100 : null])),
      };
    });

  const totals = basis === "cumulative"
    ? rows.at(-1) ? { values: { ...rows.at(-1).values }, total: rows.at(-1).total || 0 } : null
    : rows.reduce(
        (acc, row) => {
          for (const grade of tableGrades) acc.values[grade] += row.values[grade] || 0;
          acc.total += row.total || 0;
          return acc;
        },
        { values: Object.fromEntries(tableGrades.map((grade) => [grade, 0])), total: 0 }
      );
  if (!totals) return { grades: tableGrades, rows, totals: null };
  totals.percents = Object.fromEntries(tableGrades.map((grade) => [grade, totals.total ? (totals.values[grade] / totals.total) * 100 : null]));

  return { grades: tableGrades, rows, totals };
}

function excelCell(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function exportGradeTableExcel({ methodology, commodity, year, basisLabel, totalLabel, footerLabel, grades, rows, totals }) {
  const headings = [
    "Week",
    ...grades.map((grade) => `${basisLabel} ${grade}`),
    totalLabel,
    ...grades.map((grade) => `% ${grade}`),
    "% Total",
  ];
  const tableRows = rows.map((row) => [
    row.week,
    ...grades.map((grade) => row.values[grade] || 0),
    row.total || 0,
    ...grades.map((grade) => (row.percents[grade] === null ? "" : row.percents[grade] / 100)),
    row.total ? 1 : "",
  ]);
  if (totals) {
    tableRows.push([
      footerLabel,
      ...grades.map((grade) => totals.values[grade] || 0),
      totals.total || 0,
      ...grades.map((grade) => (totals.percents[grade] === null ? "" : totals.percents[grade] / 100)),
      totals.total ? 1 : "",
    ]);
  }

  const percentStart = 1 + grades.length + 1;
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
        th, td { border: 1px solid #1f2937; padding: 4px 8px; text-align: right; }
        th { background: #dbe7f7; font-weight: 700; }
        .title { text-align: center; font-size: 18px; background: #ffffff; }
        .label { background: #b8cbe8; font-weight: 700; }
        .total { font-weight: 700; background: #eef2f7; }
      </style></head>
      <body>
        <table>
          <tr><th class="title" colspan="${headings.length}">${excelCell(year)} - ${excelCell(commodity)} (${excelCell(methodology)} ${excelCell(basisLabel)})</th></tr>
          <tr>${headings.map((heading, index) => `<th class="${index === 0 ? "label" : ""}">${excelCell(heading)}</th>`).join("")}</tr>
          ${tableRows
            .map((row, rowIndex) => {
              const isTotal = rowIndex === tableRows.length - 1 && totals;
              return `<tr class="${isTotal ? "total" : ""}">${row
                .map((value, index) => {
                  const style = index >= percentStart ? " style=\"mso-number-format:'0.00%'\"" : "";
                  return `<td${style}>${excelCell(value)}</td>`;
                })
                .join("")}</tr>`;
            })
            .join("")}
        </table>
      </body>
    </html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(`grade-table-${commodity}-${year}-${methodology}-${basisLabel}`)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function GradeDataTable({ methodology, setMethodology, commodity, setCommodity, year, setYear, basis, setBasis, commodities, years, grades, rows, totals }) {
  const basisLabel = basis === "cumulative" ? "Cumulative" : "Weekly";
  const totalLabel = basis === "cumulative" ? "Cumulative Total" : "Weekly Total";
  const footerLabel = basis === "cumulative" ? "Season to date" : "Displayed total";
  return (
    <section className="col-span-2 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Grade data table</p>
          <h2 className="text-lg font-extrabold">{year || "-"} - {commodity}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{basisLabel} grade tons and {basisLabel.toLowerCase()} share of total delivered for the selected year.</p>
        </div>
        <div className="grid min-w-[720px] grid-cols-4 gap-3">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Methodology
            <select value={methodology} onChange={(event) => setMethodology(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-900">
              <option>SAGIS</option>
              <option>Earlies</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Commodity
            <select value={commodity} onChange={(event) => setCommodity(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-900">
              {commodities.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Marketing year
            <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-900">
              {[...years].reverse().map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <section className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Table basis
            <ToggleGroup value={basis} onChange={setBasis} options={[{ value: "weekly", label: "Weekly" }, { value: "cumulative", label: "Cumulative" }]} />
          </section>
          <div className="col-span-4 flex justify-end">
            <button
              type="button"
              disabled={!rows.length}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => exportGradeTableExcel({ methodology, commodity, year, basisLabel, totalLabel, footerLabel, grades, rows, totals })}
            >
              Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-slate-300">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-200 text-left text-slate-900">
              <th className="sticky left-0 z-10 border border-slate-300 bg-slate-300 px-2 py-1.5 text-right">Week</th>
              {grades.map((grade) => <th key={grade} className="border border-slate-300 px-2 py-1.5 text-right">{basisLabel} {grade}</th>)}
              <th className="border border-slate-300 px-2 py-1.5 text-right">{totalLabel}</th>
              {grades.map((grade) => <th key={`pct-${grade}`} className="border border-slate-300 px-2 py-1.5 text-right">% {grade}</th>)}
              <th className="border border-slate-300 px-2 py-1.5 text-right">% Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.week} className="odd:bg-white even:bg-slate-50">
                <th className="sticky left-0 z-10 border border-slate-300 bg-slate-200 px-2 py-1.5 text-right font-bold">{row.week}</th>
                {grades.map((grade) => <td key={grade} className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{fmt.format(row.values[grade] || 0)}</td>)}
                <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold tabular-nums">{fmt.format(row.total || 0)}</td>
                {grades.map((grade) => <td key={`pct-${grade}`} className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{row.percents[grade] === null ? "-" : `${tablePctFmt.format(row.percents[grade])}%`}</td>)}
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{row.total ? "100%" : "-"}</td>
              </tr>
            ))}
            {totals && (
              <tr className="bg-slate-100 font-bold">
                <th className="sticky left-0 z-10 border border-slate-300 bg-slate-300 px-2 py-1.5 text-right">{footerLabel}</th>
                {grades.map((grade) => <td key={grade} className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{fmt.format(totals.values[grade] || 0)}</td>)}
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{fmt.format(totals.total || 0)}</td>
                {grades.map((grade) => <td key={`pct-${grade}`} className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{totals.percents[grade] === null ? "-" : `${tablePctFmt.format(totals.percents[grade])}%`}</td>)}
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{totals.total ? "100%" : "-"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="mt-3 text-sm font-semibold text-slate-500">No table data available for this selection.</p>}
    </section>
  );
}

function SummaryCard({ label, value, sub }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></article>;
}

function Legend({ series, average, years }) {
  return <div className="mb-2 flex flex-wrap justify-end gap-3 text-xs text-slate-500">{series.map((item) => <span key={item.year} className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: yearColor(item.year, years) }} />{item.year}</span>)}{average && <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: averageColor }} />5-year avg</span>}</div>;
}

function ChartPanel({ title, eyebrow, series, average, years, chartType, valueKind, weekStart, weekEnd, calendarStartMonth, referenceYear, showLabels, onToggleLabels, fileName }) {
  const chartRef = useRef(null);
  return <section ref={chartRef} className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60"><div className="mb-4 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-slate-500">{eyebrow}</p><h2 className="text-lg font-extrabold">{title}</h2></div><div className="grid justify-items-end gap-2"><div className="flex flex-wrap justify-end gap-2"><button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={onToggleLabels}>{showLabels ? "Hide Labels" : "Show Labels"}</button><button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => exportChartPng({ container: chartRef.current, title, eyebrow, legendItems: chartLegendItems(series, average, years), fileName, series, average, years, valueKind, chartType, weekStart, weekEnd, referenceYear, calendarStartMonth, includeLabels: showLabels })}>Download PNG</button></div><Legend series={series} average={average} years={years} /></div></div><FundamentalsChart series={series} average={average} years={years} chartType={chartType} valueKind={valueKind} weekStart={weekStart} weekEnd={weekEnd} calendarStartMonth={calendarStartMonth} referenceYear={referenceYear} showLabels={showLabels} /></section>;
}

function YearChecks({ label = "Marketing years", years, selectedYears, setSelectedYears }) {
  const displayYears = [...years].reverse();
  return <section className="grid gap-2"><label className="text-sm font-bold">{label}</label><div className="grid grid-cols-2 gap-2"><button className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set())}>Clear All</button><button className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set(years.slice(-4)))}>Latest 4</button></div><div className="grid max-h-48 grid-cols-2 gap-2 overflow-auto text-sm">{displayYears.map((year) => <label key={year} className="flex items-center gap-2"><input type="checkbox" checked={selectedYears.has(year)} onChange={(event) => { const next = new Set(selectedYears); event.target.checked ? next.add(year) : next.delete(year); setSelectedYears(next); }} />{year}</label>)}</div></section>;
}
