param(
  [string]$ReportFolder = "",
  [string]$OutputFolder = "",
  [switch]$ClearOutput
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
if (-not $ReportFolder) {
  $ReportFolder = Join-Path $root "data\raw\daily_price_reports"
}
if (-not $OutputFolder) {
  $OutputFolder = Join-Path $root "charting-react\public\data\test_extraction"
}

$headers = "date,commodity,contract_month,contract_year,price,unit,currency,volume,open_interest,source"
$allowedMonths = @("Mar", "May", "Jul", "Sep", "Dec")
$commodityBlocks = @{
  "WHITE MAIZE FUTURE"         = @{ Commodity = "White Maize"; File = "White_Maize.csv"; Unit = "tons" }
  "YELLOW MAIZE FUTURE"        = @{ Commodity = "Yellow Maize"; File = "Yellow_Maize.csv"; Unit = "tons" }
  "BREAD MILLING WHEAT"        = @{ Commodity = "Wheat"; File = "Wheat.csv"; Unit = "tons" }
  "BREAD MILLING WHEAT FUTURE" = @{ Commodity = "Wheat"; File = "Wheat.csv"; Unit = "tons" }
  "SUNFLOWER SEEDS FUTURE"     = @{ Commodity = "Sunflower"; File = "Sunflower.csv"; Unit = "tons" }
  "SOYA BEANS"                 = @{ Commodity = "Soybeans"; File = "Soybeans.csv"; Unit = "tons" }
  "SOYA BEANS FUTURE"          = @{ Commodity = "Soybeans"; File = "Soybeans.csv"; Unit = "tons" }
  "SOYBEAN CONTRACT"           = @{ Commodity = "CBOT Soybean"; File = "CBOT_Soybean.csv"; Unit = "contracts" }
  "CORN CONTRACT"              = @{ Commodity = "CBOT Corn"; File = "CBOT_Corn.csv"; Unit = "contracts" }
}

function Normalize-Heading([string]$value) {
  return (($value -replace "\s+", " ").Trim()).ToUpperInvariant()
}

function Parse-ReportDate([string]$value) {
  $match = [regex]::Match($value, "(\d{2}-[A-Za-z]{3}-\d{4})")
  if (-not $match.Success) {
    throw "Could not find report date in '$value'"
  }
  return [datetime]::ParseExact($match.Groups[1].Value, "dd-MMM-yyyy", [Globalization.CultureInfo]::InvariantCulture).ToString("yyyy-MM-dd")
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

function Ensure-OutputFiles {
  New-Item -ItemType Directory -Force -Path $OutputFolder | Out-Null
  foreach ($config in $commodityBlocks.Values) {
    $path = Join-Path $OutputFolder $config.File
    if ($ClearOutput -and (Test-Path $path)) {
      Remove-Item -LiteralPath $path
    }
    if (-not (Test-Path $path)) {
      Set-Content -LiteralPath $path -Value $headers -Encoding utf8
    }
  }
}

function Read-ReportRows([string]$path) {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $rows = New-Object System.Collections.Generic.List[object]

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
        unit = $activeBlock.Unit
        currency = "ZAR"
        volume = Parse-Number $sheet.Cells.Item($row, 9).Value2
        open_interest = Parse-Number $sheet.Cells.Item($row, 10).Value2
        source = Split-Path -Leaf $path
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

function Write-CommodityFile([string]$fileName, [object[]]$newRows) {
  $path = Join-Path $OutputFolder $fileName
  $existing = @()
  if (Test-Path $path) {
    $existing = @(Import-Csv -LiteralPath $path)
  }

  $combined = @($existing) + @($newRows | ForEach-Object {
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

  $deduped = $combined |
    Group-Object date, commodity, contract_month, contract_year |
    ForEach-Object { $_.Group | Select-Object -Last 1 } |
    Sort-Object @{ Expression = "date"; Ascending = $true }, @{ Expression = "contract_year"; Ascending = $true }, @{ Expression = {
      switch ($_.contract_month) {
        "Mar" { 3 }
        "May" { 5 }
        "Jul" { 7 }
        "Sep" { 9 }
        "Dec" { 12 }
        default { 99 }
      }
    }; Ascending = $true }

  $deduped | Export-Csv -LiteralPath $path -NoTypeInformation -Encoding utf8
}

Ensure-OutputFiles

$reports = @(Get-ChildItem -LiteralPath $ReportFolder -File | Where-Object { $_.Extension -in @(".xls", ".xlsx") } | Sort-Object Name)
if (-not $reports.Length) {
  Write-Output "No .xls or .xlsx reports found in $ReportFolder"
  exit 0
}

$allRows = New-Object System.Collections.Generic.List[object]
foreach ($report in $reports) {
  Write-Output "Reading $($report.Name)"
  $reportRows = Read-ReportRows $report.FullName
  foreach ($row in $reportRows) { $allRows.Add($row) }
}

$allRows | Group-Object file | ForEach-Object {
  Write-CommodityFile $_.Name $_.Group
  Write-Output "Wrote $($_.Count) rows to $($_.Name)"
}

Write-Output "Done. Output folder: $OutputFolder"
