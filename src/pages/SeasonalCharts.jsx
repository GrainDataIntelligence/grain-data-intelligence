import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { loadAllCSVData } from "../components/dataLoader";

const MAX_LEGS = 4;
const HEDGING_MONTHS = ["Mar", "May", "Jul", "Sep", "Dec"];
const COMMODITIES = ["Wheat", "Soybeans", "White Maize", "Yellow Maize", "Sunflower"];
const LINE_COLORS = ["#4ECDC4", "#FFB703", "#FB7185", "#A78BFA", "#34D399", "#F97316"];
const CONTRACT_MONTH_NUMBERS = {
  Mar: 3,
  May: 5,
  Jul: 7,
  Sep: 9,
  Dec: 12,
};

const DEFAULT_LEGS = [
  { quantity: 2, side: "long", commodity: "Wheat", contract: "Mar" },
  { quantity: 1, side: "short", commodity: "Wheat", contract: "May" },
  { quantity: 1, side: "long", commodity: "Wheat", contract: "Jul" },
  { quantity: 1, side: "long", commodity: "Wheat", contract: "Sep" },
];

function parseDate(value) {
  const [year, month, day] = value.split(/[-/]/).map(Number);
  return new Date(year, month - 1, day);
}

function formatDayLabel(value) {
  const date = parseDate(value);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function dayKey(value) {
  const date = parseDate(value);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getSeasonEndMonth(legs) {
  return Math.min(...legs.map((leg) => CONTRACT_MONTH_NUMBERS[leg.contract]));
}

function getSeasonWindow(contractYear, endMonth) {
  const startMonth = endMonth === 12 ? 1 : endMonth + 1;
  const startYear = startMonth === 1 ? contractYear : contractYear - 1;

  return {
    start: new Date(startYear, startMonth - 1, 1),
    startMonth,
    end: new Date(contractYear, endMonth, 0),
  };
}

function getSeasonOrder(date, startMonth) {
  const month = date.getMonth() + 1;
  const monthOffset = (month - startMonth + 12) % 12;
  return monthOffset * 32 + date.getDate();
}

function isInWindow(date, start, end) {
  return date >= start && date <= end;
}

function buildSeasonalChartData(csvData, legs, numLegs, selectedYears) {
  if (!csvData || !selectedYears.length) return [];

  const activeLegs = legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract && Number(leg.quantity) > 0);

  if (!activeLegs.length) return [];

  const endMonth = getSeasonEndMonth(activeLegs);
  const pointsByDay = new Map();

  selectedYears.forEach((year) => {
    const { start, startMonth, end } = getSeasonWindow(year, endMonth);

    const rowsByLeg = activeLegs.map((leg) => {
      const contractRows = csvData[leg.commodity]?.[`${leg.contract}-${year}`] ?? [];
      const rowsByDate = new Map();

      contractRows.forEach((row) => {
        const date = row.date ? parseDate(row.date) : null;

        if (
          date &&
          !Number.isNaN(date.getTime()) &&
          Number.isFinite(row.price) &&
          isInWindow(date, start, end)
        ) {
          rowsByDate.set(dayKey(row.date), row);
        }
      });

      return rowsByDate;
    });

    const commonDays = [...rowsByLeg[0].keys()].filter((dateKey) =>
      rowsByLeg.every((rows) => rows.has(dateKey))
    );

    commonDays.forEach((dateKey) => {
      const value = activeLegs.reduce((sum, leg, index) => {
        const row = rowsByLeg[index].get(dateKey);
        const direction = leg.side === "short" ? 1 : -1;
        const quantity = Number(leg.quantity) || 0;

        return sum + row.price * quantity * direction;
      }, 0);

      if (!pointsByDay.has(dateKey)) {
        const sampleDate = rowsByLeg[0].get(dateKey).date;
        const parsedSampleDate = parseDate(sampleDate);

        pointsByDay.set(dateKey, {
          dateKey,
          label: formatDayLabel(sampleDate),
          order: getSeasonOrder(parsedSampleDate, startMonth),
        });
      }

      pointsByDay.get(dateKey)[`year${year}`] = Math.round(value);
    });
  });

  return [...pointsByDay.values()].sort((a, b) => a.order - b.order);
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "ZAR",
  }).format(value);
}

