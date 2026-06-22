import { useEffect, useMemo, useState } from "react";
import { loadAllCSVData } from "../components/dataLoader";

const MAX_LEGS = 4;
const HEDGING_MONTHS = ["Mar", "May", "Jul", "Sep", "Dec"];
const COMMODITIES = ["Wheat", "Soybeans", "White Maize", "Yellow Maize", "Sunflower"];
const PROGRAMS = ["Long Term Charts", "History", "Calculator"];
const CURRENT_YEAR_COLOR = "#DC2626";
const YEAR_COLORS = ["#2563EB", "#059669", "#A16207", "#7C3AED", "#0891B2", "#EA580C", "#64748B", "#111827"];
const COMMODITY_CODES = {
  Wheat: "WEA",
  Soybeans: "SB",
  Sunflower: "FH",
  "White Maize": "WM",
  "Yellow Maize": "YM",
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
  { quantity: 1, side: "long", commodity: "White Maize", contract: "Jul", alignOffset: 0 },
  { quantity: 1, side: "short", commodity: "White Maize", contract: "Dec", alignOffset: 0 },
  { quantity: 1, side: "long", commodity: "White Maize", contract: "Jul", alignOffset: 0 },
  { quantity: 1, side: "long", commodity: "White Maize", contract: "Sep", alignOffset: 0 },
];
const DEFAULT_PERIOD = {
  side: "sell",
  openDate: "2026-05-31",
  closeDate: "2026-10-14",
};

function parseDate(value) {
  const [year, month, day] = value.split(/[-/]/).map(Number);
  return new Date(year, month - 1, day);
}

