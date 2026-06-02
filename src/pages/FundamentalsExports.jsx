import { useEffect, useMemo, useState } from "react";
import FundamentalsChart from "../components/FundamentalsChart";
import { averageSeries, clampWeek, fmt, pctFmt, seriesFromRows, yearColor, averageColor } from "./fundamentalsUtils";

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

export default function FundamentalsExports() {
  const [data, setData] = useState(null);
  const [commodity, setCommodity] = useState("");
  const [destinations, setDestinations] = useState(new Set(["Total Exports"]));
  const [metric, setMetric] = useState("cumulative");
  const [chartType, setChartType] = useState("line");
  const [selectedYears, setSelectedYears] = useState(new Set());
  const [weekStart, setWeekStart] = useState(1);
  const [weekEnd, setWeekEnd] = useState(52);
  const [showAverage, setShowAverage] = useState(true);

  useEffect(() => {
    fetch("/data/fundamentals/exports.json")
      .then((response) => response.json())
      .then((payload) => {
        setData(payload);
        setCommodity(payload.commodities[0]);
        setSelectedYears(new Set(payload.marketingYears.slice(-4)));
      });
  }, []);

  const selectedDestinations = [...destinations];
  const destinationLabel = selectedDestinations.length
    ? selectedDestinations.length <= 3
      ? selectedDestinations.join(" + ")
      : `${selectedDestinations.length} selected destinations`
    : "No destinations selected";

  const rows = useMemo(() => {
    if (!data || !destinations.size) return [];
    return data.rows.filter(
      (row) =>
        row.commodity === commodity &&
        destinations.has(row.destination) &&
        row.weekNumber >= weekStart &&
        row.weekNumber <= weekEnd &&
        row.weekNumber <= 52
    );
  }, [data, commodity, destinations, weekStart, weekEnd]);

  const buildSeries = (sourceRows) => {
    const byYearWeek = new Map();
    for (const row of sourceRows) {
      const key = `${row.marketingYear}|${row.weekNumber}`;
      if (!byYearWeek.has(key)) {
        byYearWeek.set(key, { marketingYear: row.marketingYear, weekNumber: row.weekNumber, weeklyTons: 0 });
      }
      byYearWeek.get(key).weeklyTons += row.weeklyTons;
    }
    const normalised = [...byYearWeek.values()].sort((a, b) => a.marketingYear.localeCompare(b.marketingYear) || a.weekNumber - b.weekNumber);
    const cumulative = new Map();
    return seriesFromRows(normalised, (row) => {
      const key = row.marketingYear;
      cumulative.set(key, (cumulative.get(key) || 0) + row.weeklyTons);
      return metric === "cumulative" ? cumulative.get(key) : row.weeklyTons;
    });
  };

  const series = useMemo(() => buildSeries(rows.filter((row) => selectedYears.has(row.marketingYear))), [rows, selectedYears, metric]);
  const average = useMemo(() => (data ? averageSeries(buildSeries(rows), selectedYears, data.marketingYears, showAverage) : null), [data, rows, selectedYears, showAverage, metric]);

  if (!data) return <div className="min-h-screen bg-slate-100 p-8 text-slate-700">Loading exports data...</div>;

  const latest = series.at(-1);
  const referenceYear = [...selectedYears].sort().at(-1);
  const latestValue = latest?.values.at(-1)?.cumulative ?? 0;
  const weeklyPeak = Math.max(0, ...series.flatMap((item) => item.values.map((point) => point.weekly)));
  const avgValue = average?.values.at(-1)?.value ?? 0;
  const variance = avgValue ? ((latestValue - avgValue) / avgValue) * 100 : null;

  const setWeekInput = (setter, fallback) => (event) => {
    if (event.target.value === "") return;
    setter(clampWeek(event.target.value, fallback));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <p className="text-xs font-bold uppercase text-slate-500">Fundamentals</p>
        <h1 className="text-3xl font-extrabold">Imports & Exports</h1>
      </div>

      <main className="grid grid-cols-[290px_minmax(0,1fr)] gap-6 p-6">
        <aside className="self-start rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-bold">
              Commodity
              <select value={commodity} onChange={(event) => setCommodity(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal">
                {data.commodities.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <section className="grid gap-2">
              <label className="text-sm font-bold">Destination / group</label>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-md border border-slate-300 py-2" onClick={() => setDestinations(new Set())}>Clear</button>
                <button className="rounded-md border border-slate-300 py-2" onClick={() => setDestinations(new Set(["Total Exports"]))}>Total exports</button>
              </div>
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-auto pr-1 text-sm">
                {data.destinations.map((destination) => (
                  <label key={destination} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={destinations.has(destination)}
                      onChange={(event) => {
                        const next = new Set(destinations);
                        if (event.target.checked && destination === "Total Exports") {
                          setDestinations(new Set(["Total Exports"]));
                          return;
                        }
                        if (event.target.checked) {
                          next.delete("Total Exports");
                          next.add(destination);
                        } else {
                          next.delete(destination);
                        }
                        setDestinations(next);
                      }}
                    />
                    {destination}
                  </label>
                ))}
              </div>
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
              ["Peak weekly volume", `${fmt.format(weeklyPeak)} tons`, `${weekStart} to ${weekEnd}`],
              ["Destinations", fmt.format(destinations.size), destinationLabel],
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
                <p className="text-xs font-bold uppercase text-slate-500">{commodity} exports</p>
                <h2 className="text-lg font-extrabold">{metric === "cumulative" ? "Cumulative export pace" : "Weekly export volumes"}: {destinationLabel}</h2>
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
            />
          </section>
        </section>
      </main>
    </div>
  );
}
