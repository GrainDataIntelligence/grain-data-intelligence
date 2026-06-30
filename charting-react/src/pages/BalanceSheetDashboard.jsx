import { useEffect, useMemo, useState } from "react";
import { averageColor, fmt, yearColor } from "./fundamentalsUtils";

const featuredMetricKeys = new Set(["producerDeliveries", "imports", "totalSupply", "localDemand", "exports", "totalDemand", "unutilizedClosingStock", "endingStocks"]);
const hiddenMaizeMetrics = new Set(["gristing", "bioFuel"]);
const oilseedLocalMarketReportingMetrics = new Set([
  "processedLocalMarket",
  "humanConsumptionLocal",
  "animalFeedLocal",
  "oilAndOilcakeLocal",
]);
const chartWidth = 1040;
const chartHeight = 430;
const margin = { top: 26, right: 8, bottom: 46, left: 68 };
const plotWidth = chartWidth - margin.left - margin.right;
const plotHeight = chartHeight - margin.top - margin.bottom;

function ToggleGroup({ value, onChange, options }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-9 px-3 text-sm ${
            value === option.value ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function buildSeries(rows, metric, mode, metricType) {
  const byYear = new Map();
  for (const row of rows.filter((item) => item.metric === metric)) {
    if (!byYear.has(row.marketingYear)) byYear.set(row.marketingYear, []);
    byYear.get(row.marketingYear).push(row);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, values]) => {
      let running = 0;
      return {
        year,
        values: values
          .sort((a, b) => a.monthOrder - b.monthOrder)
          .map((row) => {
            running += row.value;
            return {
              month: row.month,
              calendarYear: row.calendarYear,
              monthOrder: row.monthOrder,
              value: mode === "cumulative" && metricType !== "stock" ? running : row.value,
              rawValue: row.value,
            };
          }),
      };
    });
}

function averageSeries(series, selectedYears, allYears, showAverage) {
  if (!showAverage || selectedYears.size === 0) return null;
  const latest = [...selectedYears].sort().at(-1);
  const averageYears = allYears.filter((year) => year < latest).slice(-5);
  const included = series.filter((item) => averageYears.includes(item.year));
  const byMonth = new Map();

  for (const item of included) {
    for (const point of item.values) {
      if (!byMonth.has(point.monthOrder)) byMonth.set(point.monthOrder, []);
      byMonth.get(point.monthOrder).push(point.value);
    }
  }

  const values = [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([monthOrder, points]) => ({
      monthOrder,
      month: series[0]?.values.find((point) => point.monthOrder === monthOrder)?.month || "",
      value: points.reduce((sum, value) => sum + value, 0) / points.length,
    }));

  return values.length ? { year: "5-year avg", sourceYears: averageYears, values } : null;
}

function pct(value) {
  if (!Number.isFinite(value)) return "";
  return `${value.toFixed(1)}%`;
}

