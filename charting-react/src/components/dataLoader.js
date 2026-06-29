const COMMODITY_FILES = {
  Wheat: "Wheat.csv",
  Soybeans: "Soybeans.csv",
  "White Maize": "White_Maize.csv",
  "Yellow Maize": "Yellow_Maize.csv",
  Sunflower: "Sunflower.csv",
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).flatMap((line) => {
    if (!line.trim()) return [];

    const values = line.split(",");
    return [
      headers.reduce((row, header, index) => {
        row[header] = values[index]?.trim() ?? "";
        return row;
      }, {}),
    ];
  });
}

function groupRowsByContract(rows) {
  return rows.reduce((groups, row) => {
    const month = row.contract_month;
    const year = row.contract_year;

    if (!month || !year) return groups;

    const key = `${month}-${year}`;
    if (!groups[key]) groups[key] = [];

    groups[key].push({
      ...row,
      price: Number(row.price),
      volume: Number(row.volume),
      open_interest: Number(row.open_interest),
      contract_year: Number(year),
    });

    return groups;
  }, {});
}

export async function loadAllCSVData() {
  const entries = await Promise.all(
    Object.entries(COMMODITY_FILES).map(async ([commodity, file]) => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/price_history/${file}`
      );

      if (!response.ok) {
        throw new Error(`Could not load ${file} (${response.status})`);
      }

      const rows = parseCSV(await response.text());
      return [commodity, groupRowsByContract(rows)];
    })
  );

  return Object.fromEntries(entries);
}
