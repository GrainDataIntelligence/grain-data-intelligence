from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUTS = [
    ROOT / "south_africa_imports_exports_koring_2021_2026.csv",
    ROOT / "south_africa_imports_exports_maize_2019_2026.csv",
]
OUTFILE = ROOT / "data" / "imports_exports.json"


def clean_text(value: str | None) -> str:
    return (value or "").strip()


def as_number(value: str | None) -> float:
    text = clean_text(value).replace(" ", "").replace(",", "")
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def normalise() -> dict:
    rows: list[dict] = []
    years: set[str] = set()
    commodities: set[str] = set()
    flows: set[str] = set()
    countries: set[str] = set()
    ports: set[str] = set()
    sources: list[str] = []

    for path in INPUTS:
        if not path.exists():
            continue
        sources.append(path.name)
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for raw in reader:
                year = clean_text(raw.get("Marketing Year"))
                week = clean_text(raw.get("Week No"))
                commodity = clean_text(raw.get("Commodity"))
                flow = clean_text(raw.get("Flow"))
                country = clean_text(raw.get("Country"))
                port = clean_text(raw.get("Port"))
                if not year or not week or not commodity or not flow:
                    continue
                try:
                    week_number = int(float(week))
                except ValueError:
                    continue
                if week_number < 1:
                    continue

                tons = as_number(raw.get("Tons"))
                breakdown = "Port" if port else "Country"
                entity = port or country
                if not entity:
                    continue

                years.add(year)
                commodities.add(commodity)
                flows.add(flow)
                if country:
                    countries.add(country)
                if port:
                    ports.add(port)

                rows.append(
                    {
                        "marketingYear": year,
                        "weekNumber": min(week_number, 52),
                        "rawWeekNumber": week_number,
                        "commodity": commodity,
                        "flow": flow,
                        "breakdown": breakdown,
                        "country": country,
                        "port": port,
                        "entity": entity,
                        "weeklyTons": round(tons, 3),
                    }
                )

    collapsed: dict[tuple[str, int, str, str, str, str], dict] = {}
    for row in rows:
        key = (
            row["marketingYear"],
            row["weekNumber"],
            row["commodity"],
            row["flow"],
            row["breakdown"],
            row["entity"],
        )
        if key not in collapsed:
            collapsed[key] = {**row, "weeklyTons": 0.0, "rawWeekNumbers": []}
        collapsed[key]["weeklyTons"] += row["weeklyTons"]
        collapsed[key]["rawWeekNumbers"].append(row["rawWeekNumber"])

    normalised = list(collapsed.values())
    for row in normalised:
        row["weeklyTons"] = round(row["weeklyTons"], 3)
        row["rolledWeek53"] = any(week > 52 for week in row["rawWeekNumbers"])
        del row["rawWeekNumbers"]

    cumulative: dict[tuple[str, str, str, str, str], float] = defaultdict(float)
    normalised.sort(
        key=lambda item: (
            item["commodity"],
            item["flow"],
            item["breakdown"],
            item["entity"],
            item["marketingYear"],
            item["weekNumber"],
        )
    )
    for row in normalised:
        key = (
            row["commodity"],
            row["flow"],
            row["breakdown"],
            row["entity"],
            row["marketingYear"],
        )
        cumulative[key] += row["weeklyTons"]
        row["cumulativeTons"] = round(cumulative[key], 3)

    return {
        "generatedFrom": sources,
        "commodities": sorted(commodities),
        "flows": sorted(flows),
        "marketingYears": sorted(years),
        "countries": sorted(countries),
        "ports": sorted(ports),
        "breakdowns": ["Country", "Port"],
        "rows": normalised,
    }


def main() -> None:
    OUTFILE.parent.mkdir(exist_ok=True)
    OUTFILE.write_text(json.dumps(normalise(), indent=2), encoding="utf-8")
    print(f"Wrote {OUTFILE}")


if __name__ == "__main__":
    main()