export default function SeasonalCharts() {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numLegs, setNumLegs] = useState(4);
  const [legs, setLegs] = useState(DEFAULT_LEGS);
  const [selectedYears, setSelectedYears] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [showLabels, setShowLabels] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await loadAllCSVData();
        setCsvData(data);
        setError(null);

        if (data?.Wheat && Object.keys(data.Wheat).length > 0) {
          const years = Object.keys(data.Wheat)
            .map((key) => parseInt(key.split("-")[1], 10))
            .filter((value, index, all) => all.indexOf(value) === index)
            .sort((a, b) => b - a);

          setAvailableYears(years);
          setSelectedYears(years.slice(0, 3));
        }
      } catch (err) {
        setError(`Failed to load data: ${err.message}`);
        console.error("Data loading error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("seasonalChartsSavedAnalyses");
      if (saved) {
        setSavedAnalyses(JSON.parse(saved));
      }
    } catch (err) {
      console.error("Error loading saved analyses:", err);
    }
  }, []);

  const chartData = useMemo(
    () => buildSeasonalChartData(csvData, legs, numLegs, selectedYears),
    [csvData, legs, numLegs, selectedYears]
  );

  const updateLeg = (index, updates) => {
    setLegs((currentLegs) =>
      currentLegs.map((leg, legIndex) =>
        legIndex === index ? { ...leg, ...updates } : leg
      )
    );
  };

  const saveAnalysis = (name) => {
    if (!name) return;

    const newAnalysis = {
      id: Date.now().toString(),
      name,
      timestamp: Date.now(),
      config: {
        numLegs,
        legs,
        selectedYears,
      },
    };

    const updated = [...savedAnalyses, newAnalysis];
    setSavedAnalyses(updated);
    localStorage.setItem("seasonalChartsSavedAnalyses", JSON.stringify(updated));
  };

  const loadAnalysis = (analysisId) => {
    const analysis = savedAnalyses.find((item) => item.id === analysisId);
    if (!analysis) return;

    setNumLegs(Math.min(analysis.config.numLegs ?? MAX_LEGS, MAX_LEGS));
    setLegs(analysis.config.legs ?? DEFAULT_LEGS);
    setSelectedYears(analysis.config.selectedYears ?? []);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center">
        <p>Loading seasonal charts data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex h-[calc(100vh-80px)]">
        <div className="w-56 bg-white border-r border-slate-200 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-4">Saved Analyses</h3>
          <div className="space-y-2 mb-4">
            {savedAnalyses.length === 0 ? (
              <div className="text-xs text-slate-500">No saved analyses</div>
            ) : (
              savedAnalyses.map((analysis) => (
                <button
                  key={analysis.id}
                  type="button"
                  onClick={() => loadAnalysis(analysis.id)}
                  className="w-full text-left text-xs bg-slate-100 hover:bg-slate-200 rounded px-2 py-2 text-slate-700"
                >
                  {analysis.name}
                </button>
              ))
            )}
          </div>

          <h3 className="text-sm font-semibold mb-4 mt-6">Aligner</h3>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {availableYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => {
                  if (selectedYears.includes(year)) {
                    setSelectedYears(selectedYears.filter((item) => item !== year));
                  } else {
                    setSelectedYears([...selectedYears, year].sort((a, b) => b - a));
                  }
                }}
                className={`p-2 rounded text-xs font-semibold ${
                  selectedYears.includes(year)
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-white border-b border-slate-200 p-2">
            <div className="flex items-end gap-2 overflow-x-auto">
              <div className="border border-gray-600 bg-gray-100 text-gray-950 rounded-sm p-1 min-w-[640px]">
                <div className="flex items-center gap-2 mb-1">
                  <label htmlFor="legs-count" className="text-xs font-semibold">
                    legs:
                  </label>
                  <select
                    id="legs-count"
                    value={numLegs}
                    onChange={(event) => setNumLegs(Number(event.target.value))}
                    className="h-8 rounded border border-gray-400 bg-white px-2 text-sm"
                  >
                    {[1, 2, 3, 4].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border border-gray-400">
                  {legs.slice(0, numLegs).map((leg, index) => {
                    const colorClass =
                      leg.side === "short" ? "text-red-600" : index === 3 ? "text-orange-500" : "text-cyan-700";

                    return (
                      <div
                        key={index}
                        className="grid grid-cols-[56px_72px_1fr_64px] border-b border-gray-400 last:border-b-0"
                      >
                        <input
                          type="number"
                          min="1"
                          value={leg.quantity}
                          onChange={(event) =>
                            updateLeg(index, { quantity: Number(event.target.value) })
                          }
                          className={`h-8 border-r border-gray-400 bg-white px-2 text-right text-sm ${colorClass}`}
                        />
                        <select
                          value={leg.side}
                          onChange={(event) => updateLeg(index, { side: event.target.value })}
                          className={`h-8 border-r border-gray-400 bg-white px-2 text-sm ${colorClass}`}
                        >
                          <option value="long">long</option>
                          <option value="short">short</option>
                        </select>
                        <select
                          value={leg.commodity}
                          onChange={(event) =>
                            updateLeg(index, { commodity: event.target.value })
                          }
                          className={`h-8 border-r border-gray-400 bg-white px-2 text-sm ${colorClass}`}
                        >
                          {COMMODITIES.map((commodity) => (
                            <option key={commodity} value={commodity}>
                              {commodity}
                            </option>
                          ))}
                        </select>
                        <select
                          value={leg.contract}
                          onChange={(event) => updateLeg(index, { contract: event.target.value })}
                          className={`h-8 border-r border-gray-400 bg-white px-2 text-sm ${colorClass}`}
                        >
                          {HEDGING_MONTHS.map((month) => (
                            <option key={month} value={month}>
                              {month}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border border-gray-600 bg-gray-100 rounded-sm p-1 flex items-center gap-1">
                <select className="h-9 min-w-28 rounded border border-gray-400 bg-white px-2 text-sm text-gray-950">
                  <option>aligned</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowLabels(!showLabels)}
                  className={`h-9 px-3 rounded border border-gray-500 text-sm font-semibold ${
                    showLabels
                      ? "bg-blue-700 text-white"
                      : "bg-gray-200 text-gray-950 hover:bg-gray-300"
                  }`}
                >
                  show labels
                </button>
                <button
                  type="button"
                  onClick={() => alert("Signals feature - coming soon")}
                  className="h-9 px-3 rounded border border-gray-500 bg-black text-white text-sm font-semibold"
                >
                  signals
                </button>
                <button
                  type="button"
                  onClick={() => saveAnalysis(prompt("Analysis name:"))}
                  className="h-9 px-3 rounded border border-orange-700 bg-orange-500 text-white text-sm font-semibold hover:bg-orange-400"
                >
                  save
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-100 p-4 min-h-0">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-slate-500">
                <div>
                  <p className="text-lg font-semibold mb-2">No chart data</p>
                  <p className="text-sm">
                    Select at least one year and make sure the chosen legs share matching dates.
                  </p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 24, right: 32, bottom: 12, left: 28 }}
                >
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748B"
                    tick={{ fontSize: 12 }}
                    minTickGap={28}
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatCurrency(value)}
                    width={92}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #CBD5E1",
                      borderRadius: 4,
                      color: "#0F172A",
                    }}
                    formatter={(value, name) => [
                      formatCurrency(value),
                      String(name).replace("year", ""),
                    ]}
                    labelStyle={{ color: "#0F172A" }}
                  />
                  {[...selectedYears].sort((a, b) => b - a).map((year, index) => (
                    <Line
                      key={year}
                      type="monotone"
                      dataKey={`year${year}`}
                      name={`year${year}`}
                      stroke={LINE_COLORS[index % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    >
                      {showLabels && (
                        <LabelList
                          dataKey={`year${year}`}
                          position="top"
                          formatter={(value) => Math.round(value / 1000)}
                          style={{ fill: LINE_COLORS[index % LINE_COLORS.length], fontSize: 10 }}
                        />
                      )}
                    </Line>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
