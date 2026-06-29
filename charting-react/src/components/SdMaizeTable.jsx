import React, { useEffect, useState } from "react";

export default function SdMaizeTable({ data, selectedYears }) {
  const [userScenario, setUserScenario] = useState({});
  const currentYear = selectedYears[selectedYears.length - 1];

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

  const grouped = data.reduce((acc, row) => {
    const section = row.section || "Other";
    if (!acc[section]) acc[section] = [];
    acc[section].push(row);
    return acc;
  }, {});

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-xs text-slate-800">
        <thead>
          <tr className="bg-slate-100 text-slate-950">
            <th className="border border-slate-200 px-2 py-1 text-left">Category</th>
            {selectedYears.map((year) => (
              <th
                key={year}
                colSpan={year === currentYear ? 6 : 3}
                className="border border-slate-200 px-2 py-1 text-center"
              >
                {year}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-100 text-slate-950">
            <th></th>
            {selectedYears.map((year) => (
              <React.Fragment key={year}>
                <th colSpan={3} className="border border-slate-200 text-center">
                  NAMC
                </th>
                {year === currentYear && (
                  <th colSpan={3} className="border border-slate-200 text-center text-emerald-700">
                    Your Scenario
                  </th>
                )}
              </React.Fragment>
            ))}
          </tr>
          <tr className="bg-slate-100 text-slate-950">
            <th></th>
            {selectedYears.map((year) => (
              <React.Fragment key={year}>
                <th className="border px-1">WMAZ</th>
                <th className="border px-1">YMAZ</th>
                <th className="border px-1">Total</th>
                {year === currentYear && (
                  <>
                    <th className="border px-1 text-emerald-700">WMAZ</th>
                    <th className="border px-1 text-emerald-700">YMAZ</th>
                    <th className="border px-1 text-emerald-700">Total</th>
                  </>
                )}
              </React.Fragment>
            ))}
          </tr>
        </thead>

        <tbody>
          {Object.entries(grouped).map(([section, rows]) => (
            <React.Fragment key={section}>
              <tr className="bg-slate-200 text-sm font-semibold text-slate-950">
                <td
                  colSpan={
                    selectedYears.length * 3 +
                    (selectedYears.includes(currentYear) ? 3 : 0) +
                    1
                  }
                  className="border border-slate-200 px-2 py-1 uppercase tracking-wide"
                >
                  {section}
                </td>
              </tr>

              {rows.map((row, i) => (
                <tr key={`${section}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="whitespace-nowrap border border-slate-200 px-2 py-1">
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
                        <td className="border px-1 text-right">
                          {namc.WMAZ?.toLocaleString() ?? "-"}
                        </td>
                        <td className="border px-1 text-right">
                          {namc.YMAZ?.toLocaleString() ?? "-"}
                        </td>
                        <td className="border px-1 text-right">
                          {namc.Total?.toLocaleString() ?? "-"}
                        </td>

                        {year === currentYear && (
                          <>
                            <td className="border px-1">
                              <input
                                type="text"
                                value={user.WMAZ ?? ""}
                                onChange={(event) =>
                                  handleInputChange(row.category, "WMAZ", event.target.value)
                                }
                                className="w-20 rounded border border-slate-300 bg-white p-1 text-right text-slate-900 focus:border-slate-500 focus:outline-none"
                                inputMode="decimal"
                                pattern="[0-9]*"
                              />
                            </td>
                            <td className="border px-1">
                              <input
                                type="text"
                                value={user.YMAZ ?? ""}
                                onChange={(event) =>
                                  handleInputChange(row.category, "YMAZ", event.target.value)
                                }
                                className="w-20 rounded border border-slate-300 bg-white p-1 text-right text-slate-900 focus:border-slate-500 focus:outline-none"
                                inputMode="decimal"
                                pattern="[0-9]*"
                              />
                            </td>
                            <td className="border px-1 text-right text-emerald-700">
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
