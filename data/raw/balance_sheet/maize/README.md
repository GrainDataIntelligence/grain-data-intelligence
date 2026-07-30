# Maize balance-sheet source files

Place each new maize balance-sheet `.xlsx` workbook in this folder.

The importer automatically selects the most recently modified `.xlsx` file. The
workbook must contain a worksheet named `Maize` with the existing White, Yellow,
and Total maize monthly layout.

After adding a workbook, run:

```powershell
python scripts/export_maize_balance_sheet.py
```
