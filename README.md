# Sales & Revenue Analysis Dashboard

Interactive dashboard for analyzing sales and revenue data — import CSV/Excel, track KPIs, filter with slicers, and explore charts for business insights.

## Features

- **Import data** from CSV or Excel (`.csv`, `.xlsx`, `.xls`), plus a built-in sample dataset
- **KPI cards**: total revenue, gross profit, margin, MoM change, units, revenue per unit, COGS
- **Interactive filters/slicers**: region, category, channel, period
- **Charts**: revenue trend, units by month, category bars, channel mix, regional revenue, top products
- **Insights tab**: auto-generated takeaways from the filtered data

## Quick start

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

Run the import normalization checks with `npm test`.

## Importing your sales data

Import CSV or Excel files with a header row. The importer recognizes common variations such as
`Order Date`, `Product Name`, `Quantity Sold`, `Net Sales`, `Unit Price`, and `Cost of Goods Sold`.
Date, product, category, region, channel, and cost are optional. Rows with no date appear as
“Undated”; available months become selectable in the period filter. Revenue can be provided
directly or calculated from quantity × unit price.

Currency symbols and common thousands/decimal separators are supported. The dashboard uses USD
for display, so convert other currencies before importing if you need accurate currency totals.

A mock retail dataset is built in for trying the dashboard, and a starter CSV is available at
[`public/sample-sales.csv`](public/sample-sales.csv).

## Tech stack

- React + Vite
- Recharts
- Papa Parse (CSV)
- SheetJS / xlsx (Excel)

## Learning outcomes

Practice data visualization, KPI tracking, filter-driven analysis, and turning sales numbers into actionable business insights.
