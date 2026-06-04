import { useEffect, useMemo, useState } from "react";

const ACCOUNT_START = 1000000;
const CONTRACT_TONS = 100;

const TRADE_TYPES = ["Futures", "Calendar Spread", "Split"];
const DEFAULT_ACCOUNT = {
  cash: ACCOUNT_START,
  realizedPL: 0,
  trades: [],
};

const commodityNames = {
  BEAN: "Soybeans",
  CORN: "Corn",
  SUNS: "Sunflowers",
  WEAT: "Wheat",
  WMAZ: "White Maize",
  YMAZ: "Yellow Maize",
};

function parseNumber(value) {
  return Number(String(value ?? "").replace(/\s/g, "")) || 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function getStoredAccount() {
  try {
    const stored = JSON.parse(localStorage.getItem("gdiDemoTradingAccount"));
    if (stored?.trades) return stored;
  } catch {
    return DEFAULT_ACCOUNT;
  }
  return DEFAULT_ACCOUNT;
}

function normalizeMarginRow(row) {
  return {
    ...row,
    commodity: String(row.commodity || "").trim(),
    expiry_date: String(row.expiry_date || "").trim(),
    imr: parseNumber(row.imr),
    csmr: parseNumber(row.csmr),
    ssmr: parseNumber(row.ssmr),
    vsr: Number(row.vsr) || 0,
    ssg: row.ssg || "",
  };
}

function tradeLabel(trade) {
  if (trade.type === "Calendar Spread") return `${trade.commodity1} ${trade.expiry1} / ${trade.expiry2}`;
  if (trade.type === "Split") return `${trade.commodity1} / ${trade.commodity2} ${trade.expiry1}`;
  return `${trade.commodity1} ${trade.expiry1}`;
}

export default function DemoTrading() {
  const [marginRows, setMarginRows] = useState([]);
  const [account, setAccount] = useState(getStoredAccount);
  const [tradeType, setTradeType] = useState("Futures");
  const [commodity1, setCommodity1] = useState("");
  const [commodity2, setCommodity2] = useState("");
  const [expiry1, setExpiry1] = useState("");
  const [expiry2, setExpiry2] = useState("");
  const [side, setSide] = useState("Buy");
  const [quantity, setQuantity] = useState(1);
  const [entryPrice, setEntryPrice] = useState("");
  const [message, setMessage] = useState("");
  const [closePrices, setClosePrices] = useState({});

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/im_safex.json`)
      .then((response) => response.json())
      .then((data) => {
        const rows = data.map(normalizeMarginRow);
        setMarginRows(rows);
        const firstCommodity = rows[0]?.commodity || "";
        setCommodity1(firstCommodity);
        setCommodity2(rows.find((row) => row.commodity !== firstCommodity)?.commodity || firstCommodity);
      })
      .catch(() => setMessage("Could not load the SAFEX margin file."));
  }, []);

  useEffect(() => {
    localStorage.setItem("gdiDemoTradingAccount", JSON.stringify(account));
  }, [account]);

  const commodities = useMemo(() => [...new Set(marginRows.map((row) => row.commodity))].sort(), [marginRows]);

  const expiries1 = useMemo(
    () => marginRows.filter((row) => row.commodity === commodity1).map((row) => row.expiry_date),
    [commodity1, marginRows]
  );

  const expiries2 = useMemo(
    () => marginRows.filter((row) => row.commodity === commodity2).map((row) => row.expiry_date),
    [commodity2, marginRows]
  );

  useEffect(() => {
    if (!expiries1.includes(expiry1)) setExpiry1(expiries1[0] || "");
    if (tradeType === "Calendar Spread" && (!expiry2 || expiry2 === expiry1 || !expiries1.includes(expiry2))) {
      setExpiry2(expiries1.find((expiry) => expiry !== expiry1) || "");
    }
  }, [expiries1, expiry1, expiry2, tradeType]);

  useEffect(() => {
    if (tradeType === "Split" && !expiries2.includes(expiry1)) {
      setCommodity2(commodities.find((commodity) => commodity !== commodity1) || commodity1);
    }
  }, [commodities, commodity1, expiries2, expiry1, tradeType]);

  const row1 = marginRows.find((row) => row.commodity === commodity1 && row.expiry_date === expiry1);
  const row2Calendar = marginRows.find((row) => row.commodity === commodity1 && row.expiry_date === expiry2);
  const row2Split = marginRows.find((row) => row.commodity === commodity2 && row.expiry_date === expiry1);

  const marginPerContract = useMemo(() => {
    if (!row1) return 0;
    if (tradeType === "Futures") return row1.imr;
    if (tradeType === "Calendar Spread") {
      if (!row2Calendar || expiry1 === expiry2) return 0;
      return row1.csmr + row2Calendar.csmr + Math.abs(row1.imr - row2Calendar.imr);
    }
    if (tradeType === "Split") {
      if (!row2Split || commodity1 === commodity2) return 0;
      if (row1.ssg === row2Split.ssg) return row1.ssmr + row2Split.ssmr + Math.abs(row1.imr - row2Split.imr);
      return row1.imr + row2Split.imr;
    }
    return 0;
  }, [commodity1, commodity2, expiry1, expiry2, row1, row2Calendar, row2Split, tradeType]);

  const totalMargin = marginPerContract * (Number(quantity) || 0);
  const marginUsed = account.trades.filter((trade) => trade.status === "Open").reduce((sum, trade) => sum + trade.margin, 0);
  const availableFunds = account.cash - marginUsed;
  const openTrades = account.trades.filter((trade) => trade.status === "Open");
  const closedTrades = account.trades.filter((trade) => trade.status === "Closed");

  const placeTrade = () => {
    const cleanQuantity = Number(quantity);
    const cleanEntry = Number(entryPrice);
    if (!commodity1 || !expiry1 || !cleanQuantity || cleanQuantity < 1) {
      setMessage("Select a contract and enter a valid quantity.");
      return;
    }
    if (!Number.isFinite(cleanEntry)) {
      setMessage("Enter the entry price or spread level.");
      return;
    }
    if (!marginPerContract || totalMargin > availableFunds) {
      setMessage("The account does not have enough available margin for this trade.");
      return;
    }

    const trade = {
      id: Date.now(),
      type: tradeType,
      commodity1,
      commodity2: tradeType === "Split" ? commodity2 : "",
      expiry1,
      expiry2: tradeType === "Calendar Spread" ? expiry2 : "",
      side,
      quantity: cleanQuantity,
      entryPrice: cleanEntry,
      margin: totalMargin,
      status: "Open",
      openedAt: new Date().toISOString(),
    };

    setAccount((current) => ({ ...current, trades: [trade, ...current.trades] }));
    setEntryPrice("");
    setMessage("Trade placed.");
  };

  const closeTrade = (trade) => {
    const closePrice = Number(closePrices[trade.id]);
    if (!Number.isFinite(closePrice)) {
      setMessage("Enter a close price before closing the trade.");
      return;
    }

    const direction = trade.side === "Buy" ? 1 : -1;
    const pl = (closePrice - trade.entryPrice) * CONTRACT_TONS * trade.quantity * direction;

    setAccount((current) => ({
      ...current,
      cash: current.cash + pl,
      realizedPL: current.realizedPL + pl,
      trades: current.trades.map((item) =>
        item.id === trade.id
          ? { ...item, closePrice, pl, status: "Closed", closedAt: new Date().toISOString() }
          : item
      ),
    }));
    setMessage("Trade closed.");
  };

  const resetAccount = () => {
    if (!confirm("Reset the demo account to R1,000,000 and clear all trades?")) return;
    setAccount(DEFAULT_ACCOUNT);
    setClosePrices({});
    setMessage("Account reset.");
  };

  const recentMarginRows = marginRows.slice(0, 8);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-[1500px] px-5 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">GDI paper account</p>
            <h1 className="text-3xl font-extrabold text-slate-950">Demo Trading</h1>
          </div>
          <button
            type="button"
            onClick={resetAccount}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
          >
            Reset account
          </button>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <SummaryCard label="Account equity" value={formatMoney(account.cash)} tone="green" />
          <SummaryCard label="Margin used" value={formatMoney(marginUsed)} tone="amber" />
          <SummaryCard label="Available funds" value={formatMoney(availableFunds)} tone="blue" />
          <SummaryCard label="Realized P/L" value={formatMoney(account.realizedPL)} tone={account.realizedPL >= 0 ? "green" : "red"} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Order ticket</p>
                <h2 className="text-lg font-extrabold text-slate-950">Place trade</h2>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">100 tons / contract</span>
            </div>

            <div className="space-y-4">
              <Field label="Trade type">
                <Segmented options={TRADE_TYPES} value={tradeType} onChange={setTradeType} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Commodity">
                  <Select value={commodity1} onChange={setCommodity1} options={commodities} />
                </Field>
                <Field label="Expiry">
                  <Select value={expiry1} onChange={setExpiry1} options={expiries1} />
                </Field>
              </div>

              {tradeType === "Calendar Spread" && (
                <Field label="Second expiry">
                  <Select value={expiry2} onChange={setExpiry2} options={expiries1.filter((expiry) => expiry !== expiry1)} />
                </Field>
              )}

              {tradeType === "Split" && (
                <Field label="Second commodity">
                  <Select value={commodity2} onChange={setCommodity2} options={commodities.filter((commodity) => commodity !== commodity1)} />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Side">
                  <Segmented options={["Buy", "Sell"]} value={side} onChange={setSide} />
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </Field>
              </div>

              <Field label={tradeType === "Futures" ? "Entry price" : "Entry spread"}>
                <input
                  type="number"
                  step="0.01"
                  value={entryPrice}
                  onChange={(event) => setEntryPrice(event.target.value)}
                  placeholder={tradeType === "Futures" ? "Example: 4300" : "Example: -45"}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </Field>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Margin per contract</span>
                  <strong>{formatMoney(marginPerContract)}</strong>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-slate-500">Total required</span>
                  <strong>{formatMoney(totalMargin)}</strong>
                </div>
              </div>

              {message && <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{message}</div>}

              <button
                type="button"
                onClick={placeTrade}
                className="h-11 w-full rounded-md bg-slate-950 text-sm font-extrabold text-white hover:bg-slate-800"
              >
                Place demo trade
              </button>
            </div>
          </section>

          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Positions</p>
                  <h2 className="text-lg font-extrabold text-slate-950">Open trades</h2>
                </div>
                <span className="text-sm font-bold text-slate-500">{openTrades.length} open</span>
              </div>
              <PositionsTable
                trades={openTrades}
                closePrices={closePrices}
                setClosePrices={setClosePrices}
                closeTrade={closeTrade}
                emptyText="No open demo trades yet."
              />
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">History</p>
                  <h2 className="text-lg font-extrabold text-slate-950">Closed trades</h2>
                </div>
                <PositionsTable trades={closedTrades} emptyText="Closed trades will appear here." />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">SAFEX reference</p>
                  <h2 className="text-lg font-extrabold text-slate-950">Margin snapshot</h2>
                </div>
                <div className="space-y-2">
                  {recentMarginRows.map((row) => (
                    <div key={`${row.commodity}-${row.expiry_date}`} className="rounded-md border border-slate-200 p-3">
                      <div className="flex justify-between gap-3 text-sm font-extrabold text-slate-900">
                        <span>{commodityNames[row.commodity] || row.commodity}</span>
                        <span>{row.expiry_date}</span>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>Initial margin</span>
                        <strong className="text-slate-700">{formatMoney(row.imr)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  const tones = {
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
    red: "border-red-100 bg-red-50 text-red-800",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {commodityNames[option] || option}
        </option>
      ))}
    </select>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="grid overflow-hidden rounded-md border border-slate-300" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`h-10 text-sm font-bold ${value === option ? "bg-slate-950 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function PositionsTable({ trades, closePrices, setClosePrices, closeTrade, emptyText }) {
  if (!trades.length) {
    return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Trade</th>
            <th className="px-3 py-2">Side</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Entry</th>
            <th className="px-3 py-2 text-right">Margin</th>
            <th className="px-3 py-2 text-right">Close</th>
            <th className="px-3 py-2 text-right">P/L</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-slate-100">
              <td className="px-3 py-3 font-bold text-slate-900">{tradeLabel(trade)}</td>
              <td className={`px-3 py-3 font-bold ${trade.side === "Buy" ? "text-emerald-700" : "text-red-700"}`}>{trade.side}</td>
              <td className="px-3 py-3 text-right">{formatNumber(trade.quantity)}</td>
              <td className="px-3 py-3 text-right">{formatNumber(trade.entryPrice)}</td>
              <td className="px-3 py-3 text-right">{formatMoney(trade.margin)}</td>
              <td className="px-3 py-3 text-right">
                {trade.status === "Open" ? (
                  <input
                    type="number"
                    value={closePrices?.[trade.id] || ""}
                    onChange={(event) => setClosePrices((current) => ({ ...current, [trade.id]: event.target.value }))}
                    className="h-9 w-24 rounded-md border border-slate-300 px-2 text-right outline-none focus:border-slate-500"
                  />
                ) : (
                  formatNumber(trade.closePrice)
                )}
              </td>
              <td className={`px-3 py-3 text-right font-extrabold ${(trade.pl || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {trade.status === "Closed" ? formatMoney(trade.pl) : "-"}
              </td>
              <td className="px-3 py-3 text-right">
                {trade.status === "Open" && (
                  <button
                    type="button"
                    onClick={() => closeTrade(trade)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
