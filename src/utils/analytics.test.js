import { strict as assert } from "node:assert";
import test from "node:test";
import Papa from "papaparse";
import { monthlyTrend, normalizeImportedRows } from "./analytics.js";

test("normalizes common exported headers and derives revenue from units and unit price", () => {
  const rows = normalizeImportedRows([
    {
      "Order Date": "2025-12-15",
      "Product Name": "Widget",
      "Qty Sold": "2",
      "Unit Price": "$1,250.00",
      "Total Cost": "$800.00",
      "Sales Channel": "Web",
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].month, "Dec 2025");
  assert.equal(rows[0].product, "Widget");
  assert.equal(rows[0].units, 2);
  assert.equal(rows[0].revenue, 2500);
  assert.equal(rows[0].cost, 800);
  assert.equal(rows[0].channel, "Web");
});

test("parses localized currency and keeps dated rows in separate monthly groups", () => {
  const rows = normalizeImportedRows([
    { sale_date: "2026-01-03", item: "Thing", quantity: "3", net_sales: "€ 1.234,50" },
    { sale_date: "2025-12-18", item: "Thing", quantity: "1", net_sales: "$500.00" },
  ]);

  assert.equal(rows[0].revenue, 1234.5);
  assert.deepEqual(
    monthlyTrend(rows).map(({ month, revenue }) => [month, revenue]),
    [["Dec 2025", 500], ["Jan 2026", 1234.5]]
  );
});

test("accepts revenue-only rows without a date or product column", () => {
  const rows = normalizeImportedRows([{ Amount: "$75.00" }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].month, "Undated");
  assert.equal(rows[0].product, "All sales");
  assert.equal(rows[0].revenue, 75);
});

test("parses a CSV export with a BOM, unfamiliar headers, and later-year months", () => {
  const csv = [
    "\uFEFFOrder Timestamp,SKU Name,Units Sold,Total Revenue (USD)",
    '2025-08-03,Trail Pack,2,"$1,299.50"',
    "2025-09-11,Trail Pack,1,$500.00",
  ].join("\n");
  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  const rows = normalizeImportedRows(parsed.data);

  assert.equal(parsed.errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].month, "Aug 2025");
  assert.equal(rows[0].revenue, 1299.5);
  assert.equal(rows[1].month, "Sep 2025");
});
