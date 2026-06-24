import { useEffect, useMemo, useState } from "react";
import { fmt, niceScale, yearColor } from "./fundamentalsUtils";

const shortDate = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short" });
const longDate = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric" });

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function marketingYearSortValue(year) {
  const [start] = String(year).split("/");
  const numeric = Number(start);
  if (!Number.isFinite(numeric)) return 0;
  return numeric < 50 ? 2000 + numeric : 1900 + numeric;
}

function sortMarketingYearsDesc(years) {
  return [...years].sort((a, b) => marketingYearSortValue(b) - marketingYearSortValue(a));
}

function marketingYearStartDate(marketingYear) {
  const startYear = Number(`20${String(marketingYear).slice(0, 2)}`);
  return new Date(startYear, 8, 1);
}

function marketingYearEndDate(marketingYear) {
  const start = marketingYearStartDate(marketingYear);
  return new Date(start.getFullYear() + 1, 7, 31);
}

function seasonDay(date) {
  const parsed = parseDate(date);
  const seasonYear = parsed.getMonth() >= 8 ? 2000 : 2001;
  const normalised = new Date(seasonYear, parsed.getMonth(), parsed.getDate());
  return Math.round((normalised - new Date(2000, 8, 1)) / 86400000);
}

function monthLabelDate(offset) {
  return new Date(2000, 8 + offset, 1);
}

