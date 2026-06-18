export const palette = ["#2e6fbb", "#2f7d57", "#b7791f", "#1d7f8c", "#7759a6", "#596579", "#9a5b30"];
export const currentYearColor = "#d62828";
export const averageColor = "#1f2937";

export const fmt = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });
export const pctFmt = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function yearColor(year, years) {
  if (year === years.at(-1)) return currentYearColor;
  const index = years.indexOf(year);
  return palette[(index < 0 ? 0 : index) % palette.length];
}

export function clampWeek(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(52, Math.round(numeric)));
}

export function niceScale(maxValue, isPercent = false, minValue = 0, allowNonZeroMin = false) {
  if (isPercent) {
    const max = Math.min(120, Math.max(10, Math.ceil(maxValue / 10) * 10));
    const step = max <= 50 ? 10 : 20;
    const min = allowNonZeroMin && minValue > step ? Math.max(0, Math.floor((minValue - step * 0.5) / step) * step) : 0;
    return { step, min, max };
  }
  const rawStep = Math.max(1, maxValue) / 5;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const fraction = rawStep / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * power;
  return { step, min: 0, max: Math.ceil(maxValue / step) * step };
}

export function tickWeeks(start, end) {
  const span = end - start;
  const step = span > 34 ? 8 : span > 18 ? 4 : span > 8 ? 2 : 1;
  const ticks = [];
  for (let week = start; week <= end; week += step) ticks.push(week);
  if (!ticks.includes(end)) ticks.push(end);
  return ticks;
}

function parseMarketingYearStart(marketingYear) {
  const match = String(marketingYear || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function formatDate(date, includeYear = false) {
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

export function weekDateRange(marketingYear, week, startMonth = 5) {
  const startYear = parseMarketingYearStart(marketingYear);
  const seasonStart = new Date(startYear, startMonth - 1, 1);
  const day = seasonStart.getDay();
  const daysSinceSaturday = (day - 6 + 7) % 7;
  const weekOneStart = new Date(startYear, startMonth - 1, 1 - daysSinceSaturday);
  const start = new Date(weekOneStart);
  start.setDate(weekOneStart.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function formatWeekRange(marketingYear, week, startMonth = 5, includeYear = false) {
  if (!marketingYear || !week) return "";
  const { start, end } = weekDateRange(marketingYear, week, startMonth);
  const sameMonth = start.getMonth() === end.getMonth();
  const year = end.getFullYear();

  if (includeYear) {
    return `${formatDate(start)} - ${formatDate(end, true)}`;
  }
  if (sameMonth) {
    return `${String(start.getDate()).padStart(2, "0")}-${formatDate(end)}`;
  }
  return `${formatDate(start)}-${formatDate(end)}`;
}

export function formatWeekEndDate(marketingYear, week, startMonth = 5, includeYear = false) {
  if (!marketingYear || !week) return "";
  const { end } = weekDateRange(marketingYear, week, startMonth);
  return formatDate(end, includeYear);
}

export function averageSeries(series, selectedYears, allYears, showAverage) {
  if (!showAverage || selectedYears.size === 0) return null;
  const latest = [...selectedYears].sort().at(-1);
  const averageYears = allYears.filter((year) => year < latest).slice(-5);
  const included = series.filter((item) => averageYears.includes(item.year));
  const byWeek = new Map();
  for (const item of included) {
    for (const point of item.values) {
      if (!byWeek.has(point.week)) byWeek.set(point.week, []);
      byWeek.get(point.week).push(point.value);
    }
  }
  const values = [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, points]) => ({ week, value: points.reduce((sum, value) => sum + value, 0) / points.length }));
  return values.length ? { year: "5-year avg", sourceYears: averageYears, values } : null;
}

export function seriesFromRows(rows, valueForPoint) {
  const byYear = new Map();
  for (const row of rows) {
    if (!byYear.has(row.marketingYear)) byYear.set(row.marketingYear, []);
    byYear.get(row.marketingYear).push(row);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, values]) => ({
      year,
      values: values
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((row) => ({
          week: row.weekNumber,
          label: row.weekLabel || "",
          weekly: row.weeklyTons,
          cumulative: row.cumulativeTons,
          cec: row.cecEstimate,
          value: valueForPoint(row),
        }))
        .filter((point) => point.value !== null && Number.isFinite(point.value)),
    }));
}
