param(
  [string]$ReportFolder = "",
  [string]$PriceHistoryFolder = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

if (-not $ReportFolder) {
  $ReportFolder = Join-Path $root "data\raw\daily_price_reports"
}
if (-not $PriceHistoryFolder) {
  $PriceHistoryFolder = Join-Path $root "charting-react\public\data\price_history"
}

$allowedMonths = @("Mar", "May", "Jul", "Sep", "Dec")
$monthOrder = @{
  "Mar" = 3
  "May" = 5
  "Jul" = 7
  "Sep" = 9
  "Dec" = 12
}

$commodityBlocks = @{
  "WHITE MAIZE FUTURE"         = @{ Commodity = "WMAZ"; File = "White_Maize.csv" }
  "YELLOW MAIZE FUTURE"        = @{ Commodity = "YMAZ"; File = "Yellow_Maize.csv" }
  "BREAD MILLING WHEAT"        = @{ Commodity = "WEAT"; File = "Wheat.csv" }
  "BREAD MILLING WHEAT FUTURE" = @{ Commodity = "WEAT"; File = "Wheat.csv" }
  "SUNFLOWER SEEDS FUTURE"     = @{ Commodity = "SUNS"; File = "Sunflower.csv" }
  "SOYA BEANS"                 = @{ Commodity = "SOYB"; File = "Soybeans.csv" }
  "SOYA BEANS FUTURE"          = @{ Commodity = "SOYB"; File = "Soybeans.csv" }
}

function Normalize-Heading([string]$value) {
  return (($value -replace "\s+", " ").Trim()).ToUpperInvariant()
}

function Parse-ReportDate([string]$value) {
  $match = [regex]::Match($value, "(\d{2}-[A-Za-z]{3}-\d{4})")
  if (-not $match.Success) {
    throw "Could not find report date in '$value'"
  }
  return [datetime]::ParseExact($match.Groups[1].Value, "dd-MMM-yyyy", [Globalization.CultureInfo]::InvariantCulture).ToString("yyyy/MM/dd")
}

function Parse-Number($value) {
  if ($null -eq $value -or "$value".Trim() -eq "") { return "" }
  $number = 0.0
  if ([double]::TryParse("$value", [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return $number
  }
  if ([double]::TryParse("$value", [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::CurrentCulture, [ref]$number)) {
    return $number
  }
  return ""
}

function Csv-Line($row) {
  @(
    $row.date
    $row.commodity
    $row.contract_month
    $row.contract_year
    $row.price
    $row.unit
    $row.currency
    $row.volume
    $row.open_interest
    $row.source
  ) -join ","
}

function Read-ReportRows([string]$path) {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $rows = New-Object System.Collections.Generic.List[object]
  $workbook = $null
  $sheet = $null

  try {
    $workbook = $excel.Workbooks.Open($path)
    $sheet = $workbook.Worksheets.Item(1)
    $reportDate = Parse-ReportDate ([string]$sheet.Cells.Item(3, 1).Text)
    $lastRow = $sheet.UsedRange.Rows.Count
    $activeBlock = $null

    for ($row = 6; $row -le $lastRow; $row++) {
      $contractText = ([string]$sheet.Cells.Item($row, 1).Text).Trim()
      if (-not $contractText) { continue }

      $heading = Normalize-Heading $contractText
      if ($commodityBlocks.ContainsKey($heading)) {
        $activeBlock = $commodityBlocks[$heading]
        continue
      }

      $contractMatch = [regex]::Match($contractText, "^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}|\d{4})$", "IgnoreCase")
      if (-not $contractMatch.Success) {
        $activeBlock = $null
        continue
      }
      if (-not $activeBlock) { continue }

      $month = (Get-Culture).TextInfo.ToTitleCase($contractMatch.Groups[1].Value.ToLowerInvariant())
      if ($allowedMonths -notcontains $month) { continue }

      $yearText = $contractMatch.Groups[2].Value
      $year = if ($yearText.Length -eq 2) { 2000 + [int]$yearText } else { [int]$yearText }
      $mtm = Parse-Number $sheet.Cells.Item($row, 5).Value2
      if ($mtm -eq "") { continue }

      $rows.Add([pscustomobject]@{
        date = $reportDate
        commodity = $activeBlock.Commodity
        contract_month = $month
        contract_year = $year
        price = $mtm
        unit = "ZAR/Ton"
        currency = "ZAR"
        volume = Parse-Number $sheet.Cells.Item($row, 9).Value2
        open_interest = Parse-Number $sheet.Cells.Item($row, 10).Value2
        source = "JSE"
        file = $activeBlock.File
      })
    }
  }
  finally {
    if ($workbook) { $workbook.Close($false) | Out-Null }
    $excel.Quit() | Out-Null
    if ($sheet) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) | Out-Null }
    if ($workbook) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null }
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
  }

  return $rows
}

function Update-CommodityFile([string]$fileName, [object[]]$newRows) {
  $path = Join-Path $PriceHistoryFolder $fileName
  if (-not (Test-Path $path)) {
    throw "Expected price history file does not exist: $path"
  }

  $existing = @(Import-Csv -LiteralPath $path)
  $newKeys = @{}
  foreach ($row in $newRows) {
    $key = "$($row.date)|$($row.commodity)|$($row.contract_month)|$($row.contract_year)"
    $newKeys[$key] = $true
  }

  $kept = $existing | Where-Object {
    $key = "$($_.date)|$($_.commodity)|$($_.contract_month)|$($_.contract_year)"
    -not $newKeys.ContainsKey($key)
  }

  $combined = @($kept) + @($newRows | ForEach-Object {
    [pscustomobject]@{
      date = $_.date
      commodity = $_.commodity
      contract_month = $_.contract_month
      contract_year = $_.contract_year
      price = $_.price
      unit = $_.unit
      currency = $_.currency
      volume = $_.volume
      open_interest = $_.open_interest
      source = $_.source
    }
  })

  if ($DryRun) {
    Write-Output "Dry run: would update $fileName with $($newRows.Count) rows"
    return
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("date,commodity,contract_month,contract_year,price,unit,currency,volume,open_interest,source")
  foreach ($row in $combined) {
    $lines.Add((Csv-Line $row))
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($path, $lines, $utf8NoBom)

  Write-Output "Updated $fileName with $($newRows.Count) new/replaced rows"
}

if (-not (Test-Path $ReportFolder)) {
  throw "Report folder does not exist: $ReportFolder"
}
if (-not (Test-Path $PriceHistoryFolder)) {
  throw "Price history folder does not exist: $PriceHistoryFolder"
}

$reports = @(Get-ChildItem -LiteralPath $ReportFolder -File | Where-Object { $_.Extension -in @(".xls", ".xlsx") } | Sort-Object Name)
if (-not $reports.Length) {
  Write-Output "No .xls or .xlsx reports found in $ReportFolder"
  exit 0
}

$allRows = New-Object System.Collections.Generic.List[object]
foreach ($report in $reports) {
  Write-Output "Reading $($report.Name)"
  $reportRows = Read-ReportRows $report.FullName
  foreach ($row in $reportRows) {
    $allRows.Add($row)
  }
}

$allRows | Group-Object file | ForEach-Object {
  Update-CommodityFile $_.Name $_.Group
}

Write-Output "Done. Price history folder: $PriceHistoryFolder"