function formatSigned(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmt.format(value)}`;
}

function niceDomain(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return { min: -10000, max: 10000, step: 5000 };

  const rawMin = Math.min(...finite, 0);
  const rawMax = Math.max(...finite, 0);
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

function netValue(row, metric) {
  return metric === "weeklyChange" ? row.managedMoneyNetChange : row.managedMoneyNet;
}

function metricLabel(metric) {
  return metric === "weeklyChange" ? "Weekly Change" : "Managed Money Net";
}

function cftcYearColor(year, years) {
  if (year === years[0]) return "#d62828";
  return yearColor(year, years);
}

function boxesOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

function ToggleGroup({ value, onChange, options }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-9 px-3 text-sm ${value === option.value ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function FundamentalsCftc() {
  const [data, setData] = useState(null);
  const [commodity, setCommodity] = useState("");
  const [view, setView] = useState("seasonal");
  const [metric, setMetric] = useState("net");
  const [selectedYears, setSelectedYears] = useState(new Set());
  const [showYearLabels, setShowYearLabels] = useState(true);

  useEffect(() => {
    fetch("/data/fundamentals/cftc.json")
      .then((response) => response.json())
      .then((payload) => {
        setData(payload);
        const first = payload.markets[0]?.name || "";
        setCommodity(first);
        const commodityYears = sortMarketingYearsDesc([...new Set(payload.rows.filter((row) => row.commodity === first).map((row) => row.marketingYear))]);
        setSelectedYears(new Set(commodityYears.slice(0, 5)));
      });
  }, []);

  const commodityRows = useMemo(() => {
    if (!data || !commodity) return [];
    const sorted = data.rows.filter((row) => row.commodity === commodity).sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((row, index) => {
      const previous = sorted[index - 1];
      return {
        ...row,
        managedMoneyNetChange: previous ? row.managedMoneyNet - previous.managedMoneyNet : 0,
        managedMoneyLongChange: previous ? row.managedMoneyLong - previous.managedMoneyLong : 0,
        managedMoneyShortChange: previous ? row.managedMoneyShort - previous.managedMoneyShort : 0,
      };
    });
  }, [data, commodity]);

  const availableYears = useMemo(() => sortMarketingYearsDesc([...new Set(commodityRows.map((row) => row.marketingYear))]), [commodityRows]);
  const latest = data?.latest?.[commodity];
  const latestRow = commodityRows.at(-1);
  const marketName = data?.markets?.find((market) => market.name === commodity)?.market || "";

  const handleCommodityChange = (nextCommodity) => {
    setCommodity(nextCommodity);
    if (!data) return;
    const years = sortMarketingYearsDesc([...new Set(data.rows.filter((row) => row.commodity === nextCommodity).map((row) => row.marketingYear))]);
    setSelectedYears(new Set(years.slice(0, 5)));
  };

  if (!data) return <div className="min-h-screen bg-slate-100 p-8 text-slate-700">Loading CFTC data...</div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <p className="text-xs font-bold uppercase text-slate-500">Fundamentals</p>
        <h1 className="text-3xl font-extrabold">CFTC Positions</h1>
      </div>

      <main className="grid grid-cols-[290px_minmax(0,1fr)] gap-6 p-6">
        <aside className="self-start rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-bold">
              Commodity
              <select
                value={commodity}
                onChange={(event) => handleCommodityChange(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              >
                {data.markets.map((market) => (
                  <option key={market.name}>{market.name}</option>
                ))}
              </select>
            </label>

            <section className="grid gap-2">
              <label className="text-sm font-bold">Chart view</label>
              <ToggleGroup value={view} onChange={setView} options={[{ value: "seasonal", label: "Seasonal" }, { value: "breakdown", label: "Breakdown" }]} />
            </section>

            {view === "seasonal" && (
              <section className="grid gap-2">
                <label className="text-sm font-bold">Metric</label>
                <ToggleGroup value={metric} onChange={setMetric} options={[{ value: "net", label: "Net" }, { value: "weeklyChange", label: "Weekly Change" }]} />
              </section>
            )}

            <section className="grid gap-2">
              <label className="text-sm font-bold">Marketing years</label>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set())}>Clear All</button>
                <button className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set(availableYears.slice(0, 5)))}>Latest 5</button>
              </div>
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-auto text-sm">
                {availableYears.map((year) => (
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

            <p className="text-xs leading-5 text-slate-500">
              Seasonal years run from 1 Sep to 31 Aug, matching the original CFTC chart engine.
            </p>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <SummaryCard label="Latest report" value={latest ? longDate.format(parseDate(latest.date)) : "-"} sub={marketName} />
            <SummaryCard label="Managed money net" value={latest ? formatSigned(latest.managedMoneyNet) : "-"} sub="Longs minus shorts" />
            <SummaryCard label="Net weekly change" value={latestRow ? formatSigned(latestRow.managedMoneyNetChange) : "-"} sub="From previous report" />
            <SummaryCard label="Long weekly change" value={latestRow ? formatSigned(latestRow.managedMoneyLongChange) : "-"} sub="Managed money longs" />
            <SummaryCard label="Short weekly change" value={latestRow ? formatSigned(latestRow.managedMoneyShortChange) : "-"} sub="Managed money shorts" />
            <SummaryCard label="Net percentile" value={latest ? `${latest.netPercentile.toFixed(1)}%` : "-"} sub="Full available history" />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">{marketName}</p>
                <h2 className="text-lg font-extrabold">
                  {view === "seasonal" ? `${metricLabel(metric)} seasonal position` : "Current marketing year positioning breakdown"}
                </h2>
              </div>
              {view === "seasonal" && (
                <div className="grid justify-items-end gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={showYearLabels}
                      onChange={(event) => setShowYearLabels(event.target.checked)}
                    />
                    Show year labels
                  </label>
                  <Legend years={availableYears} selectedYears={selectedYears} />
                </div>
              )}
              {view === "breakdown" && <BreakdownLegend />}
            </div>

            {view === "seasonal" ? (
              <SeasonalPositionChart rows={commodityRows} years={availableYears} selectedYears={selectedYears} showYearLabels={showYearLabels} metric={metric} />
            ) : (
              <BreakdownChart rows={commodityRows} latestYear={latest?.marketingYear} />
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>
    </article>
  );
}

function Legend({ years, selectedYears }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 text-xs text-slate-500">
      {years.filter((year) => selectedYears.has(year)).map((year) => (
        <span key={year} className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ background: cftcYearColor(year, years) }} />
          {year}
        </span>
      ))}
    </div>
  );
}

function BreakdownLegend() {
  return (
    <div className="flex flex-wrap justify-end gap-3 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-emerald-600" />Long</span>
      <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-600" />Short</span>
      <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-slate-950" />Net</span>
    </div>
  );
}

function SeasonalPositionChart({ rows, years, selectedYears, showYearLabels, metric }) {
  const [tooltip, setTooltip] = useState(null);
  const width = 1000;
  const height = 500;
  const margin = { top: 24, right: 36, bottom: 48, left: 92 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const activeYears = years.filter((year) => selectedYears.has(year));
  const activeRows = rows.filter((row) => selectedYears.has(row.marketingYear));
  const values = activeRows.map((row) => netValue(row, metric)).filter((value) => Number.isFinite(value));
  const scale = niceDomain(values);
  const maxSeasonDay = 364;
  const x = (date) => margin.left + (seasonDay(date) / maxSeasonDay) * plotW;
  const y = (value) => margin.top + plotH - ((value - scale.min) / (scale.max - scale.min)) * plotH;
  const grouped = activeYears.map((year) => ({ year, values: rows.filter((row) => row.marketingYear === year) }));
  const currentYear = years[0];
  const currentYearRows = rows.filter((row) => row.marketingYear === currentYear);
  const weeklySnapDays = (() => {
    const sourceRows = currentYearRows.length ? currentYearRows : activeRows;
    if (!sourceRows.length) return [];
    const days = sourceRows.map((row) => seasonDay(row.date)).sort((a, b) => a - b);
    const step = 7;
    for (let day = days.at(-1) + step; day <= maxSeasonDay; day += step) {
      days.push(day);
    }
    return days;
  })();
  const labelPlacements = (() => {
    const placed = [];
    const labelW = 42;
    const labelH = 18;
    const fractions = [0.28, 0.48, 0.68, 0.82, 0.16, 0.36, 0.58, 0.74];

    return grouped.map((item, seriesIndex) => {
      if (!item.values.length) return null;
      let best = null;

      for (const fraction of fractions) {
        const index = Math.min(item.values.length - 1, Math.max(0, Math.floor(item.values.length * fraction)));
        const point = item.values[index];
        const baseX = x(point.date);
        const baseY = y(netValue(point, metric));
        const offsets = [
          { x: 0, y: -12 },
          { x: 0, y: 16 },
          { x: labelW / 2 + 8, y: -2 },
          { x: -(labelW / 2 + 8), y: -2 },
        ];

        for (const offset of offsets) {
          const box = {
            x: baseX + offset.x - labelW / 2,
            y: baseY + offset.y - labelH / 2,
            w: labelW,
            h: labelH,
          };
          const inside =
            box.x >= margin.left + 4 &&
            box.x + box.w <= width - margin.right - 4 &&
            box.y >= margin.top + 4 &&
            box.y + box.h <= margin.top + plotH - 4;
          const overlaps = placed.some((existing) => boxesOverlap(box, existing.box));

          if (inside && !overlaps) {
            placed.push({ box, year: item.year });
            return { year: item.year, point, color: cftcYearColor(item.year, years), x: baseX + offset.x, y: baseY + offset.y };
          }

          if (!best && inside) {
            best = { year: item.year, point, color: cftcYearColor(item.year, years), x: baseX + offset.x, y: baseY + offset.y, box };
          }
        }
      }

      const fallback = best || (() => {
        const point = item.values[Math.min(item.values.length - 1, Math.floor(item.values.length * (0.2 + (seriesIndex % 5) * 0.14)))];
        const box = { x: x(point.date) - labelW / 2, y: y(netValue(point, metric)) - 20, w: labelW, h: labelH };
        return { year: item.year, point, color: cftcYearColor(item.year, years), x: x(point.date), y: y(netValue(point, metric)) - 12, box };
      })();

      placed.push({ box: fallback.box, year: item.year });
      return fallback;
    }).filter(Boolean);
  })();

  const selectedRowsForSeasonDay = (targetDay) =>
    activeYears
      .map((year) => {
        const yearRows = rows.filter((row) => row.marketingYear === year);
        const nearest = yearRows.reduce((best, row) => {
          const distance = Math.abs(seasonDay(row.date) - targetDay);
          return !best || distance < best.distance ? { row, distance } : best;
        }, null);
        return nearest?.distance <= 4 && Number.isFinite(netValue(nearest.row, metric)) ? nearest.row : null;
      })
      .filter(Boolean);

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const targetDay = Math.max(0, Math.min(maxSeasonDay, ((svgX - margin.left) / plotW) * maxSeasonDay));
    const nearestSnap = weeklySnapDays.reduce((best, day) => {
      const distance = Math.abs(day - targetDay);
      return !best || distance < best.distance ? { day, distance } : best;
    }, null);
    if (!nearestSnap) return;
    const snapDay = nearestSnap.day;
    const referenceDate = new Date(2000, 8, 1);
    referenceDate.setDate(referenceDate.getDate() + snapDay);
    setTooltip({
      rows: selectedRowsForSeasonDay(snapDay),
      xValue: margin.left + (snapDay / maxSeasonDay) * plotW,
      title: shortDate.format(referenceDate),
      x: Math.min(rect.width - 260, Math.max(12, event.clientX - rect.left + 14)),
      y: Math.max(12, event.clientY - rect.top - 20),
    });
  };

  if (!activeRows.length) return <EmptyChart text="Select at least one marketing year" />;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-h-[420px]" onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}>
        {Array.from({ length: Math.floor((scale.max - scale.min) / scale.step) + 1 }, (_, i) => scale.min + i * scale.step).map((value) => (
          <g key={value}>
            <line x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} stroke={value === 0 ? "#94A3B8" : "#E2E8F0"} />
            <text x={margin.left - 10} y={y(value) + 4} textAnchor="end" fill="#637083" fontSize="11">{formatSigned(value)}</text>
          </g>
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((offset) => {
          const date = monthLabelDate(offset);
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          return (
            <g key={offset}>
              <line x1={x(iso)} x2={x(iso)} y1={margin.top + plotH} y2={margin.top + plotH + 6} stroke="#CBD5E1" />
              <text x={x(iso)} y={height - 18} textAnchor="middle" fill="#637083" fontSize="11">{shortDate.format(date)}</text>
            </g>
          );
        })}
        <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="#aeb8c4" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="#aeb8c4" />
        {grouped.map((item) => {
          const isCurrent = item.year === years[0];
          const color = cftcYearColor(item.year, years);
          const path = item.values
            .filter((point) => Number.isFinite(netValue(point, metric)))
            .map((point, index) => `${index ? "L" : "M"} ${x(point.date)} ${y(netValue(point, metric))}`)
            .join(" ");
          return <path key={item.year} d={path} fill="none" stroke={color} strokeWidth={isCurrent ? 4.2 : 2.2} opacity={isCurrent ? 1 : 0.75} />;
        })}
        {showYearLabels && labelPlacements.map((placement) => {
          return (
            <text
              key={`${placement.year}-label`}
              x={placement.x}
              y={placement.y}
              fill={placement.color}
              fontSize="11"
              fontWeight="800"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="4"
              textAnchor="middle"
            >
              {placement.year}
            </text>
          );
        })}
        {tooltip && <line x1={tooltip.xValue} x2={tooltip.xValue} y1={margin.top} y2={margin.top + plotH} stroke="#2f3a4a" strokeDasharray="4 4" opacity="0.5" />}
      </svg>
      {tooltip && (
        <TooltipBox x={tooltip.x} y={tooltip.y} title={tooltip.title}>
          {tooltip.rows.map((row) => (
            <TooltipRow
              key={row.marketingYear}
              label={row.marketingYear}
              value={formatSigned(netValue(row, metric))}
              color={cftcYearColor(row.marketingYear, years)}
            />
          ))}
        </TooltipBox>
      )}
    </div>
  );
}

function BreakdownChart({ rows, latestYear }) {
  const [tooltip, setTooltip] = useState(null);
  const width = 1000;
  const height = 500;
  const margin = { top: 24, right: 36, bottom: 48, left: 92 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const activeRows = rows.filter((row) => row.marketingYear === latestYear);
  const start = marketingYearStartDate(latestYear);
  const end = marketingYearEndDate(latestYear);
  const values = activeRows.flatMap((row) => [row.managedMoneyLong, -row.managedMoneyShort, row.managedMoneyNet]);
  const scale = niceDomain(values);
  const x = (date) => margin.left + ((parseDate(date).getTime() - start.getTime()) / (end.getTime() - start.getTime())) * plotW;
  const y = (value) => margin.top + plotH - ((value - scale.min) / (scale.max - scale.min)) * plotH;

  const pathFor = (key, multiplier = 1) =>
    activeRows.map((point, index) => `${index ? "L" : "M"} ${x(point.date)} ${y(point[key] * multiplier)}`).join(" ");

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const time = start.getTime() + ((svgX - margin.left) / plotW) * (end.getTime() - start.getTime());
    const nearest = activeRows.reduce((best, row) => {
      const distance = Math.abs(parseDate(row.date).getTime() - time);
      return !best || distance < best.distance ? { row, distance } : best;
    }, null);
    if (!nearest) return;
    setTooltip({
      row: nearest.row,
      x: Math.min(rect.width - 260, Math.max(12, event.clientX - rect.left + 14)),
      y: Math.max(12, event.clientY - rect.top - 20),
    });
  };

  if (!activeRows.length) return <EmptyChart text="No breakdown data for the latest marketing year" />;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-h-[420px]" onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}>
        {Array.from({ length: Math.floor((scale.max - scale.min) / scale.step) + 1 }, (_, i) => scale.min + i * scale.step).map((value) => (
          <g key={value}>
            <line x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} stroke={value === 0 ? "#94A3B8" : "#E2E8F0"} />
            <text x={margin.left - 10} y={y(value) + 4} textAnchor="end" fill="#637083" fontSize="11">{formatSigned(value)}</text>
          </g>
        ))}
        {Array.from({ length: 12 }, (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1)).map((date) => {
          const iso = date.toISOString().slice(0, 10);
          return <text key={iso} x={x(iso)} y={height - 18} textAnchor="middle" fill="#637083" fontSize="11">{shortDate.format(date)}</text>;
        })}
        <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="#aeb8c4" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="#aeb8c4" />
        <path d={pathFor("managedMoneyLong")} fill="none" stroke="#16a34a" strokeWidth="2.2" />
        <path d={pathFor("managedMoneyShort", -1)} fill="none" stroke="#dc2626" strokeWidth="2.2" />
        <path d={pathFor("managedMoneyNet")} fill="none" stroke="#0f172a" strokeWidth="2.8" />
        {tooltip && <line x1={x(tooltip.row.date)} x2={x(tooltip.row.date)} y1={margin.top} y2={margin.top + plotH} stroke="#2f3a4a" strokeDasharray="4 4" opacity="0.5" />}
      </svg>
      {tooltip && (
        <TooltipBox x={tooltip.x} y={tooltip.y} title={longDate.format(parseDate(tooltip.row.date))}>
          <TooltipRow label="Long" value={fmt.format(tooltip.row.managedMoneyLong)} color="#15803d" />
          <TooltipRow label="Short" value={fmt.format(tooltip.row.managedMoneyShort)} color="#dc2626" />
          <TooltipRow label="Net" value={formatSigned(tooltip.row.managedMoneyNet)} color="#0f172a" />
        </TooltipBox>
      )}
    </div>
  );
}

function TooltipBox({ x, y, title, children }) {
  return (
    <div className="pointer-events-none absolute z-20 min-w-[210px] rounded-md border border-slate-300 bg-white/95 px-3 py-2 text-xs shadow-xl" style={{ left: x, top: y }}>
      <div className="mb-1 font-extrabold text-slate-900">{title}</div>
      {children}
    </div>
  );
}

function TooltipRow({ label, value, color }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 font-bold" style={{ color }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <svg viewBox="0 0 1000 500" className="w-full min-h-[420px]">
      <text x="500" y="250" textAnchor="middle" fill="#637083" fontSize="13">{text}</text>
    </svg>
  );
}
