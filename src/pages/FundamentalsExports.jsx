import { useEffect, useMemo, useState } from "react";
import FundamentalsChart from "../components/FundamentalsChart";
import { averageColor, averageSeries, clampWeek, fmt, pctFmt, seriesFromRows, yearColor } from "./fundamentalsUtils";

function ToggleGroup({ value, onChange, options }) {
  return (
    <div className={`grid overflow-hidden rounded-md border border-slate-300`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
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

function titleCase(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupRows(rows) {
  const byYearWeek = new Map();
  for (const row of rows) {
    const key = `${row.marketingYear}|${row.weekNumber}`;
    if (!byYearWeek.has(key)) {
      byYearWeek.set(key, { marketingYear: row.marketingYear, weekNumber: row.weekNumber, weeklyTons: 0, cumulativeTons: 0 });
    }
    byYearWeek.get(key).weeklyTons += row.weeklyTons;
  }
  const normalised = [...byYearWeek.values()].sort((a, b) => a.marketingYear.localeCompare(b.marketingYear) || a.weekNumber - b.weekNumber);
  const cumulative = new Map();
  return normalised.map((row) => {
    cumulative.set(row.marketingYear, (cumulative.get(row.marketingYear) || 0) + row.weeklyTons);
    return { ...row, cumulativeTons: cumulative.get(row.marketingYear) };
  });
}

function buildSeries(sourceRows, metric) {
  return seriesFromRows(groupRows(sourceRows), (row) => (metric === "cumulative" ? row.cumulativeTons : row.weeklyTons));
}

function entityTotals(rows) {
  const totals = new Map();
  for (const row of rows) {
    totals.set(row.entity, (totals.get(row.entity) || 0) + row.weeklyTons);
  }
  return [...totals.entries()]
    .map(([entity, tons]) => ({ entity, tons }))
    .sort((a, b) => b.tons - a.tons || a.entity.localeCompare(b.entity));
}

function annualTotals(rows) {
  const totals = new Map();
  for (const row of rows) {
    totals.set(row.marketingYear, (totals.get(row.marketingYear) || 0) + row.weeklyTons);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, tons]) => ({ year, tons }));
}

function pickDefaultEntity(rows, commodity, flow, breakdown) {
  return entityTotals(rows.filter((row) => row.commodity === commodity && row.flow === flow && row.breakdown === breakdown)).at(0)?.entity || "";
}

function pickDefaultFlow(rows, commodity, breakdown, preferredFlow = "") {
  const flows = [...new Set(rows.filter((row) => row.commodity === commodity && row.breakdown === breakdown).map((row) => row.flow))].sort();
  if (preferredFlow && flows.includes(preferredFlow)) return preferredFlow;
  const preferred = breakdown === "Port" ? ["Export per Harbour", "Import per Harbour"] : ["RSA Export", "Import for RSA"];
  return preferred.find((item) => flows.includes(item)) || flows[0] || "";
}

function AnnualBarChart({ values, years }) {
  const width = 760;
  const height = 210;
  const margin = { top: 18, right: 18, bottom: 38, left: 72 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const max = Math.max(1, ...values.map((item) => item.tons));
  const barW = values.length ? Math.max(10, Math.min(42, plotW / values.length - 12)) : 20;
  const x = (index) => margin.left + (values.length <= 1 ? plotW / 2 : (index / (values.length - 1)) * plotW);
  const y = (value) => margin.top + plotH - (value / max) * plotH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const value = max * ratio;
        return (
          <g key={ratio}>
            <line x1={margin.left} y1={y(value)} x2={width - margin.right} y2={y(value)} stroke="#e2e8f0" />
            <text x={margin.left - 10} y={y(value) + 4} textAnchor="end" fill="#64748b" fontSize="10">
              {fmt.format(value)}
            </text>
          </g>
        );
      })}
      <line x1={margin.left} y1={margin.top + plotH} x2={width - margin.right} y2={margin.top + plotH} stroke="#aeb8c4" />
      {values.map((item, index) => {
        const barH = margin.top + plotH - y(item.tons);
        return (
          <g key={item.year}>
            <rect
              x={x(index) - barW / 2}
              y={y(item.tons)}
              width={barW}
              height={Math.max(1, barH)}
              rx="3"
              fill={yearColor(item.year, years)}
              opacity="0.9"
            />
            <text x={x(index)} y={height - 12} textAnchor="middle" fill="#64748b" fontSize="10">
              {item.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function FundamentalsExports() {
  const [data, setData] = useState(null);
  const [commodity, setCommodity] = useState("");
  const [flow, setFlow] = useState("");
  const [breakdown, setBreakdown] = useState("Country");
  const [entities, setEntities] = useState(new Set());
  const [activeEntity, setActiveEntity] = useState("");
  const [metric, setMetric] = useState("cumulative");
  const [chartType, setChartType] = useState("line");
  const [selectedYears, setSelectedYears] = useState(new Set());
  const [weekStart, setWeekStart] = useState(1);
  const [weekEnd, setWeekEnd] = useState(52);
  const [showAverage, setShowAverage] = useState(true);

  useEffect(() => {
    fetch("/data/fundamentals/imports_exports.json")
      .then((response) => response.json())
      .then((payload) => {
        const defaultCommodity = payload.commodities.includes("White Maize") ? "White Maize" : payload.commodities[0];
        const defaultFlow = pickDefaultFlow(payload.rows, defaultCommodity, "Country", "RSA Export");
        const defaultEntity = pickDefaultEntity(payload.rows, defaultCommodity, defaultFlow, "Country");
        setData(payload);
        setCommodity(defaultCommodity);
        setFlow(defaultFlow);
        setEntities(defaultEntity ? new Set([defaultEntity]) : new Set());
        setActiveEntity(defaultEntity);
        setSelectedYears(new Set(payload.marketingYears.slice(-4)));
      });
  }, []);

  const flows = useMemo(() => {
    if (!data || !commodity) return [];
    return [...new Set(data.rows.filter((row) => row.commodity === commodity).map((row) => row.flow))].sort();
  }, [data, commodity]);

  const availableEntities = useMemo(() => {
    if (!data) return [];
    return entityTotals(data.rows.filter((row) => row.commodity === commodity && row.flow === flow && row.breakdown === breakdown));
  }, [data, commodity, flow, breakdown]);

  const selectedEntityList = [...entities];
  const selectionLabel = selectedEntityList.length
    ? selectedEntityList.length <= 3
      ? selectedEntityList.join(" + ")
      : `${selectedEntityList.length} selected ${breakdown.toLowerCase()}s`
    : `No ${breakdown.toLowerCase()} selected`;

  const filteredRows = useMemo(() => {
    if (!data || !entities.size) return [];
    return data.rows.filter(
      (row) =>
        row.commodity === commodity &&
        row.flow === flow &&
        row.breakdown === breakdown &&
        entities.has(row.entity) &&
        row.weekNumber >= weekStart &&
        row.weekNumber <= weekEnd
    );
  }, [data, commodity, flow, breakdown, entities, weekStart, weekEnd]);

  const allRowsForAverage = useMemo(() => {
    if (!data || !entities.size) return [];
    return data.rows.filter(
      (row) =>
        row.commodity === commodity &&
        row.flow === flow &&
        row.breakdown === breakdown &&
        entities.has(row.entity) &&
        row.weekNumber >= weekStart &&
        row.weekNumber <= weekEnd
    );
  }, [data, commodity, flow, breakdown, entities, weekStart, weekEnd]);

  const series = useMemo(() => buildSeries(filteredRows.filter((row) => selectedYears.has(row.marketingYear)), metric), [filteredRows, selectedYears, metric]);
  const average = useMemo(
    () => (data ? averageSeries(buildSeries(allRowsForAverage, metric), selectedYears, data.marketingYears, showAverage) : null),
    [data, allRowsForAverage, selectedYears, showAverage, metric]
  );

  const drilldownRows = useMemo(() => {
    if (!data || !activeEntity) return [];
    return data.rows.filter((row) => row.commodity === commodity && row.flow === flow && row.breakdown === breakdown && row.entity === activeEntity);
  }, [data, commodity, flow, breakdown, activeEntity]);

  const drilldownSeries = useMemo(
    () => buildSeries(drilldownRows.filter((row) => selectedYears.has(row.marketingYear) && row.weekNumber >= weekStart && row.weekNumber <= weekEnd), metric),
    [drilldownRows, selectedYears, metric, weekStart, weekEnd]
  );
  const drilldownAnnuals = useMemo(() => annualTotals(drilldownRows), [drilldownRows]);

  if (!data) return <div className="min-h-screen bg-slate-100 p-8 text-slate-700">Loading imports and exports data...</div>;

  const latest = series.at(-1);
  const referenceYear = [...selectedYears].sort().at(-1);
  const latestValue = latest?.values.at(-1)?.value ?? 0;
  const weeklyPeak = Math.max(0, ...series.flatMap((item) => item.values.map((point) => point.weekly)));
  const avgValue = average?.values.at(-1)?.value ?? 0;
  const variance = avgValue ? ((latestValue - avgValue) / avgValue) * 100 : null;
  const latestDrilldownTotal = drilldownAnnuals.at(-1)?.tons ?? 0;

  const setWeekInput = (setter, fallback) => (event) => {
    if (event.target.value === "") return;
    setter(clampWeek(event.target.value, fallback));
  };

  const resetEntityFor = (nextCommodity, nextFlow, nextBreakdown) => {
    const entity = pickDefaultEntity(data.rows, nextCommodity, nextFlow, nextBreakdown);
    setEntities(entity ? new Set([entity]) : new Set());
    setActiveEntity(entity);
  };

  const handleCommodityChange = (nextCommodity) => {
    const nextFlow = pickDefaultFlow(data.rows, nextCommodity, breakdown, flow);
    setCommodity(nextCommodity);
    setFlow(nextFlow);
    resetEntityFor(nextCommodity, nextFlow, breakdown);
  };

  const handleFlowChange = (nextFlow) => {
    setFlow(nextFlow);
    resetEntityFor(commodity, nextFlow, breakdown);
  };

  const handleBreakdownChange = (nextBreakdown) => {
    const nextFlow = pickDefaultFlow(data.rows, commodity, nextBreakdown, flow);
    setBreakdown(nextBreakdown);
    setFlow(nextFlow);
    resetEntityFor(commodity, nextFlow, nextBreakdown);
  };

  const selectTopEntities = (count) => {
    const next = new Set(availableEntities.slice(0, count).map((item) => item.entity));
    setEntities(next);
    setActiveEntity([...next][0] || "");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <p className="text-xs font-bold uppercase text-slate-500">Fundamentals</p>
        <h1 className="text-3xl font-extrabold">Imports & Exports</h1>
      </div>

      <main className="grid grid-cols-[310px_minmax(0,1fr)] gap-6 p-6">
        <aside className="self-start rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-bold">
              Commodity
              <select value={commodity} onChange={(event) => handleCommodityChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal">
                {data.commodities.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold">
              Flow
              <select value={flow} onChange={(event) => handleFlowChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal">
                {flows.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <section className="grid gap-2">
              <label className="text-sm font-bold">Breakdown view</label>
              <ToggleGroup
                value={breakdown}
                onChange={handleBreakdownChange}
                options={[
                  { value: "Country", label: "Country" },
                  { value: "Port", label: "Port" },
                ]}
              />
            </section>

            <section className="grid gap-2">
              <label className="text-sm font-bold">{breakdown}</label>
              <div className="grid grid-cols-3 gap-2">
                <button className="rounded-md border border-slate-300 py-2 text-sm" onClick={() => setEntities(new Set())}>Clear</button>
                <button className="rounded-md border border-slate-300 py-2 text-sm" onClick={() => selectTopEntities(5)}>Top 5</button>
                <button className="rounded-md border border-slate-300 py-2 text-sm" onClick={() => selectTopEntities(availableEntities.length)}>All</button>
              </div>
              <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
                {availableEntities.map((item) => (
                  <div
                    key={item.entity}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveEntity(item.entity)}
                    onDoubleClick={() => {
                      setActiveEntity(item.entity);
                      setEntities(new Set([item.entity]));
                    }}
                    className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-100 px-2 py-2 text-xs last:border-b-0 ${
                      activeEntity === item.entity ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={entities.has(item.entity)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const next = new Set(entities);
                        event.target.checked ? next.add(item.entity) : next.delete(item.entity);
                        setEntities(next);
                        setActiveEntity(item.entity);
                      }}
                    />
                    <span className="truncate font-bold">{titleCase(item.entity)}</span>
                    <span className="text-slate-500">{fmt.format(item.tons)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">Click a {breakdown.toLowerCase()} for detail. Double-click to isolate it.</p>
            </section>

            <section className="grid gap-2">
              <label className="text-sm font-bold">Chart metric</label>
              <ToggleGroup value={metric} onChange={setMetric} options={[{ value: "cumulative", label: "Cumulative" }, { value: "weekly", label: "Weekly" }]} />
            </section>
            <section className="grid gap-2">
              <label className="text-sm font-bold">Chart type</label>
              <ToggleGroup value={chartType} onChange={setChartType} options={[{ value: "line", label: "Line" }, { value: "bar", label: "Bar" }]} />
            </section>

            <section className="grid gap-2">
              <label className="text-sm font-bold">Marketing years</label>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set())}>Clear All</button>
                <button className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set(data.marketingYears.slice(-4)))}>Latest 4</button>
              </div>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-auto text-sm">
                {data.marketingYears.map((year) => (
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

            <section className="grid gap-2">
              <label className="text-sm font-bold">Week range</label>
              <div className="grid grid-cols-2 gap-2">
                <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="1" max="52" value={weekStart} onChange={setWeekInput(setWeekStart, 1)} />
                <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="1" max="52" value={weekEnd} onChange={setWeekInput(setWeekEnd, 52)} />
              </div>
            </section>

            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={showAverage} onChange={(event) => setShowAverage(event.target.checked)} />
              Show 5-year average
            </label>
            <p className="text-xs text-slate-500">{average?.sourceYears?.length ? `Average uses ${average.sourceYears.join(", ")}.` : "Select a later year to calculate a prior 5-year average."}</p>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              ["Latest selected year", latest?.year ?? "-", `${fmt.format(latestValue)} tons`],
              ["Peak weekly volume", `${fmt.format(weeklyPeak)} tons`, `Weeks ${weekStart} to ${weekEnd}`],
              [breakdown, fmt.format(entities.size), selectionLabel],
              ["Vs 5-year average", variance === null ? "-" : `${pctFmt.format(variance)}%`, avgValue ? `${fmt.format(avgValue)} tons avg` : "No average available"],
            ].map(([label, value, sub]) => (
              <article key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60">
                <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-extrabold">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{sub}</p>
              </article>
            ))}
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">{commodity} | {flow} | {breakdown}</p>
                <h2 className="text-lg font-extrabold">{metric === "cumulative" ? "Cumulative seasonal pace" : "Weekly volumes"}: {selectionLabel}</h2>
              </div>
              <div className="flex flex-wrap justify-end gap-3 text-xs text-slate-500">
                {series.map((item) => <span key={item.year} className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: yearColor(item.year, data.marketingYears) }} />{item.year}</span>)}
                {average && <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: averageColor }} />5-year avg</span>}
              </div>
            </div>
            <FundamentalsChart
              series={series}
              average={average}
              years={data.marketingYears}
              chartType={chartType}
              valueKind="tons"
              weekStart={weekStart}
              weekEnd={weekEnd}
              calendarStartMonth={5}
              referenceYear={referenceYear}
              emptyText={`Select at least one ${breakdown.toLowerCase()} and marketing year`}
            />
          </section>

          <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
              <div className="mb-3">
                <p className="text-xs font-bold uppercase text-slate-500">{activeEntity ? `${breakdown} drilldown` : "Drilldown"}</p>
                <h2 className="text-lg font-extrabold">{activeEntity ? titleCase(activeEntity) : `Select a ${breakdown.toLowerCase()}`}</h2>
              </div>
              <AnnualBarChart values={drilldownAnnuals} years={data.marketingYears} />
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
              <p className="text-xs font-bold uppercase text-slate-500">Summary</p>
              <h2 className="mt-1 text-lg font-extrabold">{activeEntity ? titleCase(activeEntity) : "-"}</h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Commodity</dt>
                  <dd className="mt-1 font-bold">{commodity}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Flow</dt>
                  <dd className="mt-1 font-bold">{flow}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Latest annual total</dt>
                  <dd className="mt-1 text-2xl font-extrabold">{fmt.format(latestDrilldownTotal)} tons</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Years available</dt>
                  <dd className="mt-1 font-bold">{fmt.format(drilldownAnnuals.length)}</dd>
                </div>
              </dl>
            </article>
          </section>

          {activeEntity && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Selected {breakdown.toLowerCase()}</p>
                  <h2 className="text-lg font-extrabold">{metric === "cumulative" ? "Cumulative detail" : "Weekly detail"}: {titleCase(activeEntity)}</h2>
                </div>
              </div>
              <FundamentalsChart
                series={drilldownSeries}
                average={null}
                years={data.marketingYears}
                chartType={chartType}
                valueKind="tons"
                weekStart={weekStart}
                weekEnd={weekEnd}
                calendarStartMonth={5}
                referenceYear={referenceYear}
              />
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
