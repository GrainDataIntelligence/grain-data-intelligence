from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "cftc"
OUTFILE = ROOT / "data" / "cftc.json"

MARKETS = {
    "Corn": "CORN - CHICAGO BOARD OF TRADE",
    "Feeder Cattle": "FEEDER CATTLE - CHICAGO MERCANTILE EXCHANGE",
    "Lean Hogs": "LEAN HOGS - CHICAGO MERCANTILE EXCHANGE",
    "Live Cattle": "LIVE CATTLE - CHICAGO MERCANTILE EXCHANGE",
    "Natural Gas": "NATURAL GAS - NEW YORK MERCANTILE EXCHANGE",
    "Soybean Meal": "SOYBEAN MEAL - CHICAGO BOARD OF TRADE",
    "Soybean Oil": "SOYBEAN OIL - CHICAGO BOARD OF TRADE",
    "Soybeans": "SOYBEANS - CHICAGO BOARD OF TRADE",
    "Wheat": "WHEAT-SRW - CHICAGO BOARD OF TRADE",
}


def parse_date(value: str) -> datetime | None:
    value = (value or "").strip()
    for fmt in ("%Y %b %d %I:%M:%S %p", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def as_number(value: str) -> float | None:
    text = (value or "").replace("\xa0", "").replace(" ", "").replace(",", "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def marketing_year_label(date: datetime) -> str:
    if date.month >= 9:
        return f"{str(date.year)[2:]}/{str(date.year + 1)[2:]}"
    return f"{str(date.year - 1)[2:]}/{str(date.year)[2:]}"


def seasonal_key(date: datetime) -> str:
    year = 2000 if date.month >= 9 else 2001
    return f"{year:04d}-{date.month:02d}-{date.day:02d}"


def percentile(values: list[float], current: float) -> float:
    if not values:
        return 0.0
    return sum(1 for value in values if value < current) / len(values) * 100


def normalise() -> dict:
    raw_files = sorted(RAW_DIR.glob("*.csv"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not raw_files:
        raise FileNotFoundError(f"No CFTC CSV files found in {RAW_DIR}")
    raw_file = raw_files[0]
    market_lookup = {market: commodity for commodity, market in MARKETS.items()}
    rows_by_commodity: dict[str, list[dict]] = defaultdict(list)

    with raw_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            market = (raw.get("Market_and_Exchange_Names") or "").strip()
            commodity = market_lookup.get(market)
            if not commodity:
                continue

            date = parse_date(raw.get("Report_Date_as_YYYY_MM_DD", ""))
            long_value = as_number(raw.get("M_Money_Positions_Long_All", ""))
            short_value = as_number(raw.get("M_Money_Positions_Short_All", ""))
            spread_value = as_number(raw.get("M_Money_Positions_Spread_All", "")) or 0.0
            open_interest = as_number(raw.get("Open_Interest_All", "")) or 0.0
            if not date or long_value is None or short_value is None:
                continue

            net_value = long_value - short_value
            rows_by_commodity[commodity].append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "seasonalDate": seasonal_key(date),
                    "marketingYear": marketing_year_label(date),
                    "managedMoneyLong": round(long_value, 3),
                    "managedMoneyShort": round(short_value, 3),
                    "managedMoneySpread": round(spread_value, 3),
                    "managedMoneyNet": round(net_value, 3),
                    "openInterest": round(open_interest, 3),
                }
            )

    commodities = []
    rows = []
    latest_by_commodity = {}
    years = set()

    for commodity, commodity_rows in sorted(rows_by_commodity.items()):
        commodity_rows.sort(key=lambda item: item["date"])
        if not commodity_rows:
            continue

        commodities.append(
            {
                "name": commodity,
                "market": MARKETS[commodity],
            }
        )
        rows.extend({"commodity": commodity, **row} for row in commodity_rows)
        years.update(row["marketingYear"] for row in commodity_rows)

        latest = commodity_rows[-1]
        latest_by_commodity[commodity] = {
            "date": latest["date"],
            "marketingYear": latest["marketingYear"],
            "managedMoneyLong": latest["managedMoneyLong"],
            "managedMoneyShort": latest["managedMoneyShort"],
            "managedMoneySpread": latest["managedMoneySpread"],
            "managedMoneyNet": latest["managedMoneyNet"],
            "openInterest": latest["openInterest"],
            "netPercentile": round(
                percentile([row["managedMoneyNet"] for row in commodity_rows], latest["managedMoneyNet"]),
                1,
            ),
        }

    return {
        "generatedFrom": str(raw_file.relative_to(ROOT)),
        "markets": commodities,
        "marketingYears": sorted(years),
        "latest": latest_by_commodity,
        "rows": rows,
    }


def main() -> None:
    OUTFILE.parent.mkdir(parents=True, exist_ok=True)
    OUTFILE.write_text(json.dumps(normalise(), indent=2), encoding="utf-8")
    print(f"Wrote {OUTFILE}")


if __name__ == "__main__":
    main()
