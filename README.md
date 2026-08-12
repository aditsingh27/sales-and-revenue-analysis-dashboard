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

## Expected data columns

| Column   | Aliases accepted      |
|----------|-----------------------|
| month    | date, order_date      |
| product  | sku, item             |
| category |                       |
| region   |                       |
| channel  |                       |
| units    | quantity, qty         |
| revenue  | sales, amount         |
| cost     | cogs                  |

A starter file is included at [`public/sample-sales.csv`](public/sample-sales.csv).

## Tech stack

- React + Vite
- Recharts
- Papa Parse (CSV)
- SheetJS / xlsx (Excel)

## Learning outcomes

Practice data visualization, KPI tracking, filter-driven analysis, and turning sales numbers into actionable business insights.
