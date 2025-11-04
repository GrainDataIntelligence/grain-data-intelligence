import React, { useState } from "react";
import SdMaizeTable from "../components/SdMaizeTable";
import YearSelector from "../components/YearSelector";
import sdMaizeData from "../data/sd_maize.json" with { type: "json" };

const SupplyAndDemand = () => {
  // Full NAMC dataset years
const availableYears = ["2021/22", "2022/23", "2023/24", "2024/25", "2025/26"];

// By default, show all 5 years when page loads
const [selectedYears, setSelectedYears] = useState([...availableYears]);



  const toggleYear = (year) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const selectAll = () => {
    if (selectedYears.length === availableYears.length) {
      setSelectedYears([]);
    } else {
      setSelectedYears(availableYears);
    }
  };

  // Filter data to only show selected years
  const filteredData = sdMaizeData.map((row) => {
    const filteredRow = { ...row };
    Object.keys(row).forEach((key) => {
      if (key.includes("/") && !selectedYears.includes(key)) delete filteredRow[key];
    });
    return filteredRow;
  });

  return (
    <div className="p-6 text-gray-200">
      <h1 className="text-2xl font-bold mb-4">Supply & Demand Hub — Maize Edition</h1>

      {/* Year Selector */}
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
