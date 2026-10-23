export const commercialProcessingComponents = [
  "humanConsumptionCommercial", "animalFeedCommercial", "oilAndOilcakeCommercial",
];
const hiddenLocalComponents = new Set([
  "humanConsumptionLocal", "animalFeedLocal", "oilAndOilcakeLocal",
]);

export function soybeanMetrics(metrics) {
  return metrics.filter((item) => !hiddenLocalComponents.has(item.key)).flatMap((item) =>
    item.key === commercialProcessingComponents[0]
      ? [{ key: "totalCommercialProcessing", label: "Total Commercial Processing", type: "sum" }, item]
      : [item]
  );
}

export function soybeanRows(rows) {
  const totals = new Map();
  for (const row of rows) {
    if (!commercialProcessingComponents.includes(row.metric)) continue;
    const key = JSON.stringify([row.view, row.marketingYear, row.calendarYear, row.month]);
    const total = totals.get(key) || { ...row, metric: "totalCommercialProcessing", value: 0 };
    total.value += row.value;
    totals.set(key, total);
  }
  return [...rows, ...totals.values()];
}

export function soybeanMetricsOverlap(first, second) {
  const commercial = new Set([...commercialProcessingComponents, "totalCommercialProcessing"]);
  const exports = new Set(["rsaExportHarbours", "rsaExportBorderPosts", "productExportAfricanCountries", "productExportOtherCountries"]);
  const demand = new Set(["processedLocalMarket", "exports", "seedForPlanting", "releasedToEndConsumers", "withdrawnByProducers", ...exports, ...commercial]);
  const pair = (total, parts) => (first === total && parts.has(second)) || (second === total && parts.has(first));
  return pair("totalCommercialProcessing", new Set(commercialProcessingComponents))
    || pair("totalDemand", demand)
    || pair("exports", exports)
    // Commercial processing includes local processing and processed-product exports.
    || ((commercial.has(first) && ["processedLocalMarket", "exports", "productExportAfricanCountries", "productExportOtherCountries"].includes(second))
      || (commercial.has(second) && ["processedLocalMarket", "exports", "productExportAfricanCountries", "productExportOtherCountries"].includes(first)));
}
