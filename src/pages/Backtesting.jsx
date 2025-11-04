import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectItem
} from "../components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine
} from "recharts";

const CONTRACT_MONTHS = ["Mar", "May", "Jul", "Sep", "Dec"];

// ---------- Helpers ----------
function parseCSVSimple(text) {
  const [headerLine, ...lines] = text.trim().split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = cols[i]?.trim()));
    return obj;
  });
}

function toDate(str) {
  const [y, m, d] = str.split(/[-/]/).map(Number);
  return new Date(y, m - 1, d);
}

function findClosestTradingDate(rows, targetMMDD) {
  const [tm, td] = targetMMDD.split("-").map(Number);
  const target = new Date(2000, tm - 1, td);
  let closest = null;
  let smallestDiff = Infinity;
  for (const r of rows) {
    const d = toDate(r.date);
    if (!d) continue;
    const compare = new Date(2000, d.getMonth(), d.getDate());
    const diff = Math.abs(compare - target);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = r;
    }
  }
  return closest;
}

function formatMMDD(dateObj) {
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  return `${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

// ---------- Spread Builder ----------
function buildSpreadSeries(raw, legA, legB) {
  const rowsA = raw
    .filter((r) => r.commodity === "WMAZ" && r.contract_month === legA)
    .map((r) => ({
      date: r.date,
      dateObj: toDate(r.date),
      priceA: Number(r.price),
      year: Number(r.contract_year)
    }))
    .filter((r) => !isNaN(r.priceA));

  const rowsB = raw
    .filter((r) => r.commodity === "WMAZ" && r.contract_month === legB)
    .map((r) => ({
      date: r.date,
      dateObj: toDate(r.date),
      priceB: Number(r.price),
      year: Number(r.contract_year)
    }))
    .filter((r) => !isNaN(r.priceB));

  const merged = [];
  for (const a of rowsA) {
    const match = rowsB.find(
      (b) =>
        b.year === a.year &&
        b.dateObj.getTime() === a.dateObj.getTime()
    );
    if (match) {
      merged.push({
        date: a.date,
        dateObj: a.dateObj,
        year: a.year,
        spread: match.priceB - a.priceA // Long spread = Buy B / Sell A
      });
    }
  }
  return merged;
}

// ---------- Backtest Core ----------
function runBacktest(raw, contractMonth, entryMMDD, exitMMDD, side, legA, legB) {
  const spreadMode = legA && legB && legA !== legB;

  const rows = spreadMode
    ? buildSpreadSeries(raw, legA, legB)
    : raw
        .filter((r) => r.commodity === "WMAZ" && r.contract_month === contractMonth)
        .map((r) => ({
          ...r,
          dateObj: toDate(r.date),
          priceNum: Number(r.price),
          yearNum: Number(r.contract_year)
        }))
        .filter((r) => !isNaN(r.priceNum));

  // Group by year
  const byYear = new Map();
  for (const r of rows) {
    const y = spreadMode ? r.year : r.yearNum;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(r);
  }

  const results = [];
  const equityCurve = [];
  const seasonalData = [];
  let equity = 1;
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);

  for (const year of years) {
    const yrRows = byYear.get(year).sort((a, b) => a.dateObj - b.dateObj);
    if (!yrRows.length) continue;

    // Store seasonal data
    const series = yrRows.map((r) => ({
      date: formatMMDD(r.dateObj),
      value: spreadMode ? r.spread : r.priceNum
    }));
    seasonalData.push({ year, series });

    const entryRow = findClosestTradingDate(yrRows, entryMMDD);
    const exitRow = findClosestTradingDate(yrRows, exitMMDD);
    if (!entryRow || !exitRow) continue;

    const tradeWindow = yrRows.filter(
      (r) => r.dateObj >= entryRow.dateObj && r.dateObj <= exitRow.dateObj
    );
    if (tradeWindow.length < 2) continue;

    const entryPrice = spreadMode ? entryRow.spread : entryRow.priceNum;
    const exitPrice = spreadMode ? exitRow.spread : exitRow.priceNum;
    const days = Math.max(1, tradeWindow.length - 1);

    let plPerTon = 0;
    if (spreadMode) {
      plPerTon =
        side === "long"
          ? exitPrice - entryPrice
          : entryPrice - exitPrice;
    } else {
      plPerTon =
        side === "long"
          ? exitPrice - entryPrice
          : entryPrice - exitPrice;
    }

    let mae = 0;
    let mpe = 0;
    if (side === "long") {
      mae = Math.min(...tradeWindow.map((r) => (spreadMode ? r.spread : r.priceNum) - entryPrice));
      mpe = Math.max(...tradeWindow.map((r) => (spreadMode ? r.spread : r.priceNum) - entryPrice));
    } else {
      mae = Math.max(...tradeWindow.map((r) => entryPrice - (spreadMode ? r.spread : r.priceNum)));
      mpe = Math.min(...tradeWindow.map((r) => entryPrice - (spreadMode ? r.spread : r.priceNum)));
    }

    const retPct = (plPerTon / Math.abs(entryPrice)) * 100;
    const avgPerDay = plPerTon / days;
    equity *= 1 + retPct / 100;
    equityCurve.push({ year: String(year), equity: Number(equity.toFixed(6)) });

    results.push({
      year,
      entryDate: entryRow.date,
      entryPrice,
      exitDate: exitRow.date,
      exitPrice,
      retPct,
      plPerTon,
      days,
      avgPerDay,
      mae,
      mpe,
      side,
      spreadMode
    });
  }

  const sortedResults = results.sort((a, b) => b.year - a.year);
  const sortedEquity = equityCurve.sort((a, b) => b.year - a.year);

  const avg = results.reduce((a, r) => a + r.retPct, 0) / results.length || 0;
  const winRate =
    (results.filter((r) => r.retPct > 0).length / results.length) * 100 || 0;
  const maxDD =
    Math.min(
      ...equityCurve.map((_, i) =>
        Math.min(
          ...equityCurve.slice(i).map((p) => p.equity / equityCurve[i].equity - 1)
        )
      )
    ) * 100;

  return {
    results: sortedResults,
    summary: {
      trades: results.length,
      avgReturn: avg,
      winRate,
      maxDrawdown: maxDD,
      finalEquity: equityCurve.length
        ? equityCurve[equityCurve.length - 1].equity
        : 1
    },
    equityCurve: sortedEquity,
    seasonalData,
    spreadMode
  };
}

// ---------- React Component ----------
export default function Backtesting() {
  const [raw, setRaw] = useState([]);
  const [output, setOutput] = useState(null);
  const [contractMonth, setContractMonth] = useState("Jul");
  const [entryMMDD, setEntryMMDD] = useState("02-15");
  const [exitMMDD, setExitMMDD] = useState("04-30");
  const [side, setSide] = useState("long");
  const [legA, setLegA] = useState("");
  const [legB, setLegB] = useState("");
  const [chartMode, setChartMode] = useState("equity");
  const [showAllYears, setShowAllYears] = useState(false);

  useEffect(() => {
    fetch("/data/White_Maize_all.csv")
      .then((r) => r.text())
      .then((txt) => setRaw(parseCSVSimple(txt)));
  }, []);

  const handleRun = () => {
    const result = runBacktest(raw, contractMonth, entryMMDD, exitMMDD, side, legA, legB);
    setOutput(result);
  };

  const visibleYears = (arr) => {
    if (showAllYears) return arr;
    const sorted = arr.sort((a, b) => b.year - a.year);
    return sorted.slice(0, 10);
  };

  return (
    <div className="p-6 space-y-6 text-gray-100">
      <h1 className="text-2xl font-semibold">Seasonal Backtesting — WMAZ</h1>
      <p className="text-gray-400">
        Toggle between Equity Curve and Seasonal Overlay. Works with single contracts or spreads.
      </p>

      {/* INPUT PANEL */}
      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap gap-4 py-4">
          <div className="flex flex-col">
            <Label>Contract Month (single)</Label>
            <Select value={contractMonth} onValueChange={setContractMonth}>
              {CONTRACT_MONTHS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </Select>
          </div>

          <div className="flex flex-col">
            <Label>Leg A (Sell)</Label>
            <Select value={legA} onValueChange={setLegA}>
              <SelectItem value="">None</SelectItem>
              {CONTRACT_MONTHS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </Select>
          </div>

          <div className="flex flex-col">
            <Label>Leg B (Buy)</Label>
            <Select value={legB} onValueChange={setLegB}>
              <SelectItem value="">None</SelectItem>
              {CONTRACT_MONTHS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </Select>
          </div>

          <div className="flex flex-col">
            <Label>Entry (MM-DD)</Label>
            <Input value={entryMMDD} onChange={(e) => setEntryMMDD(e.target.value)} />
          </div>

          <div className="flex flex-col">
            <Label>Exit (MM-DD)</Label>
            <Input value={exitMMDD} onChange={(e) => setExitMMDD(e.target.value)} />
          </div>

          <div className="flex flex-col">
            <Label>Position</Label>
            <Select value={side} onValueChange={setSide}>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleRun}>Run Backtest</Button>
          </div>
        </CardContent>
      </Card>

      {/* OUTPUT */}
      {output && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {output.spreadMode
                  ? `Spread Backtest — ${legB} vs ${legA}`
                  : `Single Contract — ${contractMonth}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Trades: {output.summary.trades}</p>
              <p>Avg Return: {output.summary.avgReturn.toFixed(2)}%</p>
              <p>Win Rate: {output.summary.winRate.toFixed(2)}%</p>
              <p>Max Drawdown: {output.summary.maxDrawdown.toFixed(2)}%</p>
              <p>Final Equity: {output.summary.finalEquity.toFixed(3)}×</p>
            </CardContent>
          </Card>

          {/* TOGGLE */}
          <div className="flex gap-3">
            <Button
              variant={chartMode === "equity" ? "default" : "outline"}
              onClick={() => setChartMode("equity")}
            >
              Equity Curve
            </Button>
            <Button
              variant={chartMode === "seasonal" ? "default" : "outline"}
              onClick={() => setChartMode("seasonal")}
            >
              Seasonal Overlay
            </Button>
          </div>

          {/* CHART AREA */}
          {chartMode === "equity" ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Equity Curve (by Year)</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={output.equityCurve}>
                    <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" />
                    <XAxis dataKey="year" stroke="#aaa" />
                    <YAxis stroke="#aaa" />
                    <Tooltip formatter={(v) => v.toFixed(3) + "×"} />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardHeader className="flex justify-between items-center">
                <CardTitle>Seasonal Overlay (Last 10 Years)</CardTitle>
                <Button variant="outline" onClick={() => setShowAllYears(!showAllYears)}>
                  {showAllYears ? "Show Last 10" : "View All Years"}
                </Button>
              </CardHeader>
              <CardContent style={{ height: 500 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#aaa" allowDuplicatedCategory={false} />
                    <YAxis stroke="#aaa" />
                    <Tooltip />
                    {visibleYears(output.seasonalData).map((yr, i) => (
                      <Line
                        key={yr.year}
                        data={yr.series}
                        dataKey="value"
                        name={yr.year.toString()}
                        strokeWidth={yr.year === new Date().getFullYear() ? 2.5 : 1}
                        stroke={`hsl(${(i * 35) % 360}, 70%, 60%)`}
                        dot={false}
                      />
                    ))}
                    <ReferenceLine x={entryMMDD} stroke="green" />
                    <ReferenceLine x={exitMMDD} stroke="red" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
