import { useEffect, useMemo, useState } from "react";
import { loadAllCSVData } from "../components/dataLoader";

const MAX_LEGS = 4;
const HEDGING_MONTHS = ["Mar", "May", "Jul", "Sep", "Dec"];
const COMMODITIES = ["Wheat", "Soybeans", "White Maize", "Yellow Maize", "Sunflower"];
const PROGRAMS = ["Long Term Charts", "History", "Calculator"];
const CURRENT_YEAR_COLOR = "#DC2626";
const YEAR_COLORS = ["#2563EB", "#059669", "#A16207", "#7C3AED", "#0891B2", "#EA580C", "#64748B", "#111827"];
const COMMODITY_CODES = {
  "White Maize": "WMAZ",
  "Yellow Maize": "YMAZ",
  Soybeans: "SOYB",
  Sunflower: "SUNS",
  Wheat: "WEAT",
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
  { quantity: 1, side: "long", commodity: "White Maize", contract: "Jul" },
  { quantity: 1, side: "short", commodity: "White Maize", contract: "Dec" },
  { quantity: 1, side: "long", commodity: "White Maize", contract: "Jul" },
  { quantity: 1, side: "long", commodity: "White Maize", contract: "Sep" },
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

function formatChartValue(value) {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorForYear(year, latestYear) {
  if (year === latestYear) return CURRENT_YEAR_COLOR;
  return YEAR_COLORS[Math.abs(Number(year)) % YEAR_COLORS.length];
}

function buildHoverLabelRows(rows, activeX, yScale, plotBounds) {
  const labelHeight = 20;
  const labelGap = 4;
  const plotLeft = plotBounds.left + 4;
  const plotRight = plotBounds.right - 4;
  const plotTop = plotBounds.top + 4;
  const plotBottom = plotBounds.bottom - 4;

  const measuredRows = rows.map((row) => {
    const text = `${row.label}: ${formatChartValue(row.value)}`;
    const width = Math.min(340, Math.max(132, text.length * 6.6 + 24));
    return {
      ...row,
      text,
      width,
      targetY: yScale(row.value),
    };
  });

  const maxWidth = Math.max(...measuredRows.map((row) => row.width), 112);
  const side = activeX + 12 + maxWidth > plotRight ? "left" : "right";
  const laidOutRows = measuredRows
    .map((row) => ({
      ...row,
      y: clamp(row.targetY - labelHeight / 2, plotTop, plotBottom - labelHeight),
    }))
    .sort((a, b) => a.y - b.y);

  for (let index = 1; index < laidOutRows.length; index += 1) {
    const previous = laidOutRows[index - 1];
    laidOutRows[index].y = Math.max(laidOutRows[index].y, previous.y + labelHeight + labelGap);
  }

  const overflow = laidOutRows.at(-1)?.y + labelHeight - plotBottom;
  if (overflow > 0) {
    laidOutRows.forEach((row) => {
      row.y -= overflow;
    });
  }

  const underflow = plotTop - (laidOutRows[0]?.y ?? plotTop);
  if (underflow > 0) {
    laidOutRows.forEach((row) => {
      row.y += underflow;
    });
  }

  return laidOutRows.map((row) => {
    const x = side === "left"
      ? clamp(activeX - 10 - row.width, plotLeft, plotRight - row.width)
      : clamp(activeX + 10, plotLeft, plotRight - row.width);

    return {
      ...row,
      x,
      connectorX: side === "left" ? x + row.width + 3 : x - 3,
      connectorY: row.y + labelHeight / 2,
    };
  });
}

function contractCode(leg, baseYear) {
  const commodity = COMMODITY_CODES[leg.commodity] || leg.commodity;
  const month = CONTRACT_MONTH_CODES[leg.contract] || leg.contract;
  return `${commodity}${month}${String(baseYear).slice(-2)}`;
}

function contractCodeWithoutYear(leg) {
  const commodity = COMMODITY_CODES[leg.commodity] || leg.commodity;
  const month = CONTRACT_MONTH_CODES[leg.contract] || leg.contract;
  return `${commodity}${month}`;
}

function signedLegCode(leg, includeYear = false, year = null) {
  const quantity = Number(leg.quantity) || 1;
  const code = includeYear ? contractCode(leg, year) : contractCodeWithoutYear(leg);
  const quantityPrefix = quantity === 1 ? "" : `${quantity}*`;
  const sign = leg.side === "short" ? "-" : "";
  return `${sign}${quantityPrefix}${code}`;
}

function contractLabelForYear(legs, numLegs, year) {
  return legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract)
    .map((leg, index) => {
      const label = signedLegCode(leg, true, year);
      if (index === 0) return label;
      return label.startsWith("-") ? label : `+${label}`;
    })
    .join(" ");
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
  return activeLegs
    .filter((leg) => leg.commodity && leg.contract)
    .map((leg, index) => {
      const label = signedLegCode(leg);
      if (index === 0) return label;
      return label.startsWith("-") ? label : `+${label}`;
    })
    .join(" ");
}

function tabTitle(program, config) {
  const prefix = program === "Long Term Charts" ? "long-term" : program.toLowerCase();
  return `${prefix}: ${titleForConfig(config)}`;
}

function saveStoredLayouts(layouts) {
  localStorage.setItem("seasonalChartsSavedAnalyses", JSON.stringify(layouts));
}

function availableYearsForChart(csvData, legs, numLegs) {
  if (!csvData) return [];

  const activeLegs = legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract && Number(leg.quantity) > 0);

  if (!activeLegs.length) return [];

  const yearSets = activeLegs.map((leg) => {
    const contracts = csvData[leg.commodity] ?? {};
    return new Set(
      Object.keys(contracts)
        .map((key) => {
          const [month, year] = key.split("-");
          return month === leg.contract ? Number(year) : null;
        })
        .filter(Number.isFinite)
    );
  });

  if (yearSets.some((set) => set.size === 0)) return [];

  return [...yearSets[0]]
    .filter((year) => yearSets.every((set) => set.has(year)))
    .sort((a, b) => b - a);
}

