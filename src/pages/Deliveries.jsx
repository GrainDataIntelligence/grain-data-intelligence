import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";

const BASE = import.meta.env.BASE_URL || "/";

const normalizeKeys = (row) => {
  const out = {};
  Object.keys(row || {}).forEach((k) => {
    const nk = String(k).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    out[nk] = row[k];
  });
  return out;
};

const num = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export default function Deliveries() {
  const [mode, setMode] = useState("% Delivered");
  const [dataState, setDataState] = useState({ loading: true, error: null });

  useEffect(() => {
    async function load() {
      try {
        const [delTxt, harvTxt] = await Promise.all([
          fetch(`${BASE}data/suns_deliveries.csv`).then((r) => r.text()),
          fetch(`${BASE}data/harvest_estimates_suns.csv`).then((r) => r.text()),
        ]);

        const deliveriesRaw = Papa.parse(delTxt, {
          header: true,
          dynamicTyping: false,
          skipEmptyLines: true,
        }).data.map(normalizeKeys);

        const harvestRaw = Papa.parse(harvTxt, {
          header: true,
          dynamicTyping: false,
          skipEmptyLines: true,
        }).data.map(normalizeKeys);

        const hByKey = new Map();
        for (const r of harvestRaw) {
          const commodity = (r.commodity || r.item || "").toString().trim().toLowerCase();
          const my_end = num(r.marketing_year_end_int ?? r.marketing_year_end ?? r.year_end);
          const est = num(r.crop_estimate_tons ?? r.crop_estimate ?? r.estimate_tons ?? r.value);
          if (!commodity || !Number.isFinite(my_end) || !Number.isFinite(est)) continue;
          hByKey.set(`${commodity}__${my_end}`, est);
        }

        const deliveriesClean = deliveriesRaw
          .map((r) => {
            const commodity = (r.commodity || "").toString().trim();
            const dateStr = r.date_week_ending ?? r.week_end ?? r.date;
            const my_end = num(r.marketing_year_end_int ?? r.marketing_year_end ?? r.my_end);
            const week_total = num(r.week_total ?? r.weekly_total ?? r.week);
            const dt = dateStr ? new Date(dateStr) : null;
            return {
              commodity,
              my_end,
              week_total,
              date: dt && !isNaN(dt.getTime()) ? dt : null,
            };
          })
          .filter(
            (r) =>
              r.date &&
              Number.isFinite(r.my_end) &&
              Number.isFinite(r.week_total) &&
              String(r.commodity).toLowerCase().includes("sun")
          );

        if (deliveriesClean.length === 0) {
          setDataState({
            loading: false,
            error:
              "No valid SUNS rows found. Check 'commodity' values and columns: date_week_ending, marketing_year_end_int, week_total.",
          });
          return;
        }

        for (const r of deliveriesClean) {
          const key = `${r.commodity.toLowerCase()}__${r.my_end}`;
          r.crop_estimate_tons = hByKey.get(key) || NaN;
        }

        const bySeason = {};
        for (const row of deliveriesClean) {
          if (!bySeason[row.my_end]) bySeason[row.my_end] = [];
          bySeason[row.my_end].push(row);
        }
        Object.values(bySeason).forEach((arr) => arr.sort((a, b) => a.date - b.date));

        const processed = {};
        for (const [yr, arr] of Object.entries(bySeason)) {
          const start = arr[0].date;
          let cum = 0;
          processed[yr] = arr.map((r) => {
            cum += r.week_total;
            const est = num(r.crop_estimate_tons);
            const pct =
              Number.isFinite(est) && est > 0 ? (cum / est) * 100 : NaN;
            return {
              year: Number(yr),
              days_since_start: Math.round((r.date - start) / 86400000),
              cumulative_tons: cum,
              pct_delivered: pct,
            };
          });
        }

        const years = Object.keys(processed).map(Number).sort((a, b) => a - b);
        if (!years.length) {
          setDataState({
            loading: false,
            error: "Parsed data empty after cleaning.",
          });
          return;
        }

        const recent = years.length >= 6 ? years.slice(-6, -1) : years.slice(0, -1);
        const avgMap = new Map();
        for (const y of recent) {
          for (const row of processed[y] || []) {
            const d = row.days_since_start;
            const agg = avgMap.get(d) || { pct_sum: 0, pct_n: 0, tons_sum: 0, tons_n: 0 };
            if (Number.isFinite(row.pct_delivered)) {
              agg.pct_sum += row.pct_delivered;
              agg.pct_n += 1;
            }
            if (Number.isFinite(row.cumulative_tons)) {
              agg.tons_sum += row.cumulative_tons;
              agg.tons_n += 1;
            }
            avgMap.set(d, agg);
          }
        }
        const avg = Array.from(avgMap.entries())
          .map(([d, a]) => ({
            days_since_start: d,
            pct_delivered: a.pct_n ? a.pct_sum / a.pct_n : NaN,
            cumulative_tons: a.tons_n ? a.tons_sum / a.tons_n : NaN,
          }))
          .sort((a, b) => a.days_since_start - b.days_since_start);

        setDataState({
          loading: false,
          processed,
          years,
          avg,
          latest: Math.max(...years),
        });
      } catch (err) {
        setDataState({ loading: false, error: err.message || String(err) });
      }
    }

    load();
  }, []);

  if (dataState.loading)
    return <div className="p-6 text-gray-400">Loading data...</div>;

  if (dataState.error)
    return (
      <div className="p-6 text-red-300">
        <h2 className="text-xl font-bold mb-2">⚠️ Data error</h2>
        <p className="text-sm mb-3">{dataState.error}</p>
        <p className="text-xs text-gray-400">
          Check your CSVs inside <code>public/data/</code> and confirm the column
          names match.
        </p>
      </div>
    );

  const { processed, years, avg, latest } = dataState;
  if (!Array.isArray(years) || years.length === 0)
    return (
      <div className="p-6 text-red-300">
        ⚠️ No valid data found after processing — please verify CSV contents.
      </div>
    );

  const colors = ["#9CA3AF", "#4B5563", "#16A34A", "#65A30D", "#00A651"];
  const traces = [];

  years.slice(-5).forEach((y, i) => {
    const arr = processed[y] || [];
    traces.push({
      x: arr.map((r) => r.days_since_start),
      y: mode === "% Delivered" ? arr.map((r) => r.pct_delivered) : arr.map((r) => r.cumulative_tons),
      type: "scatter",
      mode: "lines",
      name: String(y),
      line: {
        width: y === latest ? 4 : 2.5,
        color: y === latest ? "#FFD700" : colors[i % colors.length],
      },
      connectgaps: true,
    });
  });

  traces.push({
    x: avg.map((r) => r.days_since_start),
    y: mode === "% Delivered" ? avg.map((r) => r.pct_delivered) : avg.map((r) => r.cumulative_tons),
    type: "scatter",
    mode: "lines",
    name: "5-Year Avg",
    line: { color: "#10B981", dash: "dot", width: 2 },
    connectgaps: true,
  });

  const layout = {
    title: `🌻 GDI | Sunflower Deliveries – ${mode}`,
    paper_bgcolor: "#111827",
    plot_bgcolor: "#111827",
    font: { color: "#E5E7EB", family: "Inter, sans-serif" },
    legend: { orientation: "h", y: -0.3 },
    xaxis: { title: "Days Since Season Start", gridcolor: "#374151" },
    yaxis: {
      title: mode === "% Delivered" ? "% Delivered" : "Cumulative Tons",
      gridcolor: "#374151",
    },
    margin: { t: 60, b: 60, l: 60, r: 30 },
  };

  return (
    <div className="p-6 text-gray-100">
      <h1 className="text-2xl font-bold text-yellow-400 mb-4">
        Deliveries Hub — Sunflower
      </h1>

      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setMode("% Delivered")}
          className={`px-3 py-1 rounded-md text-sm font-medium ${
            mode === "% Delivered"
              ? "bg-yellow-400 text-gray-900"
              : "bg-gray-800 text-gray-300 hover:text-yellow-400"
          }`}
        >
          % Delivered
        </button>
        <button
          onClick={() => setMode("Tons Delivered")}
          className={`px-3 py-1 rounded-md text-sm font-medium ${
            mode === "Tons Delivered"
              ? "bg-yellow-400 text-gray-900"
              : "bg-gray-800 text-gray-300 hover:text-yellow-400"
          }`}
        >
          Tons Delivered
        </button>
      </div>

      <Plot
        data={traces}
        layout={layout}
        useResizeHandler
        style={{ width: "100%", height: "80vh" }}
        config={{ displayModeBar: true, responsive: true }}
      />
    </div>
  );
}