function buildBalanceTable(series, months, metricType, mode) {
  const latestSeries = series.at(-1);
  const comparisonMonthOrder =
    latestSeries?.values
      .filter((point) => Number.isFinite(point.rawValue))
      .map((point) => point.monthOrder)
      .at(-1) || months.length;
  const totalHeader = metricType === "stock" ? "Latest" : "YTD Total";
  const showFullYearTotal = metricType !== "stock";

  const rows = series.map((item) => {
    const monthlyValues = months.map((month, index) => item.values.find((point) => point.monthOrder === index + 1)?.rawValue ?? null);
    const values = months.map((month, index) => item.values.find((point) => point.monthOrder === index + 1)?.value ?? null);
    const comparableValues = monthlyValues.slice(0, comparisonMonthOrder).filter((value) => Number.isFinite(value));
    const fullYearValues = monthlyValues.filter((value) => Number.isFinite(value));
    const comparablePoint = monthlyValues[comparisonMonthOrder - 1];
    const comparableDisplayPoint = values[comparisonMonthOrder - 1];
    const total =
      metricType === "stock"
        ? Number.isFinite(comparablePoint)
          ? comparablePoint
          : null
        : mode === "cumulative"
        ? Number.isFinite(comparableDisplayPoint)
          ? comparableDisplayPoint
          : null
        : comparableValues.reduce((sum, value) => sum + value, 0);
    const fullYearTotal = showFullYearTotal ? fullYearValues.reduce((sum, value) => sum + value, 0) : null;

    return {
      year: item.year,
      values,
      total,
      fullYearTotal,
      ytdChange: null,
      rank: null,
      isAverage: false,
    };
  });

  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    if (Number.isFinite(row.total) && Number.isFinite(previous?.total) && previous.total !== 0) {
      row.ytdChange = ((row.total - previous.total) / Math.abs(previous.total)) * 100;
    }
  });

  const ranked = rows
    .filter((row) => Number.isFinite(row.total))
    .sort((a, b) => b.total - a.total);
  ranked.forEach((row, index) => {
    row.rank = index + 1;
  });

  const averageRow = (label, sourceRows) => {
    if (!sourceRows.length) return null;
    const values = months.map((_, index) => {
      const points = sourceRows.map((row) => row.values[index]).filter((value) => Number.isFinite(value));
      return points.length ? points.reduce((sum, value) => sum + value, 0) / points.length : null;
    });
    const totals = sourceRows.map((row) => row.total).filter((value) => Number.isFinite(value));
    const fullYearTotals = sourceRows.map((row) => row.fullYearTotal).filter((value) => Number.isFinite(value));
    const ytdValues = sourceRows.map((row) => row.ytdChange).filter((value) => Number.isFinite(value));

    return {
      year: label,
      values,
      total: totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null,
      fullYearTotal: fullYearTotals.length ? fullYearTotals.reduce((sum, value) => sum + value, 0) / fullYearTotals.length : null,
      ytdChange: ytdValues.length ? ytdValues.reduce((sum, value) => sum + value, 0) / ytdValues.length : null,
      rank: null,
      isAverage: true,
    };
  };

  const historicalRows = rows.slice(0, -1);
  const summaryRows = [averageRow("5 Yr Avg", historicalRows.slice(-5)), averageRow("15 Yr Avg", historicalRows.slice(-15))].filter(Boolean);
  return { rows, summaryRows, totalHeader, comparisonMonth: months[comparisonMonthOrder - 1], showFullYearTotal };
}

