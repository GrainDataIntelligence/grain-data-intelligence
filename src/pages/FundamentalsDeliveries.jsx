import { useEffect, useMemo, useState } from "react";
import FundamentalsChart from "../components/FundamentalsChart";
import { averageColor, averageSeries, clampWeek, fmt, pctFmt, seriesFromRows, yearColor } from "./fundamentalsUtils";

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
  const [gradeCommodity, setGradeCommodity] = useState("White Maize");
  const [grade, setGrade] = useState("WM1");
  const [gradeMetric, setGradeMetric] = useState("cumulative");
  const [gradeSelectedYears, setGradeSelectedYears] = useState(new Set());

  useEffect(() => {
    fetch("/data/fundamentals/deliveries.json")
      .then((response) => response.json())
      .then((payload) => {
        setData(payload);
        setSelectedYears(new Set(payload.marketingYears.slice(-4)));
        setGradeSelectedYears(new Set(payload.marketingYears.slice(-4)));
      });
  }, []);

  const activeCommodity = deliveryType === "Maize" ? commodity : deliveryType;
  const activeMethodology = deliveryType === "Maize" ? methodology : "Standard";
  const calendarStartMonth = deliveryType === "Maize" && methodology === "SAGIS" ? 5 : 3;
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
  useEffect(() => {
    if (data && !gradeOptions.includes(grade)) setGrade(gradeOptions[0]);
  }, [data, gradeCommodity, gradeOptions, grade]);

  const gradeRows = useMemo(() => {
    if (!data || deliveryType !== "Maize") return [];
    return data.gradeRows.filter(
      (row) =>
        row.methodology === methodology &&
        row.commodity === gradeCommodity &&
        row.grade === grade &&
        row.weekNumber >= weekStart &&
        row.weekNumber <= weekEnd &&
        row.weekNumber <= 52
    );
  }, [data, deliveryType, methodology, gradeCommodity, grade, weekStart, weekEnd]);
  const valueForGrade = (row) => (gradeMetric === "percent" ? row.percentOfTotalDelivered : row.cumulativeTons);
  const gradeSeries = useMemo(() => seriesFromRows(gradeRows.filter((row) => gradeSelectedYears.has(row.marketingYear)), valueForGrade), [gradeRows, gradeSelectedYears, gradeMetric]);
  const gradeAverage = useMemo(() => (data ? averageSeries(seriesFromRows(gradeRows, valueForGrade), gradeSelectedYears, data.marketingYears, showAverage) : null), [data, gradeRows, gradeSelectedYears, showAverage, gradeMetric]);

  if (!data) return <div className="min-h-screen bg-slate-100 p-8 text-slate-700">Loading deliveries data...</div>;

  const latest = deliverySeries.at(-1);
  const referenceYear = [...selectedYears].sort().at(-1);
  const gradeReferenceYear = [...gradeSelectedYears].sort().at(-1);
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
          />
          {deliveryType === "Maize" && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Grade deliveries</p>
                  <h2 className="text-lg font-extrabold">{grade} {gradeMetric === "percent" ? "% of total delivered" : "cumulative deliveries"} | {methodology}</h2>
                </div>
                <div className="grid grid-cols-[140px_120px_150px] gap-2">
                  <select value={gradeCommodity} onChange={(event) => setGradeCommodity(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">{data.commodities.map((item) => <option key={item}>{item}</option>)}</select>
                  <select value={grade} onChange={(event) => setGrade(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">{gradeOptions.map((item) => <option key={item}>{item}</option>)}</select>
                  <ToggleGroup value={gradeMetric} onChange={setGradeMetric} options={[{ value: "cumulative", label: "Tons" }, { value: "percent", label: "%" }]} />
                </div>
              </div>
              <div className="mb-4">
                <YearChecks label="Grade marketing years" years={data.marketingYears} selectedYears={gradeSelectedYears} setSelectedYears={setGradeSelectedYears} compact />
              </div>
              <Legend series={gradeSeries} average={gradeAverage} years={data.marketingYears} />
              <FundamentalsChart
                series={gradeSeries}
                average={gradeAverage}
                years={data.marketingYears}
                chartType="line"
                valueKind={gradeMetric === "percent" ? "percent" : "tons"}
                weekStart={weekStart}
                weekEnd={weekEnd}
                calendarStartMonth={calendarStartMonth}
                referenceYear={gradeReferenceYear}
              />
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, sub }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></article>;
}

function Legend({ series, average, years }) {
  return <div className="mb-2 flex flex-wrap justify-end gap-3 text-xs text-slate-500">{series.map((item) => <span key={item.year} className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: yearColor(item.year, years) }} />{item.year}</span>)}{average && <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: averageColor }} />5-year avg</span>}</div>;
}

function ChartPanel({ title, eyebrow, series, average, years, chartType, valueKind, weekStart, weekEnd, calendarStartMonth, referenceYear }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60"><div className="mb-4 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-slate-500">{eyebrow}</p><h2 className="text-lg font-extrabold">{title}</h2></div><Legend series={series} average={average} years={years} /></div><FundamentalsChart series={series} average={average} years={years} chartType={chartType} valueKind={valueKind} weekStart={weekStart} weekEnd={weekEnd} calendarStartMonth={calendarStartMonth} referenceYear={referenceYear} /></section>;
}

function YearChecks({ label = "Marketing years", years, selectedYears, setSelectedYears, compact = false }) {
  return <section className="grid gap-2"><label className="text-sm font-bold">{label}</label><div className="grid grid-cols-2 gap-2"><button className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set())}>Clear All</button><button className="rounded-md border border-slate-300 py-2" onClick={() => setSelectedYears(new Set(years.slice(-4)))}>Latest 4</button></div><div className={`grid gap-2 overflow-auto text-sm ${compact ? "grid-cols-5 max-h-24" : "grid-cols-2 max-h-48"}`}>{years.map((year) => <label key={year} className="flex items-center gap-2"><input type="checkbox" checked={selectedYears.has(year)} onChange={(event) => { const next = new Set(selectedYears); event.target.checked ? next.add(year) : next.delete(year); setSelectedYears(next); }} />{year}</label>)}</div></section>;
}