function formatDayLabel(value) {
  const date = parseDate(value);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function formatFullDate(value) {
  if (!value) return "";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function getSeasonEndInfo(legs) {
  const endMonth = getSeasonEndMonth(legs);
  const endOffset = Math.max(
    ...legs
      .filter((leg) => CONTRACT_MONTH_NUMBERS[leg.contract] === endMonth)
      .map((leg) => Number(leg.alignOffset) || 0)
  );

  return { endMonth, endOffset };
}

function getAnchorSeasonInfo(legs) {
  const anchorLeg = legs[0];
  return {
    endMonth: CONTRACT_MONTH_NUMBERS[anchorLeg.contract],
    endOffset: Number(anchorLeg.alignOffset) || 0,
  };
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

function orderForDateValue(value, startMonth) {
  if (!value) return null;
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return null;
  return getSeasonOrder(date, startMonth);
}

function periodMarkers(period, startMonth, minOrder, maxOrder) {
  const openOrder = orderForDateValue(period?.openDate, startMonth);
  const closeOrder = orderForDateValue(period?.closeDate, startMonth);
  const isValid = openOrder != null && closeOrder != null;
  const isBuy = period?.side === "buy";
  const openColor = isBuy ? "#16A34A" : "#DC2626";
  const closeColor = isBuy ? "#DC2626" : "#16A34A";

  return {
    openOrder,
    closeOrder,
    startOrder: isValid ? Math.min(openOrder, closeOrder) : null,
    endOrder: isValid ? Math.max(openOrder, closeOrder) : null,
    isValid,
    openColor,
    closeColor,
    showOpen: isValid && openOrder >= minOrder && openOrder <= maxOrder,
    showClose: isValid && closeOrder >= minOrder && closeOrder <= maxOrder,
  };
}

function isInWindow(date, start, end) {
  return date >= start && date <= end;
}

function normalizeLegs(legs) {
  return legs.map((leg) => ({
    ...leg,
    alignOffset: Number.isFinite(Number(leg.alignOffset)) ? Number(leg.alignOffset) : 0,
  }));
}

function buildSeasonalChartData(csvData, legs, numLegs, selectedYears) {
  if (!csvData || !selectedYears.length) return [];

  const activeLegs = legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract && Number(leg.quantity) > 0);

  if (!activeLegs.length) return [];

  const { endMonth, endOffset } = getAnchorSeasonInfo(activeLegs);
  const pointsByDay = new Map();

  selectedYears.forEach((year) => {
    const { start, startMonth, end } = getSeasonWindow(year + endOffset, endMonth);

    const rowsByLeg = activeLegs.map((leg) => {
      const contractYear = year + (Number(leg.alignOffset) || 0);
      const contractRows = csvData[leg.commodity]?.[`${leg.contract}-${contractYear}`] ?? [];
      const rowsByDate = new Map();

      contractRows.forEach((row) => {
        const date = row.date ? parseDate(row.date) : null;

        if (
          date &&
          !Number.isNaN(date.getTime()) &&
          Number.isFinite(row.price) &&
          isInWindow(date, start, end)
        ) {
          rowsByDate.set(row.date, row);
        }
      });

      return rowsByDate;
    });

    const commonDates = [...rowsByLeg[0].keys()].filter((dateValue) =>
      rowsByLeg.every((rows) => rows.has(dateValue))
    );

    commonDates.forEach((dateValue) => {
      const dateKey = dayKey(dateValue);
      const value = activeLegs.reduce((sum, leg, index) => {
        const row = rowsByLeg[index].get(dateValue);
        const direction = leg.side === "short" ? 1 : -1;
        const quantity = Number(leg.quantity) || 0;

        return sum + row.price * quantity * direction;
      }, 0);

      if (!pointsByDay.has(dateKey)) {
        const sampleDate = rowsByLeg[0].get(dateValue).date;
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

function buildSpreadSeriesForYear(csvData, legs, numLegs, year) {
  if (!csvData || !Number.isFinite(year)) return [];

  const activeLegs = legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract && Number(leg.quantity) > 0);

  if (!activeLegs.length) return [];

  const rowsByLeg = activeLegs.map((leg) => {
    const contractYear = year + (Number(leg.alignOffset) || 0);
    const contractRows = csvData[leg.commodity]?.[`${leg.contract}-${contractYear}`] ?? [];
    const rowsByDate = new Map();

    contractRows.forEach((row) => {
      if (row.date && Number.isFinite(row.price)) rowsByDate.set(row.date, row);
    });

    return rowsByDate;
  });

  const commonDates = [...rowsByLeg[0].keys()]
    .filter((dateValue) => rowsByLeg.every((rows) => rows.has(dateValue)))
    .sort();

  return commonDates.map((dateValue) => {
    const value = activeLegs.reduce((sum, leg, index) => {
      const row = rowsByLeg[index].get(dateValue);
      const direction = leg.side === "short" ? 1 : -1;
      const quantity = Number(leg.quantity) || 0;

      return sum + row.price * quantity * direction;
    }, 0);
    const date = parseDate(dateValue);

    return {
      date: dateValue,
      timestamp: date.getTime(),
      label: formatDayLabel(dateValue),
      value: Math.round(value),
    };
  });
}

function dateValueFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function seasonalDateForYear(periodDateValue, year, legs, numLegs) {
  const activeLegs = legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract && Number(leg.quantity) > 0);
  if (!periodDateValue || !activeLegs.length || !Number.isFinite(year)) return null;

  const sourceDate = parseDate(periodDateValue);
  if (Number.isNaN(sourceDate.getTime())) return null;

  const { endMonth, endOffset } = getAnchorSeasonInfo(activeLegs);
  const window = getSeasonWindow(year + endOffset, endMonth);
  const month = sourceDate.getMonth() + 1;
  const day = sourceDate.getDate();
  const calendarYear = month >= window.startMonth ? window.start.getFullYear() : window.end.getFullYear();
  const target = new Date(calendarYear, month - 1, day);

  if (target < window.start || target > window.end) return null;
  return target;
}

function nearestSeriesPoint(series, targetDate) {
  if (!series.length || !targetDate) return null;
  const targetTime = targetDate.getTime();
  return series.reduce((best, point) => {
    const distance = Math.abs(point.timestamp - targetTime);
    if (!best || distance < best.distance) return { ...point, distance };
    return best;
  }, null);
}

function formatTableDate(value) {
  if (!value) return "";
  const date = typeof value === "string" ? parseDate(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatSignedNumber(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatSignedCurrency(value) {
  if (value == null || Number.isNaN(value)) return "";
  const prefix = value < 0 ? "-" : "";
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

function unitMoveForLegs(legs, numLegs) {
  return legs.slice(0, numLegs).reduce((sum, leg) => {
    const quantity = Number(leg.quantity) || 0;
    return sum + Math.abs(quantity) * (UNIT_MOVES[leg.commodity] || 50);
  }, 0);
}

function buildCalculatorRows(csvData, legs, numLegs, selectedYears, period) {
  if (!csvData || !selectedYears.length || !period?.openDate || !period?.closeDate) return [];

  const unitMove = unitMoveForLegs(legs, numLegs);
  const isBuy = period.side === "buy";

  return [...selectedYears]
    .sort((a, b) => b - a)
    .map((year) => {
      const series = buildSpreadSeriesForYear(csvData, legs, numLegs, year);
      const openTarget = seasonalDateForYear(period.openDate, year, legs, numLegs);
      const closeTarget = seasonalDateForYear(period.closeDate, year, legs, numLegs);
      const openPoint = nearestSeriesPoint(series, openTarget);
      const closePoint = nearestSeriesPoint(series, closeTarget);

      if (!series.length || !openPoint || !closePoint) {
        return {
          year,
          ticker: contractLabelForYear(legs, numLegs, year),
          hasData: false,
        };
      }

      const startTime = Math.min(openPoint.timestamp, closePoint.timestamp);
      const endTime = Math.max(openPoint.timestamp, closePoint.timestamp);
      const periodSeries = series.filter((point) => point.timestamp >= startTime && point.timestamp <= endTime);
      const change = isBuy ? closePoint.value - openPoint.value : openPoint.value - closePoint.value;
      const equityChange = change * unitMove;
      const days = Math.max(1, Math.round(Math.abs(closePoint.timestamp - openPoint.timestamp) / 86400000));

      const excursionRows = periodSeries.map((point) => {
        const rawPnl = isBuy ? point.value - openPoint.value : openPoint.value - point.value;
        return {
          ...point,
          equity: rawPnl * unitMove,
        };
      });
      const maxAdverse = excursionRows.reduce(
        (best, point) => (point.equity < best.equity ? point : best),
        excursionRows[0] || { equity: 0, date: openPoint.date }
      );
      const maxProfitable = excursionRows.reduce(
        (best, point) => (point.equity > best.equity ? point : best),
        excursionRows[0] || { equity: 0, date: openPoint.date }
      );

      return {
        year,
        ticker: contractLabelForYear(legs, numLegs, year),
        hasData: true,
        openDate: openPoint.date,
        openValue: openPoint.value,
        closeDate: closePoint.date,
        closeValue: closePoint.value,
        change,
        equityChange,
        days,
        avgProfitPerDay: equityChange / days,
        maxAdverseDate: maxAdverse.date,
        maxAdverseValue: maxAdverse.equity,
        maxProfitableDate: maxProfitable.date,
        maxProfitableValue: maxProfitable.equity,
      };
    });
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
  const contractYear = baseYear + (Number(leg.alignOffset) || 0);
  return `${commodity}${month}${String(contractYear).slice(-2)}`;
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

function buildConfig({ numLegs, legs, selectedYears, showLabels, period, chartsPerRow }) {
  return {
    numLegs,
    legs,
    selectedYears,
    showLabels,
    period,
    chartsPerRow,
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

function selectorRailWidth(numLegs) {
  return Math.min(260, Math.max(132, 74 + numLegs * 48));
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
    const offset = Number(leg.alignOffset) || 0;
    return new Set(
      Object.keys(contracts)
        .map((key) => {
          const [month, year] = key.split("-");
          return month === leg.contract ? Number(year) - offset : null;
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
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [periodPanelOpen, setPeriodPanelOpen] = useState(false);
  const [chartsPerRow, setChartsPerRow] = useState(2);
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
    () => buildConfig({ numLegs, legs, selectedYears, showLabels, period, chartsPerRow }),
    [numLegs, legs, selectedYears, showLabels, period, chartsPerRow]
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
    setLegs(normalizeLegs(config.legs ?? DEFAULT_LEGS));
    setSelectedYears(config.selectedYears ?? []);
    setShowLabels(Boolean(config.showLabels));
    setPeriod(config.period ?? DEFAULT_PERIOD);
    setChartsPerRow(config.chartsPerRow ?? 2);
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
              <PeriodControl
                period={period}
                setPeriod={setPeriod}
                panelOpen={periodPanelOpen}
                setPanelOpen={setPeriodPanelOpen}
              />

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
                  {program === "History" && (
                    <label className="flex h-8 items-center gap-2 rounded border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700">
                      <span>charts per row:</span>
                      <select
                        value={chartsPerRow}
                        onChange={(event) => setChartsPerRow(Number(event.target.value))}
                        className="h-6 rounded border border-slate-300 bg-white px-1 text-xs font-bold outline-none"
                      >
                        {[1, 2, 3].map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
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
              <div className="flex shrink-0 flex-col gap-2" style={{ width: selectorRailWidth(numLegs) }}>
                <AlignerPanel legs={legs} numLegs={numLegs} updateLeg={updateLeg} availableYears={availableYears} />
                <YearSelectorRail
                  availableYears={availableYears}
                  selectedYears={selectedYears}
                  setSelectedYears={setSelectedYears}
                  legs={legs}
                  numLegs={numLegs}
                />
              </div>
              {program === "Long Term Charts" ? (
                <SeasonalChart
                  chartData={chartData}
                  selectedYears={selectedYears}
                  showLabels={showLabels}
                  legs={legs}
                  numLegs={numLegs}
                  latestYear={availableYears[0]}
                  period={period}
                  periodVisible={periodPanelOpen}
                />
              ) : program === "History" ? (
                <HistoryView
                  csvData={csvData}
                  chartData={chartData}
                  selectedYears={selectedYears}
                  legs={legs}
                  numLegs={numLegs}
                  latestYear={availableYears[0]}
                  period={period}
                  periodVisible={periodPanelOpen}
                  chartsPerRow={chartsPerRow}
                />
              ) : program === "Calculator" ? (
                <CalculatorView
                  csvData={csvData}
                  selectedYears={selectedYears}
                  legs={legs}
                  numLegs={numLegs}
                  period={period}
                  periodVisible={periodPanelOpen}
                />
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

function PeriodControl({ period, setPeriod, panelOpen, setPanelOpen }) {
  const isSell = period.side === "sell";
  const openColor = isSell ? "text-red-600" : "text-green-700";
  const closeColor = isSell ? "text-green-700" : "text-red-600";

  const updatePeriod = (updates) => {
    setPeriod((current) => ({ ...current, ...updates }));
  };

  return (
    <div className="rounded border border-slate-400 bg-slate-100 p-1.5 text-slate-950">
      <div className="flex items-center gap-3 px-1 pb-1 text-[11px] font-bold">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="seasonal-period-side"
            checked={period.side === "buy"}
            onChange={() => updatePeriod({ side: "buy" })}
          />
          buy
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="seasonal-period-side"
            checked={period.side === "sell"}
            onChange={() => updatePeriod({ side: "sell" })}
          />
          sell
        </label>
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          className={`h-8 rounded border px-3 text-[11px] font-extrabold ${
            panelOpen
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-400 bg-slate-700 text-white hover:bg-slate-800"
          }`}
        >
          period
        </button>
      </div>

      {panelOpen && (
        <div className="rounded border border-yellow-600 bg-yellow-300 p-1.5 text-[11px] font-extrabold">
          <label className={`mb-1 flex items-center gap-2 ${openColor}`}>
            <span className="w-10 text-right">open:</span>
            <input
              type="date"
              value={period.openDate}
              onChange={(event) => updatePeriod({ openDate: event.target.value })}
              className="h-8 rounded border border-slate-400 bg-white px-2 text-[11px] font-bold text-slate-900"
            />
          </label>
          <label className={`flex items-center gap-2 ${closeColor}`}>
            <span className="w-10 text-right">close:</span>
            <input
              type="date"
              value={period.closeDate}
              onChange={(event) => updatePeriod({ closeDate: event.target.value })}
              className="h-8 rounded border border-slate-400 bg-white px-2 text-[11px] font-bold text-slate-900"
            />
          </label>
        </div>
      )}
    </div>
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
  const buttonTextSize = numLegs >= 4 ? "text-[9px]" : numLegs >= 3 ? "text-[9.5px]" : "text-[10px]";

  return (
    <div className="min-h-0 flex-1 rounded border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-center text-[11px] font-extrabold uppercase text-slate-700">
        Selector
      </div>
      <div className="max-h-[calc(100vh-430px)] min-h-[360px] overflow-y-auto px-1.5 py-1">
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
            className={`mb-0.5 block h-[22px] w-full truncate rounded-sm border px-1 ${buttonTextSize} font-bold leading-none ${
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

function AlignerPanel({ legs, numLegs, updateLeg, availableYears }) {
  const activeLegs = legs.slice(0, numLegs);
  const previewYear = availableYears[0] ?? new Date().getFullYear();

  return (
    <div className="rounded border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-slate-100 px-1 py-0.5 text-center text-[10px] font-extrabold text-slate-700">
        Aligner
      </div>
      <div
        className="grid gap-0.5 p-0.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, activeLegs.length)}, minmax(40px, 1fr))` }}
      >
        {activeLegs.map((leg, index) => {
          const color = colorForLeg(index);
          const offset = Number(leg.alignOffset) || 0;

          return (
            <div key={index} className="min-w-0 border-r border-slate-200 p-0.5 last:border-r-0">
              <div className="mb-0.5 flex items-center justify-center gap-0.5">
                <button
                  type="button"
                  onClick={() => updateLeg(index, { alignOffset: offset - 1 })}
                  className="h-5 w-5 rounded-sm border border-white text-[10px] font-black leading-none text-white shadow-sm"
                  style={{ backgroundColor: color }}
                  title="Shift this leg one contract year back"
                >
                  ^
                </button>
                <button
                  type="button"
                  onClick={() => updateLeg(index, { alignOffset: offset + 1 })}
                  className="h-5 w-5 rounded-sm border border-white text-[10px] font-black leading-none text-white shadow-sm"
                  style={{ backgroundColor: color }}
                  title="Shift this leg one contract year forward"
                >
                  v
                </button>
              </div>
              <div className="truncate text-center text-[9px] font-extrabold leading-3" style={{ color }} title={contractCode(leg, previewYear)}>
                {contractCode(leg, previewYear)}
              </div>
              <div className="text-center text-[8px] font-bold leading-3 text-slate-500">
                {offset === 0 ? ":" : offset > 0 ? `+${offset}` : offset}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function colorForLeg(index) {
  return ["#2563EB", "#DC2626", "#0F766E", "#7C3AED"][index] || "#111827";
}

function SeasonalChart({ chartData, selectedYears, showLabels, legs, numLegs, latestYear, period, periodVisible }) {
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
  const activeLegs = legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract && Number(leg.quantity) > 0);
  const seasonEndInfo = activeLegs.length ? getAnchorSeasonInfo(activeLegs) : { endMonth: 12, endOffset: 0 };
  const startMonth = activeLegs.length
    ? getSeasonWindow((latestYear || selectedYears[0]) + seasonEndInfo.endOffset, seasonEndInfo.endMonth).startMonth
    : 1;
  const visibleMinOrder = visibleData[0]?.order ?? 0;
  const visibleMaxOrder = visibleData.at(-1)?.order ?? 0;
  const periodMarker = periodMarkers(period, startMonth, visibleMinOrder, visibleMaxOrder);
  const periodIsValid = periodMarker.isValid && visibleData.length > 1;

  const x = (index) => {
    if (visibleData.length <= 1) return margin.left + plotW / 2;
    return margin.left + ((index - visibleStart) / Math.max(1, visibleEnd - visibleStart)) * plotW;
  };
  const xFromOrder = (order) => {
    const clampedOrder = clamp(order, visibleMinOrder, visibleMaxOrder);
    const ratio = (clampedOrder - visibleMinOrder) / Math.max(1, visibleMaxOrder - visibleMinOrder);
    return margin.left + ratio * plotW;
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
  const periodOverlapsVisible =
    periodVisible &&
    periodIsValid &&
    periodMarker.endOrder >= visibleMinOrder &&
    periodMarker.startOrder <= visibleMaxOrder;
  const periodLeft = periodOverlapsVisible ? xFromOrder(periodMarker.startOrder) : null;
  const periodRight = periodOverlapsVisible ? xFromOrder(periodMarker.endOrder) : null;
  const openX = periodOverlapsVisible && periodMarker.showOpen ? xFromOrder(periodMarker.openOrder) : null;
  const closeX = periodOverlapsVisible && periodMarker.showClose ? xFromOrder(periodMarker.closeOrder) : null;
  const openStroke = periodMarker.openColor;
  const closeStroke = periodMarker.closeColor;

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

          {periodOverlapsVisible && (
            <rect
              x={periodLeft}
              y={margin.top}
              width={Math.max(1, periodRight - periodLeft)}
              height={plotH}
              fill="#FDE68A"
              opacity="0.72"
            />
          )}

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

          {openX != null && (
            <g>
              <line x1={openX} y1={margin.top} x2={openX} y2={height - margin.bottom} stroke={openStroke} strokeWidth="2" />
              <text
                x={openX + 10}
                y={margin.top + plotH / 2}
                fill={openStroke}
                fontSize="10"
                fontWeight="800"
                transform={`rotate(-90 ${openX + 10} ${margin.top + plotH / 2})`}
              >
                open: {formatFullDate(period.openDate)}
              </text>
            </g>
          )}

          {closeX != null && (
            <g>
              <line x1={closeX} y1={margin.top} x2={closeX} y2={height - margin.bottom} stroke={closeStroke} strokeWidth="2" />
              <text
                x={closeX - 10}
                y={margin.top + plotH / 2}
                fill={closeStroke}
                fontSize="10"
                fontWeight="800"
                textAnchor="end"
                transform={`rotate(-90 ${closeX - 10} ${margin.top + plotH / 2})`}
              >
                close: {formatFullDate(period.closeDate)}
              </text>
            </g>
          )}

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

function HistoryView({ csvData, chartData, selectedYears, legs, numLegs, latestYear, period, periodVisible, chartsPerRow }) {
  const sortedYears = [...selectedYears].sort((a, b) => b - a);
  const referenceYear = sortedYears.includes(latestYear) ? latestYear : sortedYears[0];
  const comparisonYears = sortedYears.filter((year) => year !== referenceYear);

  if (!chartData.length || !referenceYear || !comparisonYears.length) {
    return (
      <div className="flex h-full min-h-[520px] flex-1 items-center justify-center rounded border border-dashed border-slate-300 bg-white text-center text-slate-500">
        <div>
          <p className="mb-2 text-lg font-extrabold">No history comparison yet</p>
          <p className="text-sm font-semibold">Select the current year plus at least one older year.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[520px] flex-1 overflow-y-auto rounded border border-slate-200 bg-white p-2 shadow-sm">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, chartsPerRow)}, minmax(0, 1fr))` }}
      >
        {comparisonYears.map((year) => (
          <HistoryMiniChart
            key={year}
            csvData={csvData}
            referenceYear={referenceYear}
            comparisonYear={year}
            legs={legs}
            numLegs={numLegs}
            latestYear={latestYear}
            period={period}
            periodVisible={periodVisible}
          />
        ))}
      </div>
    </div>
  );
}

function HistoryMiniChart({ csvData, referenceYear, comparisonYear, legs, numLegs, latestYear, period, periodVisible }) {
  const width = 640;
  const height = 280;
  const margin = { top: 26, right: 16, bottom: 28, left: 48 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const miniData = buildSeasonalChartData(csvData, legs, numLegs, [referenceYear, comparisonYear]);
  const referenceKey = `year${referenceYear}`;
  const comparisonKey = `year${comparisonYear}`;
  const values = miniData
    .flatMap((point) => [point[referenceKey], point[comparisonKey]])
    .filter(Number.isFinite);
  const domain = niceChartDomain(values);
  const yTicks = [];
  for (let value = domain.min; value <= domain.max + domain.step / 2; value += domain.step) yTicks.push(value);
  const x = (index) => {
    if (miniData.length <= 1) return margin.left + plotW / 2;
    return margin.left + (index / Math.max(1, miniData.length - 1)) * plotW;
  };
  const y = (value) => margin.top + plotH - ((value - domain.min) / Math.max(1, domain.max - domain.min)) * plotH;
  const activeLegs = legs
    .slice(0, numLegs)
    .filter((leg) => leg.commodity && leg.contract && Number(leg.quantity) > 0);
  const seasonEndInfo = activeLegs.length ? getAnchorSeasonInfo(activeLegs) : { endMonth: 12, endOffset: 0 };
  const startMonth = activeLegs.length
    ? getSeasonWindow((latestYear || referenceYear) + seasonEndInfo.endOffset, seasonEndInfo.endMonth).startMonth
    : 1;
  const xFromOrder = (order) => {
    const minOrder = miniData[0]?.order ?? 0;
    const maxOrder = miniData.at(-1)?.order ?? 0;
    const clampedOrder = clamp(order, minOrder, maxOrder);
    const ratio = (clampedOrder - minOrder) / Math.max(1, maxOrder - minOrder);
    return margin.left + ratio * plotW;
  };
  const minOrder = miniData[0]?.order ?? 0;
  const maxOrder = miniData.at(-1)?.order ?? 0;
  const periodMarker = periodMarkers(period, startMonth, minOrder, maxOrder);
  const periodOverlapsVisible =
    periodVisible &&
    periodMarker.isValid &&
    periodMarker.endOrder >= minOrder &&
    periodMarker.startOrder <= maxOrder;
  const periodLeft = periodOverlapsVisible ? xFromOrder(periodMarker.startOrder) : null;
  const periodRight = periodOverlapsVisible ? xFromOrder(periodMarker.endOrder) : null;
  const openStroke = periodMarker.openColor;
  const closeStroke = periodMarker.closeColor;
  const openX = periodOverlapsVisible && periodMarker.showOpen ? xFromOrder(periodMarker.openOrder) : null;
  const closeX = periodOverlapsVisible && periodMarker.showClose ? xFromOrder(periodMarker.closeOrder) : null;
  const referencePoints = miniData
    .map((point, index) => ({ x: x(index), y: y(point[referenceKey]), value: point[referenceKey] }))
    .filter((point) => Number.isFinite(point.value));
  const comparisonPoints = miniData
    .map((point, index) => ({ x: x(index), y: y(point[comparisonKey]), value: point[comparisonKey] }))
    .filter((point) => Number.isFinite(point.value));
  const xTicks = miniData.filter((_, index) => {
    const step = Math.max(1, Math.floor(miniData.length / 4));
    return index % step === 0 || index === miniData.length - 1;
  });
  const comparisonColor = colorForYear(comparisonYear, latestYear);

  return (
    <div className="rounded border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-2 py-1 text-center text-[11px] font-extrabold text-slate-950">
        {contractLabelForYear(legs, numLegs, comparisonYear)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-[280px] w-full">
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        {yTicks.map((value) => (
          <g key={value}>
            <line x1={margin.left} y1={y(value)} x2={width - margin.right} y2={y(value)} stroke="#d1d5db" strokeWidth="1" />
            <text x={margin.left - 8} y={y(value) + 3} textAnchor="end" fill="#111827" fontSize="9">
              {formatChartValue(value)}
            </text>
          </g>
        ))}
        {xTicks.map((point) => {
          const index = miniData.indexOf(point);
          return (
            <g key={point.dateKey}>
              <line x1={x(index)} y1={margin.top} x2={x(index)} y2={height - margin.bottom} stroke="#e5e7eb" strokeWidth="1" />
              <text x={x(index)} y={height - 9} textAnchor="middle" fill="#111827" fontSize="9">
                {point.label}
              </text>
            </g>
          );
        })}
        {periodOverlapsVisible && (
          <rect x={periodLeft} y={margin.top} width={Math.max(1, periodRight - periodLeft)} height={plotH} fill="#FDE68A" opacity="0.62" />
        )}
        <line x1={margin.left} y1={y(0)} x2={width - margin.right} y2={y(0)} stroke="#6b7280" strokeWidth="1" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#94a3b8" strokeWidth="1" />
        <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#94a3b8" strokeWidth="1" />
        {referencePoints.length > 1 && (
          <path d={pathFromPoints(referencePoints)} fill="none" stroke="#9CA3AF" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {comparisonPoints.length > 1 && (
          <path d={pathFromPoints(comparisonPoints)} fill="none" stroke={comparisonColor} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {openX != null && <line x1={openX} y1={margin.top} x2={openX} y2={height - margin.bottom} stroke={openStroke} strokeWidth="1.5" />}
        {closeX != null && <line x1={closeX} y1={margin.top} x2={closeX} y2={height - margin.bottom} stroke={closeStroke} strokeWidth="1.5" />}
        <g transform={`translate(${width / 2 - 70} 14)`}>
          <rect x="0" y="-7" width="7" height="7" fill="#9CA3AF" />
          <text x="11" y="0" fontSize="9" fontWeight="700" fill="#64748B">{contractLabelForYear(legs, numLegs, referenceYear)}</text>
          <rect x="108" y="-7" width="7" height="7" fill={comparisonColor} />
          <text x="119" y="0" fontSize="9" fontWeight="700" fill="#334155">{contractLabelForYear(legs, numLegs, comparisonYear)}</text>
        </g>
      </svg>
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

function buildTimeTicks(minTime, maxTime, count = 4) {
  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || minTime === maxTime) {
    return [];
  }

  return Array.from({ length: count + 1 }, (_, index) => {
    const timestamp = minTime + ((maxTime - minTime) * index) / count;
    const date = new Date(timestamp);
    return {
      timestamp,
      label: date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }),
    };
  });
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

function CalculatorView({ csvData, selectedYears, legs, numLegs, period }) {
  const rows = useMemo(
    () => buildCalculatorRows(csvData, legs, numLegs, selectedYears, period),
    [csvData, legs, numLegs, selectedYears, period]
  );
  const validRows = rows.filter((row) => row.hasData);
  const openAction = period.side === "buy" ? "buy" : "sell";
  const closeAction = period.side === "buy" ? "sell" : "buy";
  const openHeaderColor = period.side === "buy" ? "bg-green-700" : "bg-red-600";
  const closeHeaderColor = period.side === "buy" ? "bg-red-600" : "bg-green-700";
  const profitableCount = validRows.filter((row) => row.equityChange > 0).length;
  const average = (field) =>
    validRows.length
      ? validRows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0) / validRows.length
      : null;

  if (!rows.length) {
    return (
      <div className="flex h-full min-h-[520px] flex-1 items-center justify-center rounded border border-dashed border-slate-300 bg-white text-center text-slate-500">
        <div>
          <p className="mb-2 text-lg font-extrabold">No calculator rows yet</p>
          <p className="text-sm font-semibold">Select one or more years and set an open and close period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[520px] flex-1 overflow-auto rounded border border-slate-200 bg-white shadow-sm">
      <CalculatorTimeline rows={validRows} period={period} />

      <table className="min-w-[1320px] w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-950 text-white">
            <th className="border border-slate-300 px-2 py-2 text-left">ticker</th>
            <th className={`border border-slate-300 px-2 py-2 text-right ${openHeaderColor}`}>
              open ({openAction})
            </th>
            <th className={`border border-slate-300 px-2 py-2 text-right ${closeHeaderColor}`}>
              close ({closeAction})
            </th>
            <th className="border border-slate-300 px-2 py-2 text-right">
              change ({period.side === "buy" ? "sell - buy" : "sell - buy"})
            </th>
            <th className="border border-slate-300 px-2 py-2 text-right">equity change</th>
            <th className="border border-slate-300 px-2 py-2 text-right">days</th>
            <th className="border border-slate-300 px-2 py-2 text-right">avg. profit/day</th>
            <th className="border border-slate-300 px-2 py-2 text-right">max adverse excursion</th>
            <th className="border border-slate-300 px-2 py-2 text-right">max profitable excursion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            if (!row.hasData) {
              return (
                <tr key={row.year} className={index % 2 ? "bg-white" : "bg-slate-50"}>
                  <td className="border border-slate-200 px-2 py-1 font-bold text-slate-700">{row.ticker}</td>
                  <td colSpan="8" className="border border-slate-200 px-2 py-1 text-slate-500">
                    No overlapping data available for this selected period.
                  </td>
                </tr>
              );
            }

            return (
              <tr key={row.year} className={index % 2 ? "bg-white" : "bg-slate-50"}>
                <td className="border border-slate-200 px-2 py-1 font-bold text-slate-700">{row.ticker}</td>
                <td className="border border-slate-200 px-2 py-1 text-right">
                  <span className="mr-3 text-slate-600">{formatTableDate(row.openDate)}</span>
                  <span>{formatSignedNumber(row.openValue, 2)}</span>
                </td>
                <td className="border border-slate-200 px-2 py-1 text-right">
                  <span className="mr-3 text-slate-600">{formatTableDate(row.closeDate)}</span>
                  <span>{formatSignedNumber(row.closeValue, 2)}</span>
                </td>
                <td className={`border border-slate-200 px-2 py-1 text-right font-bold ${row.change < 0 ? "text-red-600" : "text-slate-950"}`}>
                  {formatSignedNumber(row.change, 2)}
                </td>
                <td className={`border border-slate-200 px-2 py-1 text-right font-bold ${row.equityChange < 0 ? "text-red-600" : "text-slate-950"}`}>
                  {formatSignedCurrency(row.equityChange)}
                </td>
                <td className="border border-slate-200 px-2 py-1 text-right">{row.days}</td>
                <td className={`border border-slate-200 px-2 py-1 text-right font-bold ${row.avgProfitPerDay < 0 ? "text-red-600" : "text-slate-950"}`}>
                  {formatSignedCurrency(row.avgProfitPerDay)}
                </td>
                <td className="border border-slate-200 px-2 py-1 text-right">
                  <span className="mr-3 text-slate-600">{formatTableDate(row.maxAdverseDate)}</span>
                  <span className={row.maxAdverseValue < 0 ? "font-bold text-red-600" : "font-bold text-slate-950"}>
                    {formatSignedCurrency(row.maxAdverseValue)}
                  </span>
                </td>
                <td className="border border-slate-200 px-2 py-1 text-right">
                  <span className="mr-3 text-slate-600">{formatTableDate(row.maxProfitableDate)}</span>
                  <span className={row.maxProfitableValue < 0 ? "font-bold text-red-600" : "font-bold text-slate-950"}>
                    {formatSignedCurrency(row.maxProfitableValue)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-white text-[11px] font-extrabold text-slate-950">
            <td className="border border-slate-300 px-2 py-1 text-right">
              {validRows.length} trades; {validRows.length ? `${Math.round((profitableCount / validRows.length) * 100)}% profitable` : ""}
            </td>
            <td className="border border-slate-300 px-2 py-1" />
            <td className="border border-slate-300 px-2 py-1 text-right">averages:</td>
            <td className="border border-slate-300 px-2 py-1 text-right">{formatSignedNumber(average("change"), 2)}</td>
            <td className="border border-slate-300 px-2 py-1 text-right">{formatSignedCurrency(average("equityChange"))}</td>
            <td className="border border-slate-300 px-2 py-1 text-right">{formatSignedNumber(average("days"), 1)}</td>
            <td className="border border-slate-300 px-2 py-1 text-right">{formatSignedCurrency(average("avgProfitPerDay"))}</td>
            <td className="border border-slate-300 px-2 py-1 text-right">{formatSignedCurrency(average("maxAdverseValue"))}</td>
            <td className="border border-slate-300 px-2 py-1 text-right">{formatSignedCurrency(average("maxProfitableValue"))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CalculatorTimeline({ rows, period }) {
  const width = 1320;
  const height = 210;
  const margin = { top: 28, right: 24, bottom: 36, left: 70 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const validRows = rows.filter((row) => row.openDate && row.closeDate);

  if (!validRows.length) {
    return (
      <div className="flex h-[210px] items-center justify-center border-b border-slate-300 text-sm font-semibold text-slate-500">
        No timeline data available.
      </div>
    );
  }

  const allTimes = validRows.flatMap((row) => [parseDate(row.openDate).getTime(), parseDate(row.closeDate).getTime()]);
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const x = (timestamp) => margin.left + ((timestamp - minTime) / Math.max(1, maxTime - minTime)) * plotW;
  const openColor = period.side === "buy" ? "#15803D" : "#DC2626";
  const closeColor = period.side === "buy" ? "#DC2626" : "#15803D";
  const ticks = buildTimeTicks(minTime, maxTime, 6);
  const rowGap = Math.max(5, Math.min(12, plotH / Math.max(1, validRows.length)));

  return (
    <div className="border-b border-slate-300 bg-white">
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-[210px] w-full">
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        <text x={width / 2} y={18} textAnchor="middle" fontSize="12" fontWeight="800" fill="#020617">
          {titleForConfig({ legs: rows.length ? [] : [], numLegs: 0 }) || "Calculator period map"}
        </text>
        {ticks.map((tick) => (
          <g key={tick.timestamp}>
            <line x1={x(tick.timestamp)} y1={margin.top} x2={x(tick.timestamp)} y2={height - margin.bottom} stroke="#d1d5db" />
            <text x={x(tick.timestamp)} y={height - 12} textAnchor="middle" fontSize="10" fill="#111827">
              {tick.label}
            </text>
          </g>
        ))}
        {validRows.map((row, index) => {
          const y = margin.top + 8 + index * rowGap;
          const openX = x(parseDate(row.openDate).getTime());
          const closeX = x(parseDate(row.closeDate).getTime());
          return (
            <g key={row.year}>
              <line x1={Math.min(openX, closeX)} y1={y} x2={Math.max(openX, closeX)} y2={y} stroke={colorForYear(row.year, rows[0]?.year)} strokeWidth="2" />
              <circle cx={openX} cy={y} r="2" fill={openColor} />
              <circle cx={closeX} cy={y} r="2" fill={closeColor} />
            </g>
          );
        })}
        <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#94a3b8" />
        <text x={margin.left - 12} y={margin.top + 5} textAnchor="end" fontSize="10" fontWeight="800" fill="#334155">
          {validRows[0]?.year}
        </text>
        <text x={margin.left - 12} y={height - margin.bottom - 5} textAnchor="end" fontSize="10" fontWeight="800" fill="#334155">
          {validRows.at(-1)?.year}
        </text>
      </svg>
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
