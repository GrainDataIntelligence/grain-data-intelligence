import { Fragment, useMemo, useState } from "react";

const YEARS = [
  "2013/14",
  "2014/15",
  "2015/16",
  "2016/17",
  "2017/18",
  "2018/19",
  "2019/20",
  "2020/21",
  "2021/22",
  "2022/23",
  "2023/24",
  "2024/25",
  "2025/26",
  "2026/27",
].map((key) => ({
  key,
  label: key === "2026/27" ? "2026/27 Projection" : key,
  isProjection: key === "2026/27",
}));

function values(items) {
  return Object.fromEntries(YEARS.map((year, index) => [year.key, items[index] ?? null]));
}

function row(label, items, options = {}) {
  return { label, values: values(items), ...options };
}

const DATA_SOURCE_LABEL = "Soybean Supply and Demand - June 2026";

const SUMMARY_CARDS = [
  { label: "CEC estimate", rowLabel: "CEC Crop Estimate", unit: "tons" },
  { label: "Total supply", rowLabel: "Total Supply", unit: "tons" },
  { label: "Closing stock", rowLabel: "Ending Stock (28/29 Feb)", unit: "tons" },
];

const SECTIONS = [
  {
    title: "Area and Crop",
    rows: [
      row("Hectares Planted", [573949, 573949, 573949, 573949, 573950, 787200, 730500, 705000, 827100, 925300, 1148300, 1150500, 1151000, 1212700], { unit: "ha" }),
      row("Yield", [1.37, 1.65, 1.86, 1.29, 2.29, 1.96, 1.6, 1.77, 2.29, 2.41, 2.41, 1.61, 2.43, 2.51], { unit: "t/ha", decimals: 2 }),
      row("CEC Crop Estimate", [784500, 948000, 1070000, 742000, 1316370, 1540000, 1170345, 1245500, 1897000, 2230000, 2770000, 1848000, 2800000, 3043825]),
      row("Retention", [25534, 28277, 27871, 28340, 26152, 37024, 35166, 26456, 28228, 43289, 43611, 40000, 46500, 48000]),
    ],
  },
  {
    title: "Supply",
    rows: [
      row("Opening Stock (1 Mar)", [68639, 61806, 63704, 89128, 84792, 330535, 502241, 138455, 46053, 168387, 171897, 320637, 140704, 286120]),
      row("Producer deliveries", [759146, 919723, 1042129, 713660, 1290218, 1502976, 1135179, 1219044, 1868772, 2186711, 2726389, 1808548, 2749322, 2995825]),
      row("Imports", [3256, 102977, 124981, 271098, 27508, 6945, 9098, 116103, 13448, 4154, 3480, 154288, 12249, 5000]),
      row("Surplus", [2572, 0, 10526, 1122, 2519, 14394, 0, 1968, 4289, 7570, 10742, 6471, 423, 6500]),
      row("Total Supply", [833613, 1084506, 1241340, 1075008, 1405037, 1854850, 1646518, 1475570, 1932562, 2366822, 2912508, 2289944, 2902698, 3293445], { isTotal: true }),
    ],
  },
  {
    title: "Demand",
    rows: [
      row("Processed for local market", [742104, 1005548, 1134110, 974901, 1063783, 1308441, 1484592, 1417165, 1710221, 1907982, 1984433, 1988082, 2359154, 2433000], { isTotal: true }),
      row("- human", [24860, 25319, 24323, 23875, 25056, 25005, 23759, 23234, 22279, 21739, 21549, 22224, 20764, 21000]),
      row("- animal", [155654, 118598, 121763, 98718, 147302, 218973, 191223, 144985, 167480, 189605, 158855, 109652, 128497, 132000]),
      row("- crush (oil and oilcake)", [561590, 861631, 988024, 852308, 891425, 1064463, 1269610, 1248946, 1520462, 1696638, 1804029, 1856006, 2209893, 2280000]),
      row("Withdrawn by producers", [3877, 1975, 2393, 367, 1331, 567, 676, 496, 196, null, 139, 582, 167, 150]),
      row("Released to end-consumers", [2825, 2886, 2650, 1098, 608, 431, 367, 673, 123, 130, 69, 304, 157, 160]),
      row("Seed for planting purposes", [5295, 5111, 7577, 5678, 8795, 10599, 7640, 9961, 11079, 8971, 10603, 7453, 9119, 9800]),
      row("Net dispatches(+)/receipts(-)", [2316, 1924, 805, 1427, -429, -239, 1355, 162, 261, 338, -418, 2574, 1028, 1000]),
      row("Deficit", [0, 2782, 0, 0, 0, 0, 8097, 0, 0, 0, 0, 0, 0, 0]),
      row("Exports", [15390, 576, 4677, 6745, 414, 32810, 5336, 1060, 42295, 277504, 597045, 150245, 246953, 280000]),
      row("Total Demand", [771807, 1020802, 1152212, 990216, 1074502, 1352609, 1508033, 1429517, 1764175, 2194925, 2591871, 2149240, 2616578, 2724110], { isTotal: true }),
    ],
  },
  {
    title: "Closing Stock",
    rows: [
      row("Ending Stock (28/29 Feb)", [61806, 63704, 89128, 84792, 330535, 502241, 138455, 46053, 168387, 171897, 320637, 140704, 286120, 569335], { isTotal: true }),
      row("Processed per month (local)", [61842, 83796, 94509, 81242, 88649, 109037, 123716, 118097, 142518, 158999, 165369, 165674, 196596, 202750]),
      row("Months' stock", [1, 0.8, 0.9, 1, 3.7, 4.6, 1.1, 0.4, 1.2, 1.1, 1.9, 0.8, 1.5, 2.8], { unit: "months", decimals: 1 }),
      row("Days' stock", [30, 23, 29, 32, 114, 140, 34, 12, 36, 33, 59, 26, 44, 86], { unit: "days", isTotal: true }),
      row("Stocks to Use % - Total Demand", [8, 6, 8, 9, 31, 37, 9, 3, 10, 8, 12, 7, 11, 21], { unit: "%", decimals: 0 }),
    ],
  },
];

