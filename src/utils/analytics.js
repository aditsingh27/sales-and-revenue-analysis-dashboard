import { MONTHS } from "../data/sampleSales";

export function formatCurrency(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Number(n).toFixed(0)}`;
}

export function formatCurrencyFull(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function pct(n) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function sum(rows, key) {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

export function filterSales(rows, { region, category, channel, period }) {
  return rows.filter((r) => {
    if (region !== "All" && r.region !== region) return false;
    if (category !== "All" && r.category !== category) return false;
    if (channel !== "All" && r.channel !== channel) return false;
    if (period === "Q1" && r.monthIndex > 2) return false;
    if (period === "Q2" && (r.monthIndex < 3 || r.monthIndex > 5)) return false;
    if (period === "H1" && r.monthIndex > 5) return false;
    if (period === "Jul" && r.month !== "Jul") return false;
    return true;
  });
}

export function topProducts(rows, limit = 6) {
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.product) ?? { revenue: 0, units: 0, category: r.category };
    cur.revenue += Number(r.revenue) || 0;
    cur.units += Number(r.units) || 0;
    map.set(r.product, cur);
  }
  return [...map.entries()]
    .map(([product, v]) => ({ product, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function groupSum(rows, key) {
  const map = new Map();
  for (const r of rows) {
    map.set(r[key], (map.get(r[key]) ?? 0) + (Number(r.revenue) || 0));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function byCategory(rows) {
  return groupSum(rows, "category");
}

export function byChannel(rows) {
  return groupSum(rows, "channel");
}

export function byRegion(rows) {
  return groupSum(rows, "region");
}

export function monthlyTrend(rows) {
  const present = MONTHS.filter((m) => rows.some((r) => r.month === m));
  return present.map((m) => {
    const monthRows = rows.filter((r) => r.month === m);
    return {
      month: m,
      revenue: sum(monthRows, "revenue"),
      units: sum(monthRows, "units"),
    };
  });
}

export function momGrowth(trend) {
  if (trend.length < 2) return null;
  const prev = trend[trend.length - 2].revenue;
  const last = trend[trend.length - 1].revenue;
  if (!prev) return null;
  return ((last - prev) / prev) * 100;
}

export function uniqueValues(rows, key) {
  return [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();
}

export function normalizeImportedRows(rawRows) {
  const monthLookup = Object.fromEntries(MONTHS.map((m, i) => [m.toLowerCase(), i]));

  return rawRows
    .map((row) => {
      const get = (...keys) => {
        for (const k of keys) {
          const found = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k.toLowerCase());
          if (found != null && row[found] !== "" && row[found] != null) return row[found];
        }
        return undefined;
      };

      const monthRaw = String(get("month", "Month") ?? "").trim();
      let month = monthRaw.slice(0, 3);
      month = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
      let monthIndex = monthLookup[month.toLowerCase()];

      if (monthIndex == null) {
        const dateRaw = get("date", "Date", "order_date");
        if (dateRaw) {
          const d = new Date(dateRaw);
          if (!Number.isNaN(d.getTime())) {
            monthIndex = d.getMonth();
            month = MONTHS[monthIndex] ?? month;
          }
        }
      }

      const units = Number(get("units", "quantity", "qty", "Units")) || 0;
      const revenue = Number(get("revenue", "sales", "amount", "Revenue")) || 0;
      const cost = Number(get("cost", "cogs", "Cost")) || 0;

      return {
        month: MONTHS[monthIndex] ?? month ?? "Jan",
        monthIndex: monthIndex ?? 0,
        product: String(get("product", "sku", "item", "Product") ?? "Unknown"),
        category: String(get("category", "Category") ?? "Other"),
        region: String(get("region", "Region") ?? "Unknown"),
        channel: String(get("channel", "Channel") ?? "Unknown"),
        units,
        revenue,
        cost,
      };
    })
    .filter((r) => r.revenue > 0 || r.units > 0);
}

export function buildInsights(rows) {
  if (!rows.length) return [];
  const revenue = sum(rows, "revenue");
  const cost = sum(rows, "cost");
  const margin = revenue === 0 ? 0 : ((revenue - cost) / revenue) * 100;
  const products = topProducts(rows, 1);
  const cats = byCategory(rows);
  const channels = byChannel(rows);
  const trend = monthlyTrend(rows);
  const growth = momGrowth(trend);
  const insights = [];

  if (products[0]) {
    insights.push({
      title: "Top product concentration",
      body: `${products[0].product} leads with ${formatCurrencyFull(products[0].revenue)} (${((products[0].revenue / revenue) * 100).toFixed(1)}% of filtered revenue). Protect inventory and promo spend here.`,
      tone: "info",
    });
  }
  if (cats[0] && cats[1]) {
    insights.push({
      title: "Category mix",
      body: `${cats[0].name} is the largest category at ${formatCurrencyFull(cats[0].value)}, followed by ${cats[1].name}. Together they drive ${(((cats[0].value + cats[1].value) / revenue) * 100).toFixed(0)}% of revenue.`,
      tone: "success",
    });
  }
  if (channels[0]) {
    insights.push({
      title: "Channel performance",
      body: `${channels[0].name} contributes ${((channels[0].value / revenue) * 100).toFixed(1)}% of revenue. Compare CAC and margin by channel before scaling acquisition.`,
      tone: "info",
    });
  }
  if (growth !== null) {
    insights.push({
      title: "Latest month momentum",
      body:
        growth >= 0
          ? `Revenue rose ${pct(growth)} vs the prior month in this filter. Sustain the lift with targeted campaigns on winning SKUs.`
          : `Revenue dipped ${pct(growth)} vs the prior month. Check stockouts, pricing, and channel mix for the decline.`,
      tone: growth >= 0 ? "success" : "warning",
    });
  }
  insights.push({
    title: "Gross margin health",
    body: `Gross margin is ${margin.toFixed(1)}% on ${formatCurrencyFull(revenue)} revenue. Higher-margin categories lift blended profit; volume categories can dilute it.`,
    tone: margin >= 40 ? "success" : margin >= 35 ? "info" : "warning",
  });
  return insights.slice(0, 4);
}
