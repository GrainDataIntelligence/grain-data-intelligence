import React, { useState } from "react";
import SdMaizeTable from "../components/SdMaizeTable";
import YearSelector from "../components/YearSelector";
import sdMaizeData from "../data/sd_maize.json" with { type: "json" };

const SupplyAndDemand = () => {
  const availableYears = ["2021/22", "2022/23", "2023/24", "2024/25", "2025/26"];
  const [selectedYears, setSelectedYears] = useState([...availableYears]);

  const toggleYear = (year) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const selectAll = () => {
    setSelectedYears((prev) =>
      prev.length === availableYears.length ? [] : availableYears
    );
  };

  const filteredData = sdMaizeData.map((row) => {
    const filteredRow = { ...row };
    Object.keys(row).forEach((key) => {
      if (key.includes("/") && !selectedYears.includes(key)) delete filteredRow[key];
    });
    return filteredRow;
  });

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <h1 className="mb-4 text-2xl font-bold text-slate-950">
        Supply & Demand Hub - Maize Edition
      </h1>

      <YearSelector
        availableYears={availableYears}
        selectedYears={selectedYears}
        toggleYear={toggleYear}
        selectAll={selectAll}
      />

      <SdMaizeTable data={filteredData} selectedYears={selectedYears} />
    </div>
  );
};

export default SupplyAndDemand;
