// src/data/loadHistorical.js

// Mapping between dropdown code and CSV file in /public/data
export const COMMODITY_DEFS = {
  WMAZ: { code: "WMAZ", label: "White Maize", file: "White_Maize.csv" },
  YMAZ: { code: "YMAZ", label: "Yellow Maize", file: "Yellow_Maize.csv" },
  WHEAT: { code: "WHEAT", label: "Wheat", file: "Wheat.csv" },
  SOYA: { code: "SOYA", label: "Soybeans", file: "Soybeans.csv" },
  SUNS: { code: "SUNS", label: "Sunflower", file: "Sunflower.csv" },
};

// Very simple CSV parser, assuming there are no commas inside fields
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(",");
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] !== undefined ? cols[idx].trim() : "";
    });
    rows.push(row);
  }

  return rows;
}

function toDate(str) {
  // Accepts "YYYY-MM-DD" or "YYYY/MM/DD"
  const [y, m, d] = str.split(/[-/]/).map(Number);
  return new Date(y, m - 1, d);
}

function formatMMDD(dateObj) {
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  return `${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

/**
 * Load and parse historical data for a single commodity code (e.g. "WMAZ").
 * Returns an array of records:
 * {
 *   dateObj: Date,
 *   mmdd: "MM-DD",
 *   contract_month: "Jul",
 *   contract_year: 2025,
 *   price: 4270
 * }
 */
export async function loadCommodityData(commodityCode) {
  const def = COMMODITY_DEFS[commodityCode];
  if (!def) throw new Error(`Unknown commodity code: ${commodityCode}`);

  const response = await fetch(`/data/${def.file}`);
  if (!response.ok) {
    throw new Error(
      `Failed to load CSV for ${commodityCode}: /data/${def.file} (status ${response.status})`
    );
  }

  const text = await response.text();
  const rawRows = parseCSV(text);

  const records = rawRows
    .map((r) => {
      try {
        const dateObj = toDate(r.date);
        const price = Number(r.price);
        const year = Number(r.contract_year);
        const month = (r.contract_month || "").trim();

        if (!dateObj || isNaN(dateObj.getTime()) || isNaN(price) || isNaN(year))
          return null;

        return {
          dateObj,
          mmdd: formatMMDD(dateObj),
          contract_month: month,
          contract_year: year,
          price,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return records;
}
