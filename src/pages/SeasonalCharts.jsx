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
  Brush,
} from "recharts";
import { loadAllCSVData } from "../components/dataLoader";

const MAX_LEGS = 4;
const HEDGING_MONTHS = ["Mar", "May", "Jul", "Sep", "Dec"];
const COMMODITIES = ["Wheat", "Soybeans", "White Maize", "Yellow Maize", "Sunflower"];
const PROGRAMS = ["Long Term Charts", "History", "Calculator"];
const LINE_COLORS = ["#111827", "#2563EB", "#059669", "#DC2626", "#A16207", "#7C3AED", "#0891B2", "#EA580C"];
const COMMODITY_CODES = {
  "White Maize": "WM",
  "Yellow Maize": "YM",
  Soybeans: "SB",
  Sunflower: "FH",
  Wheat: "WEA",
};
const CONTRACT_MONTH_CODES = {
  Mar: "H",
  May: "K",
  Jul: "N",
  Sep: "U",
  Dec: "Z",
};
const UNIT_MOVES = {
  "White Maize": 100,
  "Yellow Maize": 100,
  Soybeans: 100,
  Sunflower: 50,
  Wheat: 50,
};
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

function contractCode(leg, baseYear) {
  const commodity = COMMODITY_CODES[leg.commodity] || leg.commodity;
  const month = CONTRACT_MONTH_CODES[leg.contract] || leg.contract;
  return `${commodity}${month}${String(baseYear).slice(-2)}`;
}

function contractLabelForYear(legs, numLegs, year) {
  return legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract)
    .map((leg) => contractCode(leg, year))
    .join(" - ");
}

function buildConfig({ numLegs, legs, selectedYears, showLabels }) {
  return {
    numLegs,
    legs,
    selectedYears,
    showLabels,
  };
}

function titleForConfig(config) {
  const activeLegs = config.legs.slice(0, config.numLegs);
  if (activeLegs.length === 1) {
    const leg = activeLegs[0];
    return `${leg.contract} ${leg.commodity}`;
  }
  return activeLegs.map((leg) => `${leg.side === "short" ? "-" : ""}${leg.contract} ${leg.commodity}`).join(" / ");
}

function tabTitle(program, config) {
  const prefix = program === "Long Term Charts" ? "long-term" : program.toLowerCase();
  return `${prefix}: ${titleForConfig(config)}`;
}

