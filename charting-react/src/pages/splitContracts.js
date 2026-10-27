export function sameContractMonth(firstExpiry, secondExpiry) {
  const parse = (expiry) => {
    const [, month, yearText] = String(expiry || "").split("-");
    if (!month || !yearText || !Number.isFinite(Number(yearText))) return null;
    const year = Number(yearText);
    return `${month.toLowerCase()}-${year < 100 ? 2000 + year : year}`;
  };
  const first = parse(firstExpiry);
  return first !== null && first === parse(secondExpiry);
}

export function matchingSplitRow(rows, commodity, expiry) {
  return rows.find((row) => row.commodity === commodity && sameContractMonth(row.expiry_date, expiry));
}
