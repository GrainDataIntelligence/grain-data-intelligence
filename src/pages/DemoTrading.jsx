import React, { useState, useEffect } from "react";

const DemoTrading = () => {
  const [data, setData] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [expiries, setExpiries] = useState([]);
  const [tradeType, setTradeType] = useState("Futures");
  const [commodity1, setCommodity1] = useState("");
  const [commodity2, setCommodity2] = useState("");
  const [expiry1, setExpiry1] = useState("");
  const [expiry2, setExpiry2] = useState("");
  const [direction, setDirection] = useState("Buy");
  const [quantity, setQuantity] = useState(1);
  const [entryPrice, setEntryPrice] = useState("");
  const [calcResult, setCalcResult] = useState("");

  const [account, setAccount] = useState(() => {
    return (
      JSON.parse(localStorage.getItem("gdiAccount")) || {
        balance: 1000000,
        marginUsed: 0,
        realizedPL: 0,
        trades: [],
      }
    );
  });

  const fmt = (n) => "R " + Number(n).toLocaleString("en-ZA");

  // --- Load SAFEX Data ---
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/im_safex.json`)
      .then((res) => res.json())
      .then((json) => {
        // Convert string numbers like "48 700" → 48700
        const cleaned = json.map((row) => ({
          ...row,
          imr: Number(String(row.imr).replace(/\s/g, "")) || 0,
          csmr: Number(String(row.csmr).replace(/\s/g, "")) || 0,
          ssmr: Number(String(row.ssmr).replace(/\s/g, "")) || 0,
          vsr: Number(String(row.vsr).replace(/\s/g, "")) || 0,
          ssg: row.ssg || "",
        }));
        setData(cleaned);
        const comms = [...new Set(cleaned.map((d) => d.commodity))];
        setCommodities(comms);
      })
      .catch((err) => console.error("Error loading SAFEX data:", err));
  }, []);

  // --- Save Account State ---
  useEffect(() => {
    localStorage.setItem("gdiAccount", JSON.stringify(account));
  }, [account]);

  // --- Update Expiries when selecting commodity ---
  const updateExpiries = (comm) => {
    const exps = data
      .filter((d) => d.commodity === comm)
      .map((d) => d.expiry_date);
    setExpiries(exps);
  };

  // --- Calculate Margin ---
  const calcMargin = () => {
    if (!commodity1 || !expiry1) return 0;

    const row1 = data.find(
      (r) =>
        r.commodity.trim().toUpperCase() === commodity1.trim().toUpperCase() &&
        r.expiry_date.trim() === expiry1.trim()
    );

    if (!row1) return 0;

    // Futures
    if (tradeType === "Futures") {
      return row1.imr;
    }

    // Calendar Spread
    if (tradeType === "Calendar Spread") {
      if (!expiry2) return 0;
      const row2 = data.find(
        (r) =>
          r.commodity.trim().toUpperCase() === commodity1.trim().toUpperCase() &&
          r.expiry_date.trim() === expiry2.trim()
      );
      if (!row2 || expiry1 === expiry2) return 0;
      return row1.csmr + row2.csmr + Math.abs(row1.imr - row2.imr);
    }

    // Split (Inter-Commodity Spread)
    if (tradeType.includes("Split")) {
      if (!commodity2) return 0;
      const row2 = data.find(
        (r) =>
          r.commodity.trim().toUpperCase() === commodity2.trim().toUpperCase() &&
          r.expiry_date.trim() === expiry1.trim()
      );
      if (!row2) return 0;
      if (row1.ssg === row2.ssg)
        return row1.ssmr + row2.ssmr + Math.abs(row1.imr - row2.imr);
      return row1.imr + row2.imr;
    }

    return 0;
  };

  // --- Calculate Margin Button ---
  const handleCalc = () => {
    const m = calcMargin();
    if (!m) return setCalcResult("⚠️ Unable to calculate margin.");
    const total = m * quantity;
    setCalcResult(`Margin per contract: ${fmt(m)} | Total: ${fmt(total)}`);
  };

  // --- Place Trade ---
  const placeTrade = () => {
    const m = calcMargin();
    if (!m) return alert("Margin calc failed.");
    if (!entryPrice) return alert("Enter entry price.");

    const totalMargin = m * quantity;
    if (account.balance - account.marginUsed < totalMargin)
      return alert("Insufficient margin.");

    const trade = {
      id: Date.now(),
      type: tradeType,
      comm1: commodity1,
      comm2: commodity2,
      exp1: expiry1,
      exp2: expiry2,
      dir: direction,
      qty: quantity,
      entry: entryPrice,
      margin: totalMargin,
      pl: 0,
      status: "Open",
    };

    setAccount((prev) => ({
      ...prev,
      marginUsed: prev.marginUsed + totalMargin,
      trades: [...prev.trades, trade],
    }));
    setCalcResult("");
  };

  // --- Close Trade ---
  const closeTrade = (id, closePrice) => {
    const updatedTrades = account.trades.map((t) => {
      if (t.id === id && t.status === "Open") {
        const pl = (closePrice - t.entry) * 100 * (t.dir === "Buy" ? 1 : -1) * t.qty;
        return {
          ...t,
          closePrice,
          pl,
          status: "Closed",
        };
      }
      return t;
    });

    let realizedPL = 0;
let marginUsed = 0;
let balance = account.balance;

updatedTrades.forEach((t) => {
  if (t.status === "Closed") realizedPL += t.pl;
  if (t.status === "Open") marginUsed += t.margin;
});

// update running balance
balance = 1000000 + realizedPL;

setAccount({
  ...account,
  realizedPL,
  marginUsed,
  balance,
  trades: updatedTrades,
});

  };

  // --- Reset Account ---
  const resetAccount = () => {
    if (!confirm("Reset account to R1,000,000 and clear all trades?")) return;
    setAccount({
      balance: 1000000,
      marginUsed: 0,
      realizedPL: 0,
      trades: [],
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-10">
      <div className="max-w-6xl mx-auto p-6 bg-gray-900 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold text-center text-gdiGold mb-8">
          Demo Trading Account
        </h1>

        {/* Account Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 text-center">
          <div className="bg-green-950/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">💰 Balance (Incl. P/L)</p>
            <p className="text-xl font-bold text-green-400">{fmt(account.balance)}</p>
          </div>
          <div className="bg-yellow-950/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">📊 Margin Used</p>
            <p className="text-xl font-bold text-yellow-400">{fmt(account.marginUsed)}</p>
          </div>
          <div className="bg-blue-950/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">🧮 Available Margin</p>
            <p className="text-xl font-bold text-blue-400">
              {fmt(account.balance - account.marginUsed)}
            </p>
          </div>
          <div className="bg-purple-950/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">📈 Realized P/L</p>
            <p className="text-xl font-bold text-purple-400">{fmt(account.realizedPL)}</p>
          </div>
        </div>

        {/* Trade Form */}
        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gdiGold">Place New Trade</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label>Trade Type</label>
              <select
                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                value={tradeType}
                onChange={(e) => setTradeType(e.target.value)}
              >
                <option>Futures</option>
                <option>Calendar Spread</option>
                <option>Split (Inter-Commodity Spread)</option>
              </select>
            </div>
            <div>
              <label>Commodity 1</label>
              <select
                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                value={commodity1}
                onChange={(e) => {
                  setCommodity1(e.target.value);
                  updateExpiries(e.target.value);
                }}
              >
                <option value="">Select</option>
                {commodities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Expiry 1</label>
              <select
                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                value={expiry1}
                onChange={(e) => setExpiry1(e.target.value)}
              >
                <option value="">Select</option>
                {expiries.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>

            {tradeType === "Calendar Spread" && (
              <div>
                <label>Expiry 2</label>
                <select
                  className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                  value={expiry2}
                  onChange={(e) => setExpiry2(e.target.value)}
                >
                  <option value="">Select</option>
                  {expiries.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>
            )}

            {tradeType.includes("Split") && (
              <div>
                <label>Commodity 2</label>
                <select
                  className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                  value={commodity2}
                  onChange={(e) => setCommodity2(e.target.value)}
                >
                  <option value="">Select</option>
                  {commodities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label>Direction</label>
              <select
                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option>Buy</option>
                <option>Sell</option>
              </select>
            </div>
            <div>
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(+e.target.value)}
                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
              />
            </div>
            <div>
              <label>Entry Price</label>
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(parseFloat(+e.target.value))}
                className="w-full mt-1 p-2 rounded bg-gray-900 border border-gray-700"
                placeholder="e.g. -45or 4300"
              />
            </div>
          </div>

          <button
            onClick={handleCalc}
            className="w-full mt-4 bg-yellow-400 text-black py-2 rounded-lg hover:bg-yellow-500"
          >
            🧮 Calculate Margin
          </button>
          {calcResult && (
            <p className="text-sm mt-2 text-center text-gray-300">{calcResult}</p>
          )}

          <button
            onClick={placeTrade}
            className="w-full mt-3 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
          >
            💰 Place Trade
          </button>
        </div>

        {/* Positions Table */}
        <h2 className="text-xl font-semibold mb-4 text-gdiGold">Open Positions</h2>
        <table className="w-full text-sm border-collapse border border-gray-700">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="border p-2">ID</th>
              <th className="border p-2">Type</th>
              <th className="border p-2">Commodity(s)</th>
              <th className="border p-2">Expiry(s)</th>
              <th className="border p-2">Dir</th>
              <th className="border p-2">Qty</th>
              <th className="border p-2">Entry</th>
              <th className="border p-2">Margin</th>
              <th className="border p-2">Close</th>
              <th className="border p-2">P/L</th>
              <th className="border p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {account.trades.map((t) => (
              <tr key={t.id} className="border-t border-gray-700">
                <td className="p-2 border">{t.id}</td>
                <td className="p-2 border">{t.type}</td>
                <td className="p-2 border">
                  {t.type.includes("Split") ? `${t.comm1} / ${t.comm2}` : t.comm1}
                </td>
                <td className="p-2 border">
                  {t.type === "Calendar Spread"
                    ? `${t.exp1} / ${t.exp2}`
                    : t.exp1}
                </td>
                <td className="p-2 border">{t.dir}</td>
                <td className="p-2 border">{t.qty}</td>
                <td className="p-2 border">{t.entry}</td>
                <td className="p-2 border">{fmt(t.margin)}</td>
                <td className="p-2 border">
                  {t.status === "Open" ? (
                    <input
                      type="number"
                      placeholder="Close"
                      onBlur={(e) =>
                        closeTrade(t.id, parseFloat(e.target.value))
                      }
                      className="w-24 p-1 rounded bg-gray-900 border border-gray-700"
                    />
                  ) : (
                    t.closePrice
                  )}
                </td>
                <td className="p-2 border">{fmt(t.pl)}</td>
                <td className="p-2 border">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-center mt-8">
          <button
            onClick={resetAccount}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            🔄 Reset Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoTrading;