function saveStoredLayouts(layouts) {
  localStorage.setItem("seasonalChartsSavedAnalyses", JSON.stringify(layouts));
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
  const [saveName, setSaveName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [program, setProgram] = useState("Long Term Charts");
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);

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
          setSelectedYears(years.slice(0, 5));
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
      if (saved) setSavedAnalyses(JSON.parse(saved));
    } catch (err) {
      console.error("Error loading saved analyses:", err);
    }
  }, []);

  const currentConfig = useMemo(
    () => buildConfig({ numLegs, legs, selectedYears, showLabels }),
    [numLegs, legs, selectedYears, showLabels]
  );

  useEffect(() => {
    if (!activeTabId) return;
    setOpenTabs((tabs) =>
      tabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              program,
              title: tabTitle(program, currentConfig),
              config: currentConfig,
            }
          : tab
      )
    );
  }, [activeTabId, currentConfig, program]);

  useEffect(() => {
    if (activeTabId || !selectedYears.length) return;
    const id = Date.now().toString();
    setOpenTabs([
      {
        id,
        program,
        title: tabTitle(program, currentConfig),
        config: currentConfig,
      },
    ]);
    setActiveTabId(id);
  }, [activeTabId, currentConfig, program, selectedYears.length]);

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

  const applyConfig = (config) => {
    setNumLegs(Math.min(config.numLegs ?? MAX_LEGS, MAX_LEGS));
    setLegs(config.legs ?? DEFAULT_LEGS);
    setSelectedYears(config.selectedYears ?? []);
    setShowLabels(Boolean(config.showLabels));
  };

  const saveAnalysis = () => {
    const trimmed = saveName.trim();
    if (!trimmed) return;

    const newAnalysis = {
      id: Date.now().toString(),
      name: trimmed,
      timestamp: Date.now(),
      config: currentConfig,
    };

    const updated = [newAnalysis, ...savedAnalyses];
    setSavedAnalyses(updated);
    saveStoredLayouts(updated);
    setSaveName("");
  };

  const loadAnalysis = (analysisId) => {
    const analysis = savedAnalyses.find((item) => item.id === analysisId);
    if (!analysis) return;
    applyConfig(analysis.config);
    addTab(analysis.name, analysis.config, program);
  };

  const renameAnalysis = (analysisId) => {
    const analysis = savedAnalyses.find((item) => item.id === analysisId);
    if (!analysis) return;
    const nextName = prompt("Rename saved layout:", analysis.name);
    if (!nextName?.trim()) return;
    const updated = savedAnalyses.map((item) =>
      item.id === analysisId ? { ...item, name: nextName.trim() } : item
    );
    setSavedAnalyses(updated);
    saveStoredLayouts(updated);
  };

  const deleteAnalysis = (analysisId) => {
    const updated = savedAnalyses.filter((item) => item.id !== analysisId);
    setSavedAnalyses(updated);
    saveStoredLayouts(updated);
  };

  const addTab = (name = null, config = currentConfig, tabProgram = program) => {
    const id = Date.now().toString();
    const nextTab = {
      id,
      program: tabProgram,
      title: name || tabTitle(tabProgram, config),
      config,
    };
    setOpenTabs((tabs) => [...tabs, nextTab]);
    setActiveTabId(id);
    setProgram(tabProgram);
    applyConfig(config);
  };

  const selectTab = (tab) => {
    setActiveTabId(tab.id);
    setProgram(tab.program);
    applyConfig(tab.config);
  };

  const closeTab = (tabId) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((tab) => tab.id !== tabId);
      if (tabId === activeTabId) {
        const replacement = next.at(-1);
        setActiveTabId(replacement?.id || null);
        if (replacement) {
          setProgram(replacement.program);
          applyConfig(replacement.config);
        }
      }
      return next;
    });
  };

  const closeAllTabs = () => {
    setOpenTabs([]);
    setActiveTabId(null);
  };

  const chooseProgram = (nextProgram) => {
    setProgram(nextProgram);
  };

  const setLatestYears = (count = 5) => {
    setSelectedYears(availableYears.slice(0, count));
  };

  const chartTitle = titleForConfig(currentConfig);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-900">
        <p>Loading seasonal charts data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-900">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex h-[calc(100vh-64px)] min-h-[720px] border-t border-slate-200 text-[12px]">
        <aside className={`${sidebarOpen ? "w-64" : "w-10"} shrink-0 border-r border-slate-300 bg-[#4f8db9] text-slate-950 transition-all`}>
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="flex h-9 w-full items-center justify-center border-b border-slate-300 bg-[#3f83b5] text-sm font-bold text-white"
            title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? "<" : ">"}
          </button>

          {sidebarOpen ? (
            <div className="flex h-[calc(100%-40px)] flex-col">
              <SidebarSection title="Saved Layouts">
                <div className="mb-3 rounded-md border border-slate-300 bg-white p-3 text-xs font-semibold leading-5 text-blue-700">
                  Save the current chart setup, then reopen it later from this list.
                </div>
                <div className="mb-3 flex gap-2">
                  <input
                    value={saveName}
                    onChange={(event) => setSaveName(event.target.value)}
                    placeholder="Name this layout"
                    className="h-8 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={saveAnalysis}
                    className="h-8 rounded bg-slate-950 px-3 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    Save
                  </button>
                </div>
                <div className="max-h-[430px] overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
                  {savedAnalyses.length === 0 ? (
                    <p className="px-2 py-3 text-xs font-semibold text-slate-500">No saved layouts yet.</p>
                  ) : (
                    savedAnalyses.map((analysis) => (
                      <div key={analysis.id} className="group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-slate-100">
                        <button
                          type="button"
                          onClick={() => loadAnalysis(analysis.id)}
                          className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-blue-700"
                          title={analysis.name}
                        >
                          {analysis.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => renameAnalysis(analysis.id)}
                          className="rounded px-1.5 text-xs font-bold text-slate-500 opacity-0 hover:bg-slate-200 group-hover:opacity-100"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAnalysis(analysis.id)}
                          className="rounded px-1.5 text-xs font-bold text-red-600 opacity-0 hover:bg-red-50 group-hover:opacity-100"
                        >
                          X
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </SidebarSection>
              <SidebarSection title="Program Description">
                <p className="text-sm font-semibold leading-5 text-slate-700">
                  Build seasonal futures and spread charts from up to four legs. The current calculation engine is unchanged.
                </p>
              </SidebarSection>
              <SidebarSection title="Settings">
                <p className="text-sm font-semibold leading-5 text-slate-700">
                  Workspace preferences will live here as the charting tools mature.
                </p>
              </SidebarSection>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 pt-4 text-white">
              <span className="text-lg font-black">i</span>
              <span className="text-lg font-black">S</span>
              <span className="text-lg font-black">G</span>
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 items-center gap-3 border-b border-slate-300 bg-[#0b4776] px-4 text-white">
            <span className="text-xs font-extrabold">Charting</span>
            <span className="text-slate-300">&gt;</span>
            <select
              value={program}
              onChange={(event) => chooseProgram(event.target.value)}
              className="h-8 rounded border border-blue-300 bg-[#083b63] px-3 text-xs font-extrabold text-white outline-none"
            >
              {PROGRAMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex h-9 items-end border-b border-slate-300 bg-white px-3">
            <button
              type="button"
              onClick={closeAllTabs}
              className="mr-2 h-9 px-3 text-[11px] font-bold text-slate-500 hover:text-slate-900"
            >
              close all tabs
            </button>
            <div className="flex min-w-0 flex-1 overflow-x-auto">
              {openTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab)}
                  className={`group flex h-9 min-w-40 max-w-60 items-center gap-2 border-x border-t px-3 text-[11px] font-extrabold ${
                    tab.id === activeTabId
                      ? "border-slate-300 bg-white text-slate-950"
                      : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-white"
                  }`}
                >
                  <span className="truncate">{tab.title}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        closeTab(tab.id);
                      }
                    }}
                    className="ml-auto rounded px-1 text-sm hover:bg-slate-200"
                  >
                    x
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => addTab()}
                className="h-9 px-4 text-[11px] font-bold text-blue-700 hover:bg-slate-100"
              >
                + add tab
              </button>
            </div>
          </div>

          <div className="border-b border-slate-300 bg-white p-2">
            <div className="flex flex-wrap items-start gap-3">
              <LegBuilder numLegs={numLegs} setNumLegs={setNumLegs} legs={legs} updateLeg={updateLeg} />

              <div className="rounded border border-slate-300 bg-slate-50 p-2">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Controls</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLabels((visible) => !visible)}
                    className={`h-8 rounded border px-3 text-xs font-bold ${
                      showLabels
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Show labels
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedYears([])}
                    className="h-8 rounded border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setLatestYears(5)}
                    className="h-8 rounded border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Last 5
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-1.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{program}</p>
                <h1 className="text-sm font-extrabold text-slate-950">{chartTitle}</h1>
              </div>
              <div className="text-xs font-bold text-slate-500">
                {chartData.length ? `${chartData.length} seasonal points` : "No chart data"}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 gap-2 p-2">
              <YearSelectorRail
                availableYears={availableYears}
                selectedYears={selectedYears}
                setSelectedYears={setSelectedYears}
                legs={legs}
                numLegs={numLegs}
              />
              {program === "Long Term Charts" ? (
                <SeasonalChart chartData={chartData} selectedYears={selectedYears} showLabels={showLabels} legs={legs} numLegs={numLegs} />
              ) : (
                <ProgramPlaceholder program={program} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarSection({ title, children }) {
  return (
    <section className="border-b border-[#3f83b5] bg-[#c8d9ea] p-3">
      <h2 className="mb-2 text-sm font-extrabold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function LegBuilder({ numLegs, setNumLegs, legs, updateLeg }) {
  return (
    <div className="min-w-[560px] rounded border border-slate-400 bg-slate-100 p-1.5 text-slate-950">
      <div className="mb-1 flex items-center justify-between">
        <label className="flex items-center gap-2 text-[11px] font-extrabold">
          <span>legs:</span>
          <select
            value={numLegs}
            onChange={(event) => setNumLegs(Number(event.target.value))}
            className="h-7 rounded border border-slate-400 bg-white px-2 text-xs font-bold"
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] font-extrabold text-slate-500">symbols: new</span>
      </div>

      <div className="border border-slate-400 bg-white">
        {legs.slice(0, numLegs).map((leg, index) => {
          const colorClass = leg.side === "short" ? "text-red-600" : "text-blue-700";
          return (
            <div key={index} className="grid grid-cols-[56px_78px_minmax(180px,1fr)_72px_108px] border-b border-slate-300 last:border-b-0">
              <input
                type="number"
                min="1"
                value={leg.quantity}
                onChange={(event) => updateLeg(index, { quantity: Number(event.target.value) })}
                className={`h-8 border-r border-slate-300 px-2 text-right text-xs font-bold outline-none ${colorClass}`}
              />
              <select
                value={leg.side}
                onChange={(event) => updateLeg(index, { side: event.target.value })}
                className={`h-8 border-r border-slate-300 px-2 text-xs font-bold outline-none ${colorClass}`}
              >
                <option value="long">long</option>
                <option value="short">short</option>
              </select>
              <select
                value={leg.commodity}
                onChange={(event) => updateLeg(index, { commodity: event.target.value })}
                className={`h-8 border-r border-slate-300 px-2 text-xs font-bold outline-none ${colorClass}`}
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
                className={`h-8 border-r border-slate-300 px-2 text-xs font-bold outline-none ${colorClass}`}
              >
                {HEDGING_MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <div className="flex h-8 items-center px-2 text-[11px] font-bold text-blue-700">
                unit move: R{UNIT_MOVES[leg.commodity] || 50}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearSelectorRail({ availableYears, selectedYears, setSelectedYears, legs, numLegs }) {
  return (
    <div className="w-[132px] shrink-0 rounded border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-center text-[11px] font-extrabold uppercase text-slate-700">
        Selector
      </div>
      <div className="max-h-[calc(100vh-310px)] min-h-[520px] overflow-y-auto px-1.5 py-1">
        {availableYears.map((year) => (
          <button
            key={year}
            type="button"
            onClick={() => {
              setSelectedYears((current) =>
                current.includes(year)
                  ? current.filter((item) => item !== year)
                  : [...current, year].sort((a, b) => b - a)
              );
            }}
            className={`mb-0.5 block h-[22px] w-full truncate rounded-sm border px-1 text-[10px] font-bold leading-none ${
              selectedYears.includes(year)
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
            title={contractLabelForYear(legs, numLegs, year)}
          >
            {contractLabelForYear(legs, numLegs, year)}
          </button>
        ))}
      </div>
    </div>
  );
}