export default function SeasonalCharts() {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numLegs, setNumLegs] = useState(2);
  const [legs, setLegs] = useState(DEFAULT_LEGS);
  const [selectedYears, setSelectedYears] = useState([]);
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

  const availableYears = useMemo(
    () => availableYearsForChart(csvData, legs, numLegs),
    [csvData, legs, numLegs]
  );

  useEffect(() => {
    if (!availableYears.length) return;

    setSelectedYears((currentYears) => {
      const validYears = currentYears.filter((year) => availableYears.includes(year));
      return validYears.length ? validYears : availableYears.slice(0, 5);
    });
  }, [availableYears]);

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
                    {showLabels ? "Hide labels" : "Show labels"}
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
                <SeasonalChart chartData={chartData} selectedYears={selectedYears} showLabels={showLabels} legs={legs} numLegs={numLegs} latestYear={availableYears[0]} />
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

function SeasonalChart({ chartData, selectedYears, showLabels, legs, numLegs, latestYear }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursorX, setCursorX] = useState(null);
  const [cursorY, setCursorY] = useState(null);
  const [zoomRange, setZoomRange] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);

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

  const width = 1320;
  const height = 560;
  const margin = { top: 24, right: 10, bottom: 40, left: 58 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const sortedYears = [...selectedYears].sort((a, b) => b - a);
  const fullStart = 0;
  const fullEnd = chartData.length - 1;
  const visibleStart = Math.max(fullStart, Math.min(zoomRange?.start ?? fullStart, fullEnd));
  const visibleEnd = Math.max(visibleStart, Math.min(zoomRange?.end ?? fullEnd, fullEnd));
  const visibleData = chartData.slice(visibleStart, visibleEnd + 1);
  const activeVisibleIndex = Math.max(0, Math.min(activeIndex - visibleStart, visibleData.length - 1));
  const activePoint = visibleData[activeVisibleIndex] || visibleData.at(-1);
  const activeFullIndex = chartData.indexOf(activePoint);
  const allVisibleValues = visibleData.flatMap((point) => sortedYears.map((year) => point[`year${year}`])).filter(Number.isFinite);
  const domain = niceChartDomain(allVisibleValues);
  const yTicks = [];
  for (let value = domain.min; value <= domain.max + domain.step / 2; value += domain.step) yTicks.push(value);

  const x = (index) => {
    if (visibleData.length <= 1) return margin.left + plotW / 2;
    return margin.left + ((index - visibleStart) / Math.max(1, visibleEnd - visibleStart)) * plotW;
  };
  const y = (value) => margin.top + plotH - ((value - domain.min) / Math.max(1, domain.max - domain.min)) * plotH;
  const defaultCursorY = Math.max(margin.top, Math.min(height - margin.bottom, y(0)));
  const cursorLineY = cursorY ?? defaultCursorY;
  const cursorValue = domain.max - ((cursorLineY - margin.top) / plotH) * (domain.max - domain.min);
  const nearestIndexFromClientX = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (svgX - margin.left) / plotW));
    return Math.round(visibleStart + ratio * Math.max(1, visibleEnd - visibleStart));
  };
  const activeRows = sortedYears
    .map((year) => ({
      year,
      label: contractLabelForYear(legs, numLegs, year),
      color: colorForYear(year, latestYear),
      value: nearestValueForYear(chartData, activeFullIndex, year),
    }))
    .filter((row) => Number.isFinite(row.value));
  const activeX = x(activeFullIndex);
  const cursorLineX = cursorX ?? activeX;
  const xLabelCenter = Math.max(margin.left + 58, Math.min(width - margin.right - 58, cursorLineX));
  const xTicks = visibleData.filter((_, index) => {
    const targetTicks = Math.min(7, visibleData.length);
    const step = Math.max(1, Math.floor(visibleData.length / targetTicks));
    return index % step === 0 || index === visibleData.length - 1;
  });
  const labelRows = buildHoverLabelRows(activeRows, activeX, y, {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  });
  const dragLeft = dragStart == null || dragCurrent == null ? null : Math.min(x(dragStart), x(dragCurrent));
  const dragRight = dragStart == null || dragCurrent == null ? null : Math.max(x(dragStart), x(dragCurrent));

  return (
    <div className="h-full min-h-[520px] flex-1 rounded border border-slate-200 bg-white p-2 shadow-sm">
      <ChartLegend rows={activeRows} />
      <div className="relative h-[calc(100%-26px)] min-h-[500px]">
        {zoomRange && (
          <button
            type="button"
            onClick={() => setZoomRange(null)}
            className="absolute right-3 top-3 z-10 rounded bg-blue-600 px-3 py-1 text-[11px] font-extrabold text-white shadow hover:bg-blue-700"
          >
            Reset zoom
          </button>
        )}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full select-none"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const svgX = ((event.clientX - rect.left) / rect.width) * width;
            const svgY = ((event.clientY - rect.top) / rect.height) * height;
            const index = nearestIndexFromClientX(event);
            setActiveIndex(index);
            setCursorX(Math.max(margin.left, Math.min(width - margin.right, svgX)));
            setCursorY(Math.max(margin.top, Math.min(height - margin.bottom, svgY)));
            if (dragStart != null) setDragCurrent(index);
          }}
          onMouseDown={(event) => {
            const index = nearestIndexFromClientX(event);
            setDragStart(index);
            setDragCurrent(index);
          }}
          onMouseUp={() => {
            if (dragStart != null && dragCurrent != null && Math.abs(dragCurrent - dragStart) > 3) {
              setZoomRange({ start: Math.min(dragStart, dragCurrent), end: Math.max(dragStart, dragCurrent) });
              setActiveIndex(Math.min(dragStart, dragCurrent));
            }
            setDragStart(null);
            setDragCurrent(null);
          }}
        >
          <rect x={0} y={0} width={width} height={height} fill="#fff" />

          {yTicks.map((value) => (
            <g key={value}>
              <line x1={margin.left} y1={y(value)} x2={width - margin.right} y2={y(value)} stroke="#d1d5db" strokeWidth="1" />
              <text x={margin.left - 10} y={y(value) + 4} textAnchor="end" fill="#111827" fontSize="10">
                {formatChartValue(value)}
              </text>
            </g>
          ))}

          {xTicks.map((point) => (
            <g key={point.dateKey}>
              <line x1={x(chartData.indexOf(point))} y1={margin.top} x2={x(chartData.indexOf(point))} y2={height - margin.bottom} stroke="#d1d5db" strokeWidth="1" />
              <text x={x(chartData.indexOf(point))} y={height - 12} textAnchor="middle" fill="#111827" fontSize="10">
                {point.label}
              </text>
            </g>
          ))}

          <line x1={margin.left} y1={y(0)} x2={width - margin.right} y2={y(0)} stroke="#6b7280" strokeWidth="1" />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#94a3b8" strokeWidth="1" />
          <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#94a3b8" strokeWidth="1" />

          {sortedYears.map((year) => {
            const points = visibleData
              .map((point) => ({ point, value: point[`year${year}`], fullIndex: chartData.indexOf(point) }))
              .filter((point) => Number.isFinite(point.value))
              .map((point) => ({ x: x(point.fullIndex), y: y(point.value) }));
            if (points.length < 2) return null;
            return (
              <path
                key={year}
                d={pathFromPoints(points)}
                fill="none"
                stroke={colorForYear(year, latestYear)}
                strokeWidth={year === latestYear ? 2.4 : 1.2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          <line x1={cursorLineX} y1={margin.top} x2={cursorLineX} y2={height - margin.bottom} stroke="#6b7280" strokeDasharray="3 3" />
          <line x1={margin.left} y1={cursorLineY} x2={width - margin.right} y2={cursorLineY} stroke="#6b7280" strokeDasharray="3 3" />
          <g>
            <rect x={margin.left - 66} y={cursorLineY - 12} width="48" height="20" rx="2" fill="#020617" />
            <polygon points={`${margin.left - 18},${cursorLineY - 7} ${margin.left - 10},${cursorLineY} ${margin.left - 18},${cursorLineY + 7}`} fill="#020617" />
            <text x={margin.left - 42} y={cursorLineY + 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800">
              {formatChartValue(cursorValue)}
            </text>
          </g>
          <g>
            <rect x={xLabelCenter - 58} y={height - margin.bottom + 12} width="116" height="22" rx="2" fill="#020617" />
            <polygon points={`${cursorLineX - 5},${height - margin.bottom + 12} ${cursorLineX},${height - margin.bottom + 6} ${cursorLineX + 5},${height - margin.bottom + 12}`} fill="#020617" />
            <text x={xLabelCenter} y={height - margin.bottom + 27} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800">
              {activePoint?.label}
            </text>
          </g>

          {showLabels &&
            labelRows.map((row) => (
              <g key={row.year}>
                <line x1={activeX} y1={y(row.value)} x2={row.connectorX} y2={row.connectorY} stroke={row.color} strokeWidth="1" opacity="0.65" />
                <rect x={row.x} y={row.y} width={row.width} height="20" rx="3" fill={row.color} opacity="0.95" />
                <text x={row.x + 8} y={row.y + 14} fill="#fff" fontSize="10" fontWeight="800">
                  {row.text}
                </text>
              </g>
            ))}

          {dragLeft != null && dragRight != null && (
            <rect x={dragLeft} y={margin.top} width={Math.max(1, dragRight - dragLeft)} height={plotH} fill="#2563eb" opacity="0.14" />
          )}
        </svg>
      </div>
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

function niceChartDomain(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return { min: 0, max: 100, step: 20 };

  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    min -= 10;
    max += 10;
  }

  const span = max - min;
  const rawStep = span / 6;
  const power = Math.pow(10, Math.floor(Math.log10(Math.max(1, rawStep))));
  const fraction = rawStep / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * power;

  return {
    min: Math.floor(min / step) * step,
    max: Math.ceil(max / step) * step,
    step,
  };
}

function pathFromPoints(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

function ChartLegend({ rows }) {
  return (
    <div className="mb-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-b border-slate-100 pb-1 text-[11px] font-bold text-slate-600">
      {rows.map((row) => (
        <div key={row.year} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: row.color }} />
          <span>{row.label}: {formatChartValue(row.value)}</span>
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
