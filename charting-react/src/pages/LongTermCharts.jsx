import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ---------- Helpers ----------
function parseISODate(s) {
  // expects YYYY-MM-DD
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatDateTick(iso) {
  const dt = parseISODate(iso);
  // e.g. "Jan 2024"
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function clampDateRange(data, fromISO) {
  const from = parseISODate(fromISO);
  return data.filter((d) => parseISODate(d.date) >= from);
}

function addSMA(data, windowSize, key = "value", outKey = `sma${windowSize}`) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const out = [];
  let sum = 0;
  const queue = [];

  for (let i = 0; i < data.length; i++) {
    const v = Number(data[i][key]);
    queue.push(v);
    sum += v;

    if (queue.length > windowSize) sum -= queue.shift();

    const sma = queue.length === windowSize ? sum / windowSize : null;
    out.push({ ...data[i], [outKey]: sma });
  }
  return out;
}

// ---------- Sample Data (replace later) ----------
function makeSampleSeries() {
  // ~12 years monthly points
  const start = new Date(2014, 0, 1);
  const points = [];
  let level = 2500;

  for (let i = 0; i < 12 * 12; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth() + i, 1);
    // simple random-ish walk with gentle trend
    level = Math.max(500, level + (Math.random() - 0.45) * 180 + 8);
    points.push({
      date: dt.toISOString().slice(0, 10),
      value: Math.round(level),
    });
  }
  return points;
}

// ---------- Main Page ----------
export default function LongTermChart() {
  const COMMODITIES = [
    { id: "WMAZ", name: "White Maize (SAFEX) – WMAZ" },
    { id: "YMAZ", name: "Yellow Maize (SAFEX) – YMAZ" },
    { id: "SUNS", name: "Sunflower (SAFEX) – SUNS" },
    { id: "CORN", name: "CBOT Corn (ZC)" },
    { id: "SOYB", name: "CBOT Soybeans (ZS)" },
    { id: "WHEAT", name: "CBOT Wheat (ZW)" },
  ];

  const RANGE_PRESETS = [
    { id: "1Y", label: "1Y", years: 1 },
    { id: "5Y", label: "5Y", years: 5 },
    { id: "10Y", label: "10Y", years: 10 },
    { id: "MAX", label: "Max", years: null },
  ];

  const [commodity, setCommodity] = useState(COMMODITIES[0].id);
  const [range, setRange] = useState("MAX");
  const [chartMode, setChartMode] = useState("line"); // "line" | "area"
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showSMA200, setShowSMA200] = useState(false);

  const [raw, setRaw] = useState([]);

  // Replace this with real loading later (CSV/JSON/API)
  useEffect(() => {
    // simulate commodity change by generating a new sample series
    const base = makeSampleSeries().map((d) => ({
      ...d,
      value:
        commodity === "SUNS"
          ? Math.round(d.value * 1.35)
          : commodity === "CORN"
          ? Math.round(d.value * 0.6)
          : d.value,
    }));
    setRaw(base);
  }, [commodity]);

  const processed = useMemo(() => {
    if (!raw?.length) return [];

    // Ensure sorted
    const sorted = [...raw].sort((a, b) => parseISODate(a.date) - parseISODate(b.date));

    // Apply range
    let ranged = sorted;
    const preset = RANGE_PRESETS.find((p) => p.id === range);
    if (preset?.years) {
      const latest = parseISODate(sorted[sorted.length - 1].date);
      const from = new Date(latest.getFullYear() - preset.years, latest.getMonth(), latest.getDate());
      const fromISO = from.toISOString().slice(0, 10);
      ranged = clampDateRange(sorted, fromISO);
    }

    // Add SMAs
    let withMA = ranged;
    if (showSMA20) withMA = addSMA(withMA, 20, "value", "sma20");
    if (showSMA50) withMA = addSMA(withMA, 50, "value", "sma50");
    if (showSMA200) withMA = addSMA(withMA, 200, "value", "sma200");

    return withMA;
  }, [raw, range, showSMA20, showSMA50, showSMA200]);

  const headerTitle = useMemo(() => {
    const found = COMMODITIES.find((c) => c.id === commodity);
    return found?.name ?? "Long Term Chart";
  }, [commodity]);

  const latestValue = processed.length ? processed[processed.length - 1].value : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Long Term Chart
            </h1>
            <p className="mt-1 text-slate-500">
              {headerTitle}
              {latestValue != null ? (
                <span className="ml-2 text-slate-600">
                  • Latest: <span className="font-semibold">{formatNumber(latestValue)}</span>
                </span>
              ) : null}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 md:justify-end">
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="rounded-md bg-white border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              {COMMODITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}
                </option>
              ))}
            </select>

            <div className="flex rounded-md border border-slate-300 bg-white p-1">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setRange(p.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    range === p.id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex rounded-md border border-slate-300 bg-white p-1">
              <button
                onClick={() => setChartMode("line")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  chartMode === "line" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Line
              </button>
              <button
                onClick={() => setChartMode("area")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  chartMode === "area" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Area
              </button>
            </div>
          </div>
        </div>

        {/* Overlay toggles */}
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={showSMA20}
              onChange={(e) => setShowSMA20(e.target.checked)}
              className="accent-slate-900"
            />
            SMA 20
          </label>
          <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={showSMA50}
              onChange={(e) => setShowSMA50(e.target.checked)}
              className="accent-slate-900"
            />
            SMA 50
          </label>
          <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={showSMA200}
              onChange={(e) => setShowSMA200(e.target.checked)}
              className="accent-slate-900"
            />
            SMA 200
          </label>
        </div>

        {/* Chart Card */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "area" ? (
                <AreaChart data={processed} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={30} />
                  <YAxis tickFormatter={formatNumber} width={70} />
                  <Tooltip
                    formatter={(v) => [formatNumber(v), "Price"]}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    strokeWidth={2}
                    fillOpacity={0.15}
                  />
                  {showSMA20 && <Line type="monotone" dataKey="sma20" strokeWidth={2} dot={false} />}
                  {showSMA50 && <Line type="monotone" dataKey="sma50" strokeWidth={2} dot={false} />}
                  {showSMA200 && <Line type="monotone" dataKey="sma200" strokeWidth={2} dot={false} />}
                </AreaChart>
              ) : (
                <LineChart data={processed} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={30} />
                  <YAxis tickFormatter={formatNumber} width={70} />
                  <Tooltip
                    formatter={(v) => [formatNumber(v), "Price"]}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} />
                  {showSMA20 && <Line type="monotone" dataKey="sma20" strokeWidth={2} dot={false} />}
                  {showSMA50 && <Line type="monotone" dataKey="sma50" strokeWidth={2} dot={false} />}
                  {showSMA200 && <Line type="monotone" dataKey="sma200" strokeWidth={2} dot={false} />}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Footer */}
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-slate-500">
            <div>
              Data points: <span className="text-slate-800">{processed.length}</span>
            </div>
            <div className="text-slate-500">
              * Currently using sample data. Next step: wire in your real SAFEX/CBOT dataset.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