function SeasonalChart({ chartData, selectedYears, showLabels, legs, numLegs }) {
  if (chartData.length === 0) {
    return (
      <div className="flex h-full min-h-[440px] flex-1 items-center justify-center rounded border border-dashed border-slate-300 bg-white text-center text-slate-500">
        <div>
          <p className="mb-2 text-lg font-extrabold">No chart data</p>
          <p className="text-sm font-semibold">Select at least one year and make sure the chosen legs share matching dates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[520px] flex-1 rounded border border-slate-200 bg-white p-2 shadow-sm">
      <ChartLegend selectedYears={selectedYears} legs={legs} numLegs={numLegs} />
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 18, bottom: 16, left: 12 }}>
          <CartesianGrid stroke="#CCD6E2" strokeDasharray="2 2" />
          <XAxis dataKey="label" stroke="#64748B" tick={{ fontSize: 10 }} minTickGap={24} />
          <YAxis
            stroke="#64748B"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => formatCurrency(value)}
            width={92}
          />
          <Tooltip
            content={({ active, label, payload }) => (
              <NearestTooltip
                active={active}
                label={label}
                payload={payload}
                chartData={chartData}
                selectedYears={selectedYears}
                legs={legs}
                numLegs={numLegs}
              />
            )}
          />
          {[...selectedYears].sort((a, b) => b - a).map((year, index) => (
            <Line
              key={year}
              type="linear"
              dataKey={`year${year}`}
              name={`year${year}`}
              stroke={LINE_COLORS[index % LINE_COLORS.length]}
              strokeWidth={index === 0 ? 2 : 1.35}
              dot={false}
              connectNulls
              isAnimationActive={false}
            >
              {showLabels && (
                <LabelList
                  dataKey={`year${year}`}
                  position="top"
                  formatter={(value) => Math.round(value / 1000)}
                  style={{ fill: LINE_COLORS[index % LINE_COLORS.length], fontSize: 9, fontWeight: 800 }}
                />
              )}
            </Line>
          ))}
          <Brush
            dataKey="label"
            height={18}
            travellerWidth={8}
            stroke="#64748B"
            fill="#F8FAFC"
            tickFormatter={() => ""}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function nearestValueForYear(chartData, activeIndex, year) {
  const key = `year${year}`;
  const exact = chartData[activeIndex]?.[key];
  if (Number.isFinite(exact)) return exact;

  for (let distance = 1; distance < chartData.length; distance += 1) {
    const previous = chartData[activeIndex - distance]?.[key];
    const next = chartData[activeIndex + distance]?.[key];
    if (Number.isFinite(previous)) return previous;
    if (Number.isFinite(next)) return next;
  }

  return null;
}

