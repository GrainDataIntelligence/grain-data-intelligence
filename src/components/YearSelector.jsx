import React from "react";

const YearSelector = ({ availableYears, selectedYears, toggleYear, selectAll }) => {
  const colors = [
    "#00B4FF", "#00D46A", "#FF3B3B", "#3366FF", "#AA55FF", "#FFAA00", "#3BBF92",
    "#FF66B2", "#5C8DFF", "#1DD3B0", "#FF7043", "#8D6EFF", "#FFD43B", "#00D9FF",
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 mb-3">
      {availableYears.map((year, idx) => {
        const color = colors[idx % colors.length];
        const isActive = selectedYears.includes(year);
        return (
          <button
            key={year}
            onClick={() => toggleYear(year)}
            className={`px-2 py-1 text-[11px] font-semibold rounded-sm border 
              ${isActive ? "text-black" : "text-gray-300"} 
              transition-colors duration-150`}
            style={{
              backgroundColor: isActive ? color : "transparent",
              borderColor: color,
            }}
          >
            {year}
          </button>
        );
      })}
      <button
        onClick={selectAll}
        className="ml-2 px-2 py-1 text-[11px] border border-gray-600 rounded-sm text-gray-300 hover:bg-gray-700"
      >
        Select / Deselect All
      </button>
    </div>
  );
};

export default YearSelector;