function pathForSeries(points, xScale, yScale) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.monthOrder).toFixed(2)} ${yScale(point.value).toFixed(2)}`)
    .join(" ");
}

function niceDomain(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return { min: 0, max: 1, step: 1 };

  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  const dataRange = Math.max(1, dataMax - dataMin);
  const paddedMin = dataMin - dataRange * 0.08;
  const paddedMax = dataMax + dataRange * 0.08;

  let rawMin = paddedMin;
  let rawMax = paddedMax;

  if (dataMin >= 0 && dataMin / Math.max(dataMax, 1) < 0.35) {
    rawMin = 0;
  } else if (dataMax <= 0 && Math.abs(dataMax) / Math.max(Math.abs(dataMin), 1) < 0.35) {
    rawMax = 0;
  } else if (dataMin < 0 && dataMax > 0) {
    rawMin = Math.min(rawMin, 0);
    rawMax = Math.max(rawMax, 0);
  }

  const range = Math.max(1, rawMax - rawMin);
  const rawStep = range / 5;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const fraction = rawStep / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * power;
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;

  return { min, max: max === min ? min + step : max, step };
}

function BalanceSheetChart({ months, series, average, selectedYears, allYears, metricLabel, mode, view, metricNote }) {
  const [hover, setHover] = useState(null);
  const activeSeries = series.filter((item) => selectedYears.has(item.year));
  const values = activeSeries.flatMap((item) => item.values.map((point) => point.value));
  if (average) values.push(...average.values.map((point) => point.value));
  const scale = niceDomain(values);
  const ticks = [];
  for (let tick = scale.min; tick <= scale.max + scale.step / 2; tick += scale.step) {
    ticks.push(tick);
  }

  const xScale = (monthOrder) => margin.left + ((monthOrder - 1) / 11) * plotWidth;
  const yScale = (value) => margin.top + ((scale.max - value) / (scale.max - scale.min)) * plotHeight;
  const monthTicks = months.map((month, index) => ({ month, monthOrder: index + 1 }));

  const handleMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * chartWidth;
    const monthOrder = Math.max(1, Math.min(12, Math.round(((relativeX - margin.left) / plotWidth) * 11 + 1)));
    const points = activeSeries.map((item) => ({
      year: item.year,
      color: yearColor(item.year, allYears),
      point: item.values.find((value) => value.monthOrder === monthOrder),
    }));
    const averagePoint = average?.values.find((value) => value.monthOrder === monthOrder);
    setHover({
      monthOrder,
      month: months[monthOrder - 1],
      x: xScale(monthOrder),
      points,
      averagePoint,
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/60">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">{view} Balance Sheet</p>
          <h2 className="text-lg font-extrabold text-slate-950">
            {mode === "cumulative" ? "Cumulative" : "Monthly"} {metricLabel}
          </h2>
          {metricNote ? <p className="mt-1 text-xs font-semibold text-amber-700">{metricNote}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-xs text-slate-600">
          {activeSeries.map((item) => (
            <span key={item.year} className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm" style={{ background: yearColor(item.year, allYears) }} />
              {item.year}
            </span>
          ))}
          {average && (
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm" style={{ background: averageColor }} />
              5-year avg
            </span>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          className="h-[560px] w-full select-none overflow-visible"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="white" />

          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={margin.left} x2={chartWidth - margin.right} y1={yScale(tick)} y2={yScale(tick)} stroke="#dbe3ee" />
              <text x={margin.left - 12} y={yScale(tick) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                {fmt.format(tick)}
              </text>
            </g>
          ))}

          {monthTicks.map((tick) => (
            <g key={tick.month}>
              <line x1={xScale(tick.monthOrder)} x2={xScale(tick.monthOrder)} y1={margin.top} y2={margin.top + plotHeight} stroke="#edf2f7" />
              <text x={xScale(tick.monthOrder)} y={chartHeight - 20} textAnchor="middle" className="fill-slate-500 text-[12px]">
                {tick.month}
              </text>
            </g>
          ))}

          <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} stroke="#94a3b8" />
          <line x1={margin.left} x2={chartWidth - margin.right} y1={margin.top + plotHeight} y2={margin.top + plotHeight} stroke="#94a3b8" />
          {scale.min < 0 && scale.max > 0 && (
            <line x1={margin.left} x2={chartWidth - margin.right} y1={yScale(0)} y2={yScale(0)} stroke="#94a3b8" strokeWidth="1.5" />
          )}

          {activeSeries.map((item) => (
            <path
              key={item.year}
              d={pathForSeries(item.values, xScale, yScale)}
              fill="none"
              stroke={yearColor(item.year, allYears)}
              strokeWidth={item.year === allYears.at(-1) ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {average && (
            <path
              d={pathForSeries(average.values, xScale, yScale)}
              fill="none"
              stroke={averageColor}
              strokeWidth="2.5"
              strokeDasharray="8 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {hover && (
            <g>
              <line x1={hover.x} x2={hover.x} y1={margin.top} y2={margin.top + plotHeight} stroke="#64748b" strokeDasharray="5 5" />
              <rect
                x={Math.min(hover.x + 12, chartWidth - 222)}
                y={margin.top + 12}
                width="210"
                height={46 + (hover.points.length + (hover.averagePoint ? 1 : 0)) * 20}
                rx="6"
                fill="white"
                opacity="0.95"
                stroke="#cbd5e1"
              />
              <text x={Math.min(hover.x + 26, chartWidth - 208)} y={margin.top + 34} className="fill-slate-950 text-[12px] font-bold">
                {hover.month}
              </text>
              {hover.points.map((item, index) =>
                item.point ? (
                  <g key={item.year}>
                    <text x={Math.min(hover.x + 26, chartWidth - 208)} y={margin.top + 58 + index * 20} className="text-[12px] font-bold" fill={item.color}>
                      {item.year}
                    </text>
                    <text x={Math.min(hover.x + 202, chartWidth - 32)} y={margin.top + 58 + index * 20} textAnchor="end" className="text-[12px] font-bold" fill={item.color}>
                      {fmt.format(item.point.value)}
                    </text>
                  </g>
                ) : null
              )}
              {hover.averagePoint && (
                <g>
                  <text x={Math.min(hover.x + 26, chartWidth - 208)} y={margin.top + 58 + hover.points.length * 20} className="fill-slate-900 text-[12px] font-bold">
                    5-year avg
                  </text>
                  <text x={Math.min(hover.x + 202, chartWidth - 32)} y={margin.top + 58 + hover.points.length * 20} textAnchor="end" className="fill-slate-900 text-[12px] font-bold">
                    {fmt.format(hover.averagePoint.value)}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function BalanceSheetTable({ months, series, metricLabel, metricType, mode, view, metricNote }) {
  const { rows, summaryRows, totalHeader, comparisonMonth, showFullYearTotal } = useMemo(
    () => buildBalanceTable(series, months, metricType, mode),
    [series, months, metricType, mode]
  );
  const title = `${view} - ${mode === "cumulative" && metricType !== "stock" ? `Cumulative ${metricLabel}` : metricLabel}`;
  const extraColumnCount = showFullYearTotal ? 1 : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/60">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase text-slate-500">Selected Data Table</p>
        <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
        {metricNote ? <p className="mt-1 text-xs font-semibold text-amber-700">{metricNote}</p> : null}
      </div>

      <div className="overflow-auto rounded-md border border-slate-300">
        <table className="min-w-[1120px] border-collapse text-right text-xs text-slate-950">
          <thead>
            <tr>
              <th colSpan={months.length + 4 + extraColumnCount} className="border border-slate-950 bg-slate-300 px-2 py-1 text-center text-sm font-extrabold">
                {title}
              </th>
            </tr>
            <tr className="bg-blue-100">
              <th className="sticky left-0 z-10 border border-slate-950 bg-blue-100 px-2 py-1 text-left font-extrabold">Year</th>
              {months.map((month) => (
                <th key={month} className="border border-slate-950 px-2 py-1 font-extrabold">
                  {month}
                </th>
              ))}
              <th className="border border-slate-950 px-2 py-1 font-extrabold">{totalHeader}</th>
              {showFullYearTotal && <th className="border border-slate-950 px-2 py-1 font-extrabold">Total</th>}
              <th className="border border-slate-950 px-2 py-1 font-extrabold">YTD Change</th>
              <th className="border border-slate-950 px-2 py-1 font-extrabold">Rank</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="odd:bg-white even:bg-slate-50">
                <th className="sticky left-0 z-10 border border-slate-950 bg-inherit px-2 py-1 text-left font-bold">{row.year}</th>
                {row.values.map((value, index) => (
                  <td key={`${row.year}-${months[index]}`} className="border border-slate-950 px-2 py-1 tabular-nums">
                    {Number.isFinite(value) ? fmt.format(Math.round(value)) : ""}
                  </td>
                ))}
                <td className="border border-slate-950 px-2 py-1 font-bold tabular-nums">{Number.isFinite(row.total) ? fmt.format(Math.round(row.total)) : ""}</td>
                {showFullYearTotal && (
                  <td className="border border-slate-950 px-2 py-1 font-bold tabular-nums">{Number.isFinite(row.fullYearTotal) ? fmt.format(Math.round(row.fullYearTotal)) : ""}</td>
                )}
                <td className="border border-slate-950 px-2 py-1 tabular-nums">{pct(row.ytdChange)}</td>
                <td className="border border-slate-950 px-2 py-1 tabular-nums">{row.rank ?? ""}</td>
              </tr>
            ))}
            {summaryRows.length > 0 && (
              <tr>
                <td colSpan={months.length + 4 + extraColumnCount} className="h-2 border-x border-slate-950" />
              </tr>
            )}
            {summaryRows.map((row) => (
              <tr key={row.year} className="bg-slate-100 font-bold">
                <th className="sticky left-0 z-10 border border-slate-950 bg-slate-100 px-2 py-1 text-left">{row.year}</th>
                {row.values.map((value, index) => (
                  <td key={`${row.year}-${months[index]}`} className="border border-slate-950 px-2 py-1 tabular-nums">
                    {Number.isFinite(value) ? fmt.format(Math.round(value)) : ""}
                  </td>
                ))}
                <td className="border border-slate-950 px-2 py-1 tabular-nums">{Number.isFinite(row.total) ? fmt.format(Math.round(row.total)) : ""}</td>
                {showFullYearTotal && (
                  <td className="border border-slate-950 px-2 py-1 tabular-nums">{Number.isFinite(row.fullYearTotal) ? fmt.format(Math.round(row.fullYearTotal)) : ""}</td>
                )}
                <td className="border border-slate-950 px-2 py-1 tabular-nums">{pct(row.ytdChange)}</td>
                <td className="border border-slate-950 px-2 py-1" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {totalHeader}, YTD Change and Rank are calculated as at {comparisonMonth}
        {showFullYearTotal ? "; Total shows the full marketing-year sum where available." : "."}
      </p>
    </div>
  );
}

export default function BalanceSheetDashboard({ dataPath, title }) {
  const [data, setData] = useState(null);
  const [view, setView] = useState("");
  const [metric, setMetric] = useState("producerDeliveries");
  const [mode, setMode] = useState("monthly");
  const [selectedYears, setSelectedYears] = useState(new Set());
  const [showAverage, setShowAverage] = useState(true);

  useEffect(() => {
    fetch(dataPath)
      .then((response) => response.json())
      .then((payload) => {
        setData(payload);
        setView(payload.defaultView || payload.views?.[0] || payload.commodity);
        setSelectedYears(new Set(payload.years.slice(-5)));
      });
  }, [dataPath]);

  const metrics = useMemo(() => {
    if (!data) return [];
    return data.commodity === "Maize" ? data.metrics.filter((item) => !hiddenMaizeMetrics.has(item.key)) : data.metrics;
  }, [data]);
  const metricMeta = metrics.find((item) => item.key === metric);

  useEffect(() => {
    if (metrics.length && !metricMeta) {
      setMetric(metrics[0].key);
    }
  }, [metrics, metricMeta]);

  const filteredRows = useMemo(() => data?.rows.filter((row) => row.view === view) || [], [data, view]);
  const series = useMemo(() => {
    if (!data || !metricMeta) return [];
    return buildSeries(filteredRows, metric, mode, metricMeta.type);
  }, [data, filteredRows, metric, mode, metricMeta]);

  const availableYears = data?.years || [];
  const displayYears = [...availableYears].reverse();
  const activeSeries = series.filter((item) => selectedYears.has(item.year));
  const latestYear = [...selectedYears].sort().at(-1) || availableYears.at(-1);
  const latestSeries = series.find((item) => item.year === latestYear);
  const latestPoint = latestSeries?.values.at(-1);
  const average = useMemo(() => averageSeries(series, selectedYears, availableYears, showAverage), [series, selectedYears, availableYears, showAverage]);
  const averageComparable = latestPoint ? average?.values.find((point) => point.monthOrder === latestPoint.monthOrder) : null;
  const latestPublication = data?.publicationDates?.at(-1);
  const metricNote =
    ["Soybeans", "Sunflowers"].includes(data?.commodity) && oilseedLocalMarketReportingMetrics.has(metric)
      ? "Note: detailed local-market reporting for this line starts from the 2024/25 marketing year."
      : "";

  if (!data || !metricMeta) {
    return <div className="min-h-screen bg-slate-100 p-8 text-slate-700">Loading balance sheet...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <p className="text-xs font-bold uppercase text-slate-500">Balance Sheet</p>
        <h1 className="text-3xl font-extrabold">{title}</h1>
      </div>

      <main className="grid grid-cols-[290px_minmax(0,1fr)] gap-6 p-6">
        <aside className="self-start rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
          <div className="grid gap-5">
            {data.views.length > 1 && (
              <label className="grid gap-2 text-sm font-bold">
                Commodity
                <select value={view} onChange={(event) => setView(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal">
                  {data.views.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="grid gap-2 text-sm font-bold">
              Chart
              <select value={metric} onChange={(event) => setMetric(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal">
                {metrics.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <section className="grid gap-2">
              <label className="text-sm font-bold">View</label>
              <ToggleGroup value={mode} onChange={setMode} options={[{ value: "monthly", label: "Monthly" }, { value: "cumulative", label: "Cumulative" }]} />
              {metricMeta.type === "stock" && mode === "cumulative" && (
                <p className="text-xs leading-5 text-slate-500">Ending stocks stay as point-in-time monthly values.</p>
              )}
            </section>

            <section className="grid gap-2">
              <label className="text-sm font-bold">Marketing years</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set())}>
                  Clear All
                </button>
                <button type="button" className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set(availableYears.slice(-5)))}>
                  Latest 5
                </button>
              </div>
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto text-sm">
                {displayYears.map((year) => (
                  <label key={year} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedYears.has(year)}
                      onChange={(event) => {
                        const next = new Set(selectedYears);
                        event.target.checked ? next.add(year) : next.delete(year);
                        setSelectedYears(next);
                      }}
                    />
                    {year}
                  </label>
                ))}
              </div>
            </section>

            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={showAverage} onChange={(event) => setShowAverage(event.target.checked)} />
              Show 5-year average
            </label>

            <p className="text-xs leading-5 text-slate-500">
              Marketing months: {data.months.join(", ")}. Data source: {latestPublication || "latest uploaded table"}.
            </p>
          </div>
        </aside>

        <section className="grid gap-5">
          <BalanceSheetChart
            months={data.months}
            series={series}
            average={average}
            selectedYears={selectedYears}
            allYears={availableYears}
            metricLabel={metricMeta.label}
            mode={mode}
            view={view}
            metricNote={metricNote}
          />
          <BalanceSheetTable
            months={data.months}
            series={series}
            metricLabel={metricMeta.label}
            metricType={metricMeta.type}
            mode={mode}
            view={view}
            metricNote={metricNote}
          />
        </section>
      </main>
    </div>
  );
}
