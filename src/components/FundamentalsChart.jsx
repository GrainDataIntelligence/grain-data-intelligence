import { useMemo, useState } from "react";
import { averageColor, fmt, formatWeekEndDate, formatWeekRange, niceScale, pctFmt, tickWeeks, yearColor } from "../pages/fundamentalsUtils";

function formatValue(value, kind) {
  if (kind === "percent") return `${pctFmt.format(value)}%`;
  return fmt.format(value);
}

function tooltipPosition({ pointX, pointY, clusterTop, clusterBottom, linePoints, chartWidth, chartHeight, margin }) {
  const tooltipW = 260;
  const tooltipH = 150;
  const pad = 12;
  const plotLeft = margin.left;
  const plotRight = chartWidth - margin.right;
  const plotTop = margin.top;
  const plotBottom = chartHeight - margin.bottom;
  const plotW = plotRight - plotLeft;
  const lineBandTop = Math.max(plotTop, clusterTop - 34);
  const lineBandBottom = Math.min(plotBottom, clusterBottom + 34);
  const roomRight = plotRight - pointX;
  const roomLeft = pointX - plotLeft;
  const preferRight = roomRight >= tooltipW + 36 || roomRight >= roomLeft;
  const sideX = preferRight ? pointX + 24 : pointX - tooltipW - 24;
  const otherSideX = preferRight ? pointX - tooltipW - 24 : pointX + 24;

  const candidates = [
    { x: sideX, y: pointY - tooltipH / 2 },
    { x: sideX, y: pointY + 18 },
    { x: sideX, y: pointY - tooltipH - 18 },
    { x: otherSideX, y: pointY - tooltipH / 2 },
    { x: otherSideX, y: pointY + 18 },
    { x: otherSideX, y: pointY - tooltipH - 18 },
    { x: pointX - tooltipW / 2, y: pointY + 24 },
    { x: pointX - tooltipW / 2, y: pointY - tooltipH - 24 },
    { x: sideX, y: (clusterTop + clusterBottom) / 2 - tooltipH / 2 },
  ];

  const overlapArea = (candidate, top, bottom) => {
    const overlapY = Math.max(0, Math.min(candidate.y + tooltipH, bottom) - Math.max(candidate.y, top));
    return overlapY * tooltipW;
  };

  const distanceToRect = (candidate) => {
    const dx = Math.max(candidate.x - pointX, 0, pointX - (candidate.x + tooltipW));
    const dy = Math.max(candidate.y - pointY, 0, pointY - (candidate.y + tooltipH));
    return Math.hypot(dx, dy);
  };

  const score = (candidate) => {
    const coveredPoints = linePoints.filter(
      (point) =>
        point.x >= candidate.x - 8 &&
        point.x <= candidate.x + tooltipW + 8 &&
        point.y >= candidate.y - 8 &&
        point.y <= candidate.y + tooltipH + 8
    ).length;
    const crossesPoint =
      pointX >= candidate.x &&
      pointX <= candidate.x + tooltipW &&
      pointY >= candidate.y &&
      pointY <= candidate.y + tooltipH;
    return distanceToRect(candidate) * 12 + coveredPoints * 280 + overlapArea(candidate, lineBandTop, lineBandBottom) * 0.02 + (crossesPoint ? 10000 : 0);
  };

  const valid = candidates
    .map((candidate) => ({
      x: Math.max(plotLeft + pad, Math.min(plotRight - tooltipW - pad, candidate.x)),
      y: Math.max(plotTop + pad, Math.min(plotBottom - tooltipH - pad, candidate.y)),
    }))
    .sort((a, b) => score(a) - score(b));

  return valid[0];
}

