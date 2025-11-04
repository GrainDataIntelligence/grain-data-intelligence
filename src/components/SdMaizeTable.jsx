import React, { useState, useEffect } from "react";

export default function SdMaizeTable({ data, selectedYears }) {
  const [userScenario, setUserScenario] = useState({});

  // Detect current year (last in selectedYears)
  const currentYear = selectedYears[selectedYears.length - 1];

  // Initialize scenario with NAMC data for the current year
  useEffect(() => {
    const initialScenario = {};
    data.forEach((row) => {
      const namc = row[currentYear] || {};
      initialScenario[row.category] = {
        WMAZ: namc.WMAZ || 0,
        YMAZ: namc.YMAZ || 0,
      };
    });
    setUserScenario(initialScenario);
  }, [data, currentYear]);

  const handleInputChange = (category, field, value) => {
    // Allow only numbers and empty string
    const numericValue =
      value === "" ? "" : parseFloat(value.replace(/[^0-9.]/g, ""));
    setUserScenario((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: numericValue,
      },
    }));
  };

  // Group rows by section
  const grouped = data.reduce((acc, row) => {
    const section = row.section || "Other";
    if (!acc[section]) acc[section] = [];
    acc[section].push(row);
    return acc;
  }, {});

  return (
    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-700 bg-gray-900">
      <table className="min-w-full text-xs text-gray-100 border-collapse">
        <thead>
          <tr className="bg-gray-800">
            <th className="px-2 py-1 text-left border border-gray-700">Category</th>
            {selectedYears.map((year) => (
              <th
                key={year}
                colSpan={year === currentYear ? 6 : 3}
                className="px-2 py-1 text-center border border-gray-700"
              >
                {year}
              </th>
            ))}
          </tr>
          <tr className="bg-gray-800">
            <th></th>
            {selectedYears.map((year) => (
              <React.Fragment key={year}>
                <th colSpan={3} className="border border-gray-700 text-center">
                  NAMC
                </th>
                {year === currentYear && (
                  <th colSpan={3} className="border border-gray-700 text-center text-green-400">
                    Your Scenario
                  </th>
                )}
              </React.Fragment>
            ))}
          </tr>
          <tr className="bg-gray-800">
            <th></th>
            {selectedYears.map((year) => (
              <React.Fragment key={year}>
                <th className="border px-1">WMAZ</th>
                <th className="border px-1">YMAZ</th>
                <th className="border px-1">Total</th>
                {year === currentYear && (
                  <>
                    <th className="border px-1 text-green-400">WMAZ</th>
                    <th className="border px-1 text-green-400">YMAZ</th>
                    <th className="border px-1 text-green-400">Total</th>
                  </>
                )}
              </React.Fragment>
            ))}
          </tr>
        </thead>

        <tbody>
          {Object.entries(grouped).map(([section, rows]) => (
            <React.Fragment key={section}>
              <tr className="bg-gray-800 text-gray-50 text-sm font-semibold">
                <td
                  colSpan={
                    selectedYears.length * 3 +
                    (selectedYears.includes(currentYear) ? 3 : 0) +
                    1
                  }
                  className="px-2 py-1 border border-gray-700 uppercase tracking-wide"
                >
                  {section}
                </td>
              </tr>

              {rows.map((row, i) => (
                <tr
                  key={`${section}-${i}`}
                  className={i % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}
                >
                  <td className="px-2 py-1 border border-gray-700 whitespace-nowrap">
                    {row.category}
                  </td>

                  {selectedYears.map((year) => {
                    const namc = row[year] || {};
                    const user = userScenario[row.category] || {};

                    const total =
                      year === currentYear
                        ? (user.WMAZ || 0) + (user.YMAZ || 0)
                        : namc.Total;

                    return (
                      <React.Fragment key={`${year}-${i}`}>
                        {/* NAMC values */}
                        <td className="border px-1 text-right">
                          {namc.WMAZ?.toLocaleString() ?? "-"}
                        </td>
                        <td className="border px-1 text-right">
                          {namc.YMAZ?.toLocaleString() ?? "-"}
                        </td>
                        <td className="border px-1 text-right">
                          {namc.Total?.toLocaleString() ?? "-"}
                        </td>

                        {/* Editable fields for current year only */}
                        {year === currentYear && (
                          <>
                            <td className="border px-1">
                              <input
                                type="text"
                                value={user.WMAZ ?? ""}
                                onChange={(e) =>
                                  handleInputChange(row.category, "WMAZ", e.target.value)
                                }
                                className="bg-gray-700 text-gray-100 w-20 text-right p-1 rounded focus:outline-none"
                                inputMode="decimal"
                                pattern="[0-9]*"
                              />
                            </td>
                            <td className="border px-1">
                              <input
                                type="text"
                                value={user.YMAZ ?? ""}
                                onChange={(e) =>
                                  handleInputChange(row.category, "YMAZ", e.target.value)
                                }
                                className="bg-gray-700 text-gray-100 w-20 text-right p-1 rounded focus:outline-none"
                                inputMode="decimal"
                                pattern="[0-9]*"
                              />
                            </td>
                            <td className="border px-1 text-right text-green-400">
                              {total ? total.toLocaleString() : "-"}
                            </td>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