function NearestTooltip({ active, label, chartData, selectedYears, legs, numLegs }) {
  if (!active || !label) return null;

  const activeIndex = chartData.findIndex((point) => point.label === label);
  if (activeIndex < 0) return null;

  const years = [...selectedYears].sort((a, b) => b - a);
  const rows = years
    .map((year, index) => ({
      year,
      label: contractLabelForYear(legs, numLegs, year),
      color: LINE_COLORS[index % LINE_COLORS.length],
      value: nearestValueForYear(chartData, activeIndex, year),
    }))
    .filter((row) => Number.isFinite(row.value));

  if (!rows.length) return null;

  return (
    <div className="rounded border border-slate-300 bg-white/95 px-3 py-2 text-[11px] shadow-xl">
      <div className="mb-1 font-extrabold text-slate-950">{label}</div>
      {rows.map((row) => (
        <div key={row.year} className="flex min-w-44 justify-between gap-4 py-0.5 font-bold" style={{ color: row.color }}>
          <span>{row.label}</span>
          <strong>{formatCurrency(row.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function ChartLegend({ selectedYears, legs, numLegs }) {
  return (
    <div className="mb-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-b border-slate-100 pb-1 text-[11px] font-bold text-slate-600">
      {[...selectedYears].sort((a, b) => b - a).map((year, index) => (
        <div key={year} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }} />
          <span>{contractLabelForYear(legs, numLegs, year)}</span>
        </div>
      ))}
    </div>
  );
}

function ProgramPlaceholder({ program }) {
  return (
    <div className="flex h-full min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-center">
      <div>
        <p className="mb-2 text-xl font-extrabold text-slate-950">{program}</p>
        <p className="max-w-md text-sm font-semibold leading-6 text-slate-500">
          The workspace switcher is in place. This program will use the same selected legs, years, saved layout, and period context when we build the next phase.
        </p>
      </div>
    </div>
  );
}