export default function FundamentalsChart({
  series,
  average,
  years,
  chartType = "line",
  valueKind = "tons",
  weekStart = 1,
  weekEnd = 52,
  calendarStartMonth = 5,
  referenceYear,
  showLabels = true,
  height = 480,
  emptyText = "Select at least one marketing year",
}) {
  const [tooltip, setTooltip] = useState(null);
  const width = 1000;
  const margin = { top: 20, right: 34, bottom: 70, left: valueKind === "percent" ? 76 : 92 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const active = useMemo(() => [...series, ...(average ? [average] : [])], [series, average]);
  const axisReferenceYear = referenceYear || [...series].sort((a, b) => a.year.localeCompare(b.year)).at(-1)?.year;
  const allPoints = active.flatMap((item) => item.values);
  const scale = niceScale(Math.max(1, ...allPoints.map((point) => point.value)), valueKind === "percent");
  const x = (week) => margin.left + ((week - weekStart) / Math.max(1, weekEnd - weekStart)) * plotW;
  const y = (value) => margin.top + plotH - (value / scale.max) * plotH;

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const week = Math.max(weekStart, Math.min(weekEnd, Math.round(weekStart + ((svgX - margin.left) / plotW) * (weekEnd - weekStart))));
    const pointX = x(week);
    const weekValues = active
      .map((item) => item.values.find((value) => value.week === week)?.value)
      .filter((value) => Number.isFinite(value));
    const weekYValues = weekValues.map((value) => y(value));
    const pointY = weekYValues.length
      ? weekYValues.reduce((sum, value) => sum + value, 0) / weekYValues.length
      : margin.top + plotH / 2;
    const clusterTop = weekYValues.length ? Math.min(...weekYValues) : pointY;
    const clusterBottom = weekYValues.length ? Math.max(...weekYValues) : pointY;
    const linePoints = active.flatMap((item) =>
      item.values
        .filter((value) => value.week >= weekStart && value.week <= weekEnd)
        .map((value) => ({
          x: (x(value.week) / width) * rect.width,
          y: (y(value.value) / height) * rect.height,
        }))
    );
    const position = tooltipPosition({
      pointX: (pointX / width) * rect.width,
      pointY: (pointY / height) * rect.height,
      clusterTop: (clusterTop / height) * rect.height,
      clusterBottom: (clusterBottom / height) * rect.height,
      linePoints,
      chartWidth: rect.width,
      chartHeight: rect.height,
      margin: {
        top: (margin.top / height) * rect.height,
        right: (margin.right / width) * rect.width,
        bottom: (margin.bottom / height) * rect.height,
        left: (margin.left / width) * rect.width,
      },
    });
    setTooltip({
      week,
      x: position.x,
      y: position.y,
    });
  };

  if (!allPoints.length) {
    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-h-[390px]">
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#637083" fontSize="13">
            {emptyText}
          </text>
        </svg>
      </div>
    );
  }

  const groups = Math.max(1, active.length);
  const band = x(weekStart + 1) - x(weekStart) || 14;
  const barW = Math.max(2, Math.min(18, (band * 0.78) / groups));
  const tooltipRows =
    tooltip &&
    active
      .map((item) => {
        const point = item.values.find((value) => value.week === tooltip.week);
        if (!point) return null;
        return {
          year: item.year,
          value: point.value,
          color: item.year === "5-year avg" ? averageColor : yearColor(item.year, years),
        };
      })
      .filter(Boolean);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-h-[390px]"
        onMouseMove={handleMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {Array.from({ length: Math.floor(scale.max / scale.step) + 1 }, (_, i) => i * scale.step).map((value) => (
          <g key={value}>
            <line x1={margin.left} y1={y(value)} x2={width - margin.right} y2={y(value)} stroke="#dfe6ed" />
            <text x={margin.left - 10} y={y(value) + 4} textAnchor="end" fill="#637083" fontSize="11">
              {formatValue(value, valueKind)}
            </text>
          </g>
        ))}

        {tickWeeks(weekStart, weekEnd).map((week) => (
          <g key={week}>
            <line x1={x(week)} y1={margin.top + plotH} x2={x(week)} y2={margin.top + plotH + 6} stroke="#aeb8c4" />
            <text x={x(week)} y={height - 18} textAnchor="middle" fill="#637083" fontSize="11">
              W{week}
            </text>
            {axisReferenceYear && (
              <text x={x(week)} y={height - 4} textAnchor="middle" fill="#8793a3" fontSize="10">
                {formatWeekEndDate(axisReferenceYear, week, calendarStartMonth)}
              </text>
            )}
          </g>
        ))}

        <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="#aeb8c4" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="#aeb8c4" />

        {chartType === "bar"
          ? active.map((item, seriesIndex) => {
              const color = item.year === "5-year avg" ? averageColor : yearColor(item.year, years);
              return item.values.map((point) => {
                const baseX = x(point.week) - (barW * groups) / 2 + seriesIndex * barW;
                const barH = margin.top + plotH - y(point.value);
                return (
                  <rect
                    key={`${item.year}-${point.week}`}
                    x={baseX}
                    y={y(point.value)}
                    width={Math.min(barW - 1, 16)}
                    height={Math.max(0, barH)}
                    fill={color}
                    opacity="0.84"
                  />
                );
              });
            })
          : active.map((item) => {
              const color = item.year === "5-year avg" ? averageColor : yearColor(item.year, years);
              const path = item.values.map((point, i) => `${i ? "L" : "M"} ${x(point.week)} ${y(point.value)}`).join(" ");
              return (
                <path
                  key={item.year}
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeDasharray={item.year === "5-year avg" ? "7 5" : undefined}
                />
              );
            })}

        {tooltip && (
          <line
            x1={x(tooltip.week)}
            y1={margin.top}
            x2={x(tooltip.week)}
            y2={margin.top + plotH}
            stroke="#2f3a4a"
            strokeDasharray="4 4"
            opacity="0.55"
          />
        )}
      </svg>

      {showLabels && tooltipRows?.length > 0 && (
        <div
          className="pointer-events-none absolute z-20 min-w-[190px] max-w-[280px] rounded-md border border-slate-300 bg-white/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="mb-1 font-extrabold text-slate-900">
            Week {tooltip.week}
            {axisReferenceYear && ` | ${formatWeekRange(axisReferenceYear, tooltip.week, calendarStartMonth, true)}`}
          </div>
          {tooltipRows.map((row) => (
            <div key={row.year} className="flex justify-between gap-4 py-0.5 font-bold" style={{ color: row.color }}>
              <span>{row.year}</span>
              <strong>{formatValue(row.value, valueKind)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