const DEFAULT_CHART_ROW = "Ending Stock (28/29 Feb)";
const DEFAULT_SELECTED_YEARS = ["2022/23", "2023/24", "2024/25", "2025/26", "2026/27"];
const SCENARIO_BASE_YEAR = "2026/27";
const SCENARIO_YEAR_SOURCES = YEARS.slice(-3);
const FORMULA_ROWS = new Set([
  "Producer deliveries",
  "Total Supply",
  "Processed for local market",
  "Total Demand",
  "Ending Stock (28/29 Feb)",
  "Processed per month (local)",
  "Months' stock",
  "Days' stock",
  "Stocks to Use % - Total Demand",
]);

function allRows() {
  return SECTIONS.flatMap((section) =>
    section.rows.map((row) => ({ ...row, section: section.title }))
  );
}

function formatValue(value, row = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const decimals = row.decimals ?? (Math.abs(value) < 10 && !Number.isInteger(value) ? 1 : 0);
  const formatted = value.toLocaleString("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (row.unit === "%") {
    return `${formatted}%`;
  }
  return formatted;
}

function rawScenarioValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return String(value);
}

function parseScenarioNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/\s/g, "").replace(/,/g, ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatScenarioInput(value, row = {}) {
  if (value === "" || value === null || value === undefined) return "";
  return formatValue(parseScenarioNumber(value), row);
}

function setNumber(values, label, value, decimals = 0) {
  const rounded = decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
  values[label] = rawScenarioValue(Number.isFinite(rounded) ? rounded : 0);
}

function recalculateScenarioValues(inputValues, changedLabel) {
  const next = { ...inputValues };
  const hectares = parseScenarioNumber(next["Hectares Planted"]);
  const yieldValue = parseScenarioNumber(next["Yield"]);
  const cec = parseScenarioNumber(next["CEC Crop Estimate"]);

  if (changedLabel === "Hectares Planted" || changedLabel === "Yield") {
    setNumber(next, "CEC Crop Estimate", hectares * yieldValue);
  } else if (changedLabel === "CEC Crop Estimate" && hectares > 0) {
    setNumber(next, "Yield", cec / hectares, 2);
  }

  const cecAfter = parseScenarioNumber(next["CEC Crop Estimate"]);
  const retention = parseScenarioNumber(next["Retention"]);
  const openingStock = parseScenarioNumber(next["Opening Stock (1 Mar)"]);
  const producerDeliveries = cecAfter - retention;
  const imports = parseScenarioNumber(next["Imports"]);
  const surplus = parseScenarioNumber(next["Surplus"]);

  setNumber(next, "Producer deliveries", producerDeliveries);
  setNumber(next, "Total Supply", openingStock + producerDeliveries + imports + surplus);

  const human = parseScenarioNumber(next["- human"]);
  const animal = parseScenarioNumber(next["- animal"]);
  const crush = parseScenarioNumber(next["- crush (oil and oilcake)"]);
  const processed = human + animal + crush;
  const withdrawn = parseScenarioNumber(next["Withdrawn by producers"]);
  const released = parseScenarioNumber(next["Released to end-consumers"]);
  const seed = parseScenarioNumber(next["Seed for planting purposes"]);
  const netDispatches = parseScenarioNumber(next["Net dispatches(+)/receipts(-)"]);
  const deficit = parseScenarioNumber(next["Deficit"]);
  const exportsValue = parseScenarioNumber(next["Exports"]);
  const totalDemand = processed + withdrawn + released + seed + netDispatches + deficit + exportsValue;
  const totalSupply = parseScenarioNumber(next["Total Supply"]);
  const endingStock = totalSupply - totalDemand;
  const processedPerMonth = processed / 12;
  const monthsStock = processedPerMonth ? endingStock / processedPerMonth : 0;
  const daysStock = monthsStock * 30.5;
  const stocksToUse = totalDemand ? (endingStock / totalDemand) * 100 : 0;

  setNumber(next, "Processed for local market", processed);
  setNumber(next, "Total Demand", totalDemand);
  setNumber(next, "Ending Stock (28/29 Feb)", endingStock);
  setNumber(next, "Processed per month (local)", processedPerMonth);
  setNumber(next, "Months' stock", monthsStock, 1);
  setNumber(next, "Days' stock", daysStock);
  setNumber(next, "Stocks to Use % - Total Demand", stocksToUse);

  return next;
}

function scenarioValuesFromYear(rows, yearKey) {
  return Object.fromEntries(rows.map((row) => [row.label, rawScenarioValue(row.values[yearKey])]));
}

function createScenario(rows, index, sourceValues, sourceLabel) {
  const copiedValues = sourceValues || scenarioValuesFromYear(rows, SCENARIO_BASE_YEAR);

  return {
    id: `scenario-${Date.now()}-${index}`,
    name: sourceLabel ? `${sourceLabel} Scenario` : `Scenario ${index + 1}`,
    values: recalculateScenarioValues(copiedValues, "CEC Crop Estimate"),
  };
}

function MiniBarChart({ row }) {
  const maxValue = Math.max(...YEARS.map((year) => Math.abs(row.values[year.key] || 0)), 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Soybeans annual S&D</p>
          <h2 className="text-xl font-extrabold text-slate-950">{row.label}</h2>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {row.unit || "tons"}
        </span>
      </div>

      <div className="flex h-72 items-end gap-6 border-l border-b border-slate-300 px-6 pt-6">
        {YEARS.map((year, index) => {
          const value = row.values[year.key] || 0;
          const height = `${Math.max(2, (Math.abs(value) / maxValue) * 100)}%`;
          const color = year.isProjection
            ? "bg-red-600"
            : index % 3 === 1
              ? "bg-emerald-600"
              : index % 3 === 2
                ? "bg-amber-600"
                : "bg-blue-700";

          return (
            <div key={year.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div className="text-center text-sm font-bold text-slate-900">{formatValue(value, row)}</div>
              <div className={`w-full max-w-[92px] rounded-t-sm ${color}`} style={{ height }} />
              <div className="min-h-10 text-center text-xs font-bold text-slate-600">{year.key}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnnualSdSummary() {
  const rows = useMemo(() => allRows(), []);
  const [commodity] = useState("Soybeans");
  const [chartRowLabel, setChartRowLabel] = useState(DEFAULT_CHART_ROW);
  const [selectedYears, setSelectedYears] = useState(DEFAULT_SELECTED_YEARS);
  const [scenarios, setScenarios] = useState([]);
  const [scenarioSource, setScenarioSource] = useState(`year:${SCENARIO_BASE_YEAR}`);
  const chartRow = rows.find((row) => row.label === chartRowLabel) || rows[0];
  const projectionYear = "2026/27";
  const rowByLabel = (label) => rows.find((row) => row.label === label);
  const selectedYearObjects = YEARS.filter((year) => selectedYears.includes(year.key));
  const scenarioSourceOptions = [
    ...SCENARIO_YEAR_SOURCES.map((year) => ({
      value: `year:${year.key}`,
      label: year.label,
      values: scenarioValuesFromYear(rows, year.key),
    })),
    ...scenarios.map((scenario) => ({
      value: `scenario:${scenario.id}`,
      label: scenario.name,
      values: { ...scenario.values },
    })),
  ];
  const addScenario = () => {
    const source =
      scenarioSourceOptions.find((option) => option.value === scenarioSource) ||
      scenarioSourceOptions[scenarioSourceOptions.length - 1];
    setScenarios((current) => [...current, createScenario(rows, current.length, source.values, source.label)]);
  };
  const updateScenarioName = (scenarioId, name) => {
    setScenarios((current) =>
      current.map((scenario) => (scenario.id === scenarioId ? { ...scenario, name } : scenario))
    );
  };
  const updateScenarioValue = (scenarioId, rowLabel, value) => {
    setScenarios((current) =>
      current.map((scenario) =>
        scenario.id === scenarioId
          ? {
              ...scenario,
              values: recalculateScenarioValues(
                { ...scenario.values, [rowLabel]: rawScenarioValue(parseScenarioNumber(value)) },
                rowLabel
              ),
            }
          : scenario
      )
    );
  };
  const removeScenario = (scenarioId) => {
    setScenarios((current) => current.filter((scenario) => scenario.id !== scenarioId));
    if (scenarioSource === `scenario:${scenarioId}`) {
      setScenarioSource(`year:${SCENARIO_BASE_YEAR}`);
    }
  };
  const toggleYear = (yearKey) => {
    setSelectedYears((current) =>
      current.includes(yearKey) ? current.filter((key) => key !== yearKey) : [...current, yearKey]
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <section className="border-b border-slate-200 bg-white px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Balance Sheet</p>
        <h1 className="text-3xl font-extrabold text-slate-950">Annual S&D Summary</h1>
      </section>

      <main className="grid gap-4 p-6 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-bold text-slate-950" htmlFor="annual-sd-commodity">
            Commodity
          </label>
          <select
            id="annual-sd-commodity"
            value={commodity}
            disabled
            className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
          >
            <option>Soybeans</option>
          </select>

          <label className="mt-5 block text-sm font-bold text-slate-950" htmlFor="annual-sd-chart-row">
            Chart line
          </label>
          <select
            id="annual-sd-chart-row"
            value={chartRowLabel}
            onChange={(event) => setChartRowLabel(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {rows.map((row) => (
              <option key={`${row.section}-${row.label}`} value={row.label}>
                {row.label}
              </option>
            ))}
          </select>

          <div className="mt-5">
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedYears([])}
                className="h-9 flex-1 rounded-md border border-slate-300 bg-white text-sm text-slate-800 hover:bg-slate-50"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => setSelectedYears(DEFAULT_SELECTED_YEARS)}
                className="h-9 flex-1 rounded-md border border-slate-300 bg-white text-sm text-slate-800 hover:bg-slate-50"
              >
                Latest 5
              </button>
            </div>
            <p className="mb-2 text-sm font-bold text-slate-950">Years</p>
            <div className="grid max-h-60 grid-cols-2 gap-x-3 gap-y-2 overflow-y-auto pr-1 text-sm">
              {[...YEARS].reverse().map((year) => (
                <label key={year.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedYears.includes(year.key)}
                    onChange={() => toggleYear(year.key)}
                  />
                  <span>{year.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label className="text-sm font-bold text-slate-950" htmlFor="annual-sd-scenario-source">
              Scenario source
            </label>
            <div className="mt-2 flex gap-2">
              <select
                id="annual-sd-scenario-source"
                value={scenarioSource}
                onChange={(event) => setScenarioSource(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"
              >
                {scenarioSourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addScenario}
                className="h-10 rounded-md bg-slate-950 px-4 text-sm font-extrabold text-white hover:bg-slate-800"
              >
                Build
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Uses the longer Soybean supply and demand table where available, with the 2026/27
            column treated as the current projection. Scenarios can copy one of the latest three
            years or another scenario as a starting point.
          </div>
        </aside>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ...SUMMARY_CARDS.map((card) => {
                const summaryRow = rowByLabel(card.rowLabel);
                return {
                  eyebrow: "2026/27 projection",
                  label: card.label,
                  value: summaryRow?.values[projectionYear],
                  row: summaryRow,
                  unit: card.unit,
                };
              }),
            ].map(({ eyebrow, label, value, row: summaryRow, unit }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase text-slate-500">{eyebrow}</p>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-950">
                  {formatValue(value, summaryRow)} {unit}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{label}</p>
              </div>
            ))}
          </div>

          <MiniBarChart row={chartRow} />

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-bold uppercase text-slate-500">Detailed annual table</p>
              <h2 className="text-xl font-extrabold text-slate-950">{DATA_SOURCE_LABEL}</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-200 text-left text-slate-950">
                    <th className="min-w-[220px] border border-slate-300 px-2 py-1.5">Line item</th>
                    {selectedYearObjects.length === 0 && scenarios.length === 0 && (
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-500">
                        Select years or build a scenario
                      </th>
                    )}
                    {selectedYearObjects.map((year) => (
                      <th key={year.key} className="min-w-[120px] border border-slate-300 px-2 py-1.5 text-right">
                        {year.label}
                      </th>
                    ))}
                    {scenarios.map((scenario) => (
                      <th key={scenario.id} className="min-w-[120px] border border-amber-300 bg-amber-100 px-2 py-1 text-right">
                        <div className="flex items-center gap-1">
                          <input
                            value={scenario.name}
                            onChange={(event) => updateScenarioName(scenario.id, event.target.value)}
                            className="h-7 min-w-0 flex-1 rounded border border-amber-300 bg-white px-2 text-right text-xs font-bold text-slate-950"
                            aria-label="Scenario name"
                          />
                          <button
                            type="button"
                            onClick={() => removeScenario(scenario.id)}
                            className="h-7 w-7 rounded border border-amber-300 bg-white text-xs font-bold text-slate-600 hover:bg-amber-50"
                            aria-label={`Remove ${scenario.name}`}
                          >
                            x
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((section) => (
                    <Fragment key={section.title}>
                      <tr key={`${section.title}-section`} className="bg-slate-100">
                        <td className="border border-slate-300 px-2 py-1 font-extrabold text-slate-950">
                          {section.title}
                        </td>
                        {selectedYearObjects.length === 0 && scenarios.length === 0 && (
                          <td className="border border-slate-300 px-2 py-1" />
                        )}
                        {selectedYearObjects.map((year) => (
                          <td key={year.key} className="border border-slate-300 px-2 py-1" />
                        ))}
                        {scenarios.map((scenario) => (
                          <td key={scenario.id} className="border border-amber-200 bg-amber-50 px-2 py-1" />
                        ))}
                      </tr>
                      {section.rows.map((row) => (
                        <tr key={`${section.title}-${row.label}`} className={row.isTotal ? "font-extrabold" : ""}>
                          <td className="whitespace-nowrap border border-slate-300 px-2 py-1">{row.label}</td>
                          {selectedYearObjects.length === 0 && scenarios.length === 0 && (
                            <td className="border border-slate-300 px-2 py-1 text-slate-500" />
                          )}
                          {selectedYearObjects.map((year) => (
                            <td key={year.key} className="whitespace-nowrap border border-slate-300 px-2 py-1 text-right">
                              {formatValue(row.values[year.key], row)}
                            </td>
                          ))}
                          {scenarios.map((scenario) => (
                          <td key={scenario.id} className="whitespace-nowrap border border-amber-200 bg-amber-50 px-1 py-0.5 text-right">
                            <input
                                value={formatScenarioInput(scenario.values[row.label], row)}
                                onChange={(event) => updateScenarioValue(scenario.id, row.label, event.target.value)}
                                readOnly={FORMULA_ROWS.has(row.label)}
                                className={`h-7 w-full rounded border px-1.5 text-right text-xs outline-none focus:border-amber-500 ${
                                  row.isTotal
                                    ? "border-amber-300 bg-amber-100 font-extrabold"
                                    : FORMULA_ROWS.has(row.label)
                                      ? "border-amber-200 bg-amber-50 font-semibold text-slate-700"
                                      : "border-amber-200 bg-white"
                                }`}
                                aria-label={`${scenario.name} ${row.label}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
