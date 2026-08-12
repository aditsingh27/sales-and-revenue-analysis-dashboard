import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SAMPLE_SALES } from "./data/sampleSales";
import {
  buildInsights,
  byCategory,
  byChannel,
  byRegion,
  filterSales,
  formatCurrency,
  formatCurrencyFull,
  momGrowth,
  monthlyTrend,
  normalizeImportedRows,
  pct,
  sum,
  topProducts,
  uniqueValues,
} from "./utils/analytics";
import "./App.css";

const CHART_COLORS = ["#3d9cf0", "#3ecf8e", "#e6b84d", "#f07178", "#a78bfa", "#22d3ee"];

const PERIOD_OPTIONS = [
  { value: "YTD", label: "YTD (Jan–Jul)" },
  { value: "H1", label: "H1 (Jan–Jun)" },
  { value: "Q1", label: "Q1" },
  { value: "Q2", label: "Q2" },
  { value: "Jul", label: "July only" },
];

export default function App() {
  const fileRef = useRef(null);
  const [rows, setRows] = useState(SAMPLE_SALES);
  const [sourceLabel, setSourceLabel] = useState("Sample retail extract");
  const [region, setRegion] = useState("All");
  const [category, setCategory] = useState("All");
  const [channel, setChannel] = useState("All");
  const [period, setPeriod] = useState("YTD");
  const [view, setView] = useState("overview");
  const [importError, setImportError] = useState("");

  const filtered = useMemo(
    () => filterSales(rows, { region, category, channel, period }),
    [rows, region, category, channel, period]
  );

  const revenue = sum(filtered, "revenue");
  const cost = sum(filtered, "cost");
  const units = sum(filtered, "units");
  const profit = revenue - cost;
  const margin = revenue === 0 ? 0 : (profit / revenue) * 100;
  const aov = units === 0 ? 0 : revenue / units;
  const trend = monthlyTrend(filtered);
  const growth = momGrowth(trend);
  const products = topProducts(filtered, 6);
  const categories = byCategory(filtered);
  const channels = byChannel(filtered);
  const regions = byRegion(filtered);
  const insights = buildInsights(filtered);

  const regionOpts = ["All", ...uniqueValues(rows, "region")];
  const categoryOpts = ["All", ...uniqueValues(rows, "category")];
  const channelOpts = ["All", ...uniqueValues(rows, "channel")];
  const activeFilters = [region !== "All", category !== "All", channel !== "All", period !== "YTD"].filter(
    Boolean
  ).length;

  function resetFilters() {
    setRegion("All");
    setCategory("All");
    setChannel("All");
    setPeriod("YTD");
  }

  function loadSample() {
    setRows(SAMPLE_SALES);
    setSourceLabel("Sample retail extract");
    setImportError("");
    resetFilters();
  }

  function applyImported(rawRows, label) {
    const normalized = normalizeImportedRows(rawRows);
    if (!normalized.length) {
      setImportError("No valid sales rows found. Expected columns like month/product/revenue/units.");
      return;
    }
    setRows(normalized);
    setSourceLabel(label);
    setImportError("");
    resetFilters();
  }

  function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => applyImported(result.data, file.name),
        error: () => setImportError("Failed to parse CSV file."),
      });
      return;
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet);
          applyImported(data, file.name);
        } catch {
          setImportError("Failed to parse Excel file.");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    setImportError("Supported formats: CSV, XLSX, XLS.");
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Sales intelligence</p>
          <h1>Sales & Revenue Analysis</h1>
          <p className="lede">
            Import CSV or Excel, slice with filters, and track revenue KPIs, trends, and top
            products — built for learning data visualization and business insight generation.
          </p>
        </div>
        <div className="hero-meta">
          <span className="badge">{sourceLabel}</span>
          <span className="badge muted">{filtered.length} rows in view</span>
        </div>
      </header>

      <section className="panel import-panel">
        <div className="panel-head">
          <h2>Data import</h2>
          <p>CSV / Excel upload, or keep the built-in sample dataset.</p>
        </div>
        <div className="import-actions">
          <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>
            Import CSV / Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            hidden
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn" onClick={loadSample}>
            Load sample data
          </button>
          <a className="btn ghost" href="/sample-sales.csv" download>
            Download sample CSV
          </a>
        </div>
        {importError ? <p className="error">{importError}</p> : null}
        <p className="hint">
          Expected columns: <code>month</code>, <code>product</code>, <code>category</code>,{" "}
          <code>region</code>, <code>channel</code>, <code>units</code>, <code>revenue</code>,{" "}
          <code>cost</code> (aliases like qty/sales/cogs also work).
        </p>
      </section>

      <section className="panel">
        <div className="panel-head row">
          <div>
            <h2>Filters & slicers</h2>
            <p>Interactive analysis controls</p>
          </div>
          {activeFilters > 0 ? (
            <button type="button" className="btn ghost" onClick={resetFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
        <div className="filters">
          <label>
            Region
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {regionOpts.map((o) => (
                <option key={o} value={o}>
                  {o === "All" ? "All regions" : o}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categoryOpts.map((o) => (
                <option key={o} value={o}>
                  {o === "All" ? "All categories" : o}
                </option>
              ))}
            </select>
          </label>
          <label>
            Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {channelOpts.map((o) => (
                <option key={o} value={o}>
                  {o === "All" ? "All channels" : o}
                </option>
              ))}
            </select>
          </label>
          <label>
            Period
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="slicers">
          {categoryOpts
            .filter((c) => c !== "All")
            .map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
        </div>
      </section>

      {!filtered.length ? (
        <section className="panel warning-panel">
          <h2>No rows match these slicers</h2>
          <p>Widen the period or reset filters.</p>
          <button type="button" className="btn" onClick={resetFilters}>
            Reset filters
          </button>
        </section>
      ) : (
        <>
          <section className="kpi-grid">
            <Kpi label="Total revenue" value={formatCurrency(revenue)} tone="info" />
            <Kpi label="Gross profit" value={formatCurrency(profit)} tone="success" />
            <Kpi label="Gross margin" value={`${margin.toFixed(1)}%`} />
            <Kpi
              label="MoM revenue change"
              value={growth == null ? "—" : pct(growth)}
              tone={growth == null ? undefined : growth >= 0 ? "success" : "danger"}
            />
            <Kpi label="Units sold" value={units.toLocaleString()} />
            <Kpi label="Revenue per unit" value={formatCurrencyFull(aov)} />
            <Kpi label="Cost of goods sold" value={formatCurrencyFull(cost)} tone="warning" />
          </section>

          <div className="tabs">
            {["overview", "products", "insights"].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`tab ${view === tab ? "active" : ""}`}
                onClick={() => setView(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {view === "overview" ? (
            <div className="stack">
              <section className="panel">
                <h2>Revenue trend by month</h2>
                <p className="caption">Source: {sourceLabel} · filtered view · USD</p>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3d9cf0" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3d9cf0" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#2a3441" strokeDasharray="3 3" />
                      <XAxis dataKey="month" stroke="#6b7a8c" />
                      <YAxis stroke="#6b7a8c" tickFormatter={(v) => formatCurrency(v)} />
                      <Tooltip
                        formatter={(v) => formatCurrencyFull(v)}
                        contentStyle={tooltipStyle}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue ($)"
                        stroke="#3d9cf0"
                        fill="url(#revFill)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="split">
                <section className="panel">
                  <h2>Units sold by month</h2>
                  <p className="caption">Month · Units</p>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={trend}>
                        <CartesianGrid stroke="#2a3441" strokeDasharray="3 3" />
                        <XAxis dataKey="month" stroke="#6b7a8c" />
                        <YAxis stroke="#6b7a8c" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="units" name="Units" fill="#9aa8b8" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="panel">
                  <h2>Channel mix</h2>
                  <p className="caption">Share of filtered revenue</p>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={channels}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {channels.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => formatCurrencyFull(v)}
                          contentStyle={tooltipStyle}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              <div className="split">
                <section className="panel">
                  <h2>Revenue by category</h2>
                  <p className="caption">Category · Revenue (USD)</p>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={categories}>
                        <CartesianGrid stroke="#2a3441" strokeDasharray="3 3" />
                        <XAxis dataKey="name" stroke="#6b7a8c" />
                        <YAxis stroke="#6b7a8c" tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip
                          formatter={(v) => formatCurrencyFull(v)}
                          contentStyle={tooltipStyle}
                        />
                        <Bar dataKey="value" name="Revenue" radius={[6, 6, 0, 0]}>
                          {categories.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="panel">
                  <h2>Revenue by region</h2>
                  <p className="caption">Click a region chip to slice</p>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={regions} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid stroke="#2a3441" strokeDasharray="3 3" />
                        <XAxis type="number" stroke="#6b7a8c" tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis type="category" dataKey="name" stroke="#6b7a8c" width={70} />
                        <Tooltip
                          formatter={(v) => formatCurrencyFull(v)}
                          contentStyle={tooltipStyle}
                        />
                        <Bar dataKey="value" name="Revenue ($)" fill="#3d9cf0" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="slicers">
                    {regions.map((r) => (
                      <button
                        key={r.name}
                        type="button"
                        className={`chip ${region === r.name ? "active" : ""}`}
                        onClick={() => setRegion(region === r.name ? "All" : r.name)}
                      >
                        {r.name} · {formatCurrency(r.value)}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {view === "products" ? (
            <div className="stack">
              <section className="panel">
                <h2>Top-performing products</h2>
                <p className="caption">Ranked by revenue in the current filter</p>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={products} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid stroke="#2a3441" strokeDasharray="3 3" />
                      <XAxis type="number" stroke="#6b7a8c" tickFormatter={(v) => formatCurrency(v)} />
                      <YAxis
                        type="category"
                        dataKey="product"
                        stroke="#6b7a8c"
                        width={140}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(v) => formatCurrencyFull(v)}
                        contentStyle={tooltipStyle}
                      />
                      <Bar dataKey="revenue" name="Revenue ($)" fill="#3ecf8e" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="panel">
                <h2>Product performance detail</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th className="num">Units</th>
                        <th className="num">Revenue</th>
                        <th className="num">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.product}>
                          <td>{p.product}</td>
                          <td>{p.category}</td>
                          <td className="num">{p.units.toLocaleString()}</td>
                          <td className="num">{formatCurrencyFull(p.revenue)}</td>
                          <td className="num">
                            {revenue === 0 ? "—" : `${((p.revenue / revenue) * 100).toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <details className="panel">
                <summary>Underlying sales rows (filtered)</summary>
                <div className="table-wrap tall">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Product</th>
                        <th>Region</th>
                        <th>Channel</th>
                        <th className="num">Units</th>
                        <th className="num">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={`${r.product}-${r.month}-${r.region}-${i}`}>
                          <td>{r.month}</td>
                          <td>{r.product}</td>
                          <td>{r.region}</td>
                          <td>{r.channel}</td>
                          <td className="num">{Number(r.units).toLocaleString()}</td>
                          <td className="num">{formatCurrencyFull(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          ) : null}

          {view === "insights" ? (
            <div className="stack">
              <section className="panel">
                <h2>Business insights</h2>
                <p className="caption">
                  Auto-generated from the filtered dataset — practice reading KPIs, concentration
                  risk, channel mix, and margin health.
                </p>
                <div className="insight-grid">
                  {insights.map((ins) => (
                    <article key={ins.title} className={`insight ${ins.tone}`}>
                      <h3>{ins.title}</h3>
                      <p>{ins.body}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <h2>How this maps to real imports</h2>
                <p>
                  In production BI tools (Power BI, Tableau, Looker, Excel), you connect Excel /
                  CSV files or a SQL warehouse, then build the same pieces: KPI cards, trend
                  charts, category/channel slicers, and product leaderboards.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Typical fields</th>
                        <th>Dashboard use</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Excel / CSV</td>
                        <td>date, sku, region, channel, qty, price, cost</td>
                        <td>Ad-hoc imports &amp; learning datasets</td>
                      </tr>
                      <tr>
                        <td>Transactional DB</td>
                        <td>orders, order_items, products, customers</td>
                        <td>Live ops reporting</td>
                      </tr>
                      <tr>
                        <td>Warehouse / BI model</td>
                        <td>fact_sales + dim_product/region</td>
                        <td>Governed metrics &amp; YoY</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}

      <footer className="footer">
        Demo-ready sales dashboard · React + Recharts · CSV/Excel import supported
      </footer>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className={`kpi ${tone || ""}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

const tooltipStyle = {
  background: "#171d25",
  border: "1px solid #2a3441",
  borderRadius: 8,
  color: "#e8eef4",
};
