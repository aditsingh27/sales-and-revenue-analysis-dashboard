import { MONTHS } from "../data/sampleSales.js";

const ALL_MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleString("en", { month: "short" })
);

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
    if (period === "Q1" && (r.monthIndex < 0 || r.monthIndex > 2)) return false;
    if (period === "Q2" && (r.monthIndex < 3 || r.monthIndex > 5)) return false;
    if (period === "H1" && (r.monthIndex < 0 || r.monthIndex > 5)) return false;
    if (period.startsWith("month:") && getPeriodKey(r) !== period.slice(6)) return false;
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
  const groups = new Map();
  for (const row of rows) {
    const key = getPeriodKey(row);
    const group = groups.get(key) ?? { month: row.month, revenue: 0, units: 0 };
    group.revenue += Number(row.revenue) || 0;
    group.units += Number(row.units) || 0;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === "undated") return 1;
      if (b === "undated") return -1;
      return a.localeCompare(b);
    })
    .map(([periodKey, group]) => ({ periodKey, ...group }));
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
  const aliases = {
    date: ["date", "orderdate", "transactiondate", "saledate", "invoicedate", "createdat"],
    month: ["month"],
    product: ["product", "productname", "sku", "item", "itemname", "description", "skuname"],
    category: ["category", "productcategory"],
    region: ["region", "salesregion", "territory", "market", "country", "state"],
    channel: ["channel", "saleschannel", "source"],
    units: [
      "units", "quantity", "qty", "qtysold", "quantitysold", "quantityordered", "unitssold",
      "unitsordered", "items",
    ],
    revenue: [
      "revenue", "sales", "amount", "totalsales", "netsales", "grosssales",
      "salesamount", "totalamount", "invoiceamount", "subtotal", "totalrevenue",
      "revenueusd", "ordervalue", "linetotal", "extendedprice",
    ],
    cost: ["cost", "cogs", "totalcost", "costofgoodssold"],
    unitPrice: ["unitprice", "priceperunit", "sellingprice", "saleprice", "price"],
    unitCost: ["unitcost", "costperunit"],
  };
  const aliasSet = Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      new Set(names.map(normalizeHeader)),
    ])
  );

  return rawRows.map((row) => {
    const values = new Map(
      Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
    );
    const get = (field) => {
      for (const alias of aliasSet[field]) {
        const value = values.get(alias);
        if (value !== "" && value != null) return value;
      }
      const matchingHeader = [...values.keys()].find((key) => matchesHeader(field, key));
      if (matchingHeader != null && values.get(matchingHeader) !== "") {
        return values.get(matchingHeader);
      }
      return undefined;
    };

    const units = parseNumber(get("units")) ?? 0;
    const reportedRevenue = parseNumber(get("revenue"));
    const revenue = reportedRevenue ?? units * (parseNumber(get("unitPrice")) ?? 0);
    const reportedCost = parseNumber(get("cost"));
    const cost = reportedCost ?? units * (parseNumber(get("unitCost")) ?? 0);
    const date = parseSalesDate(get("date") ?? get("month"));
    const monthIndex = date?.monthIndex ?? -1;

    return {
      month: date?.month ?? "Undated",
      monthIndex,
      dateKey: date?.dateKey ?? "undated",
      product: String(get("product") ?? "All sales").trim() || "All sales",
      category: String(get("category") ?? "Other").trim() || "Other",
      region: String(get("region") ?? "Unknown").trim() || "Unknown",
      channel: String(get("channel") ?? "Unknown").trim() || "Unknown",
      units,
      revenue,
      cost,
    };
  }).filter((row) => row.revenue > 0 || row.units > 0);
}

function normalizeHeader(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function matchesHeader(field, header) {
  if (field === "date") return /date|datetime|timestamp/.test(header);
  if (field === "product") return /product|sku|item|description/.test(header);
  if (field === "category") return /category/.test(header);
  if (field === "region") return /region|territory|market|country/.test(header);
  if (field === "channel") return /channel|source/.test(header);
  if (field === "units") return /quantity|qty|units|items/.test(header);
  if (field === "revenue") {
    return /revenue|sales|turnover|gmv|amount|ordervalue/.test(header) &&
      !/channel|region|date|salesrep|salesperson|salesteam|salesmanager|unitprice|discount/.test(header);
  }
  if (field === "cost") return /cogs|cost/.test(header);
  if (field === "unitPrice") return /unitprice|priceperunit|sellingprice|saleprice/.test(header);
  if (field === "unitCost") return /unitcost|costperunit/.test(header);
  return false;
}

function parseNumber(value) {
  if (value == null || String(value).trim() === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  let text = String(value).trim();
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[^\d,.-]/g, "");
  if (!text || !/\d/.test(text)) return undefined;
  if (text.includes(",") && text.includes(".")) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = /,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  }

  const number = Number(text);
  if (!Number.isFinite(number)) return undefined;
  return negative ? -number : number;
}

function parseSalesDate(value) {
  if (value == null || String(value).trim() === "") return undefined;
  let year;
  let monthIndex;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    year = value.getFullYear();
    monthIndex = value.getMonth();
  } else if (typeof value === "number" && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    year = date.getUTCFullYear();
    monthIndex = date.getUTCMonth();
  } else {
    const text = String(value).trim();
    const fullDate = text.match(/^(\d{4})[-/](\d{1,2})[-/]\d{1,2}/);
    const yearMonth = text.match(/^(\d{4})[-/](\d{1,2})$/);
    const monthYear = text.match(/^([a-z]+)[\s,/-]+(\d{4})$/i);
    const monthName = text.slice(0, 3).toLowerCase();
    const namedMonthIndex = ALL_MONTHS.findIndex((month) => month.toLowerCase() === monthName);

    if (fullDate) {
      year = Number(fullDate[1]);
      monthIndex = Number(fullDate[2]) - 1;
    } else if (yearMonth) {
      year = Number(yearMonth[1]);
      monthIndex = Number(yearMonth[2]) - 1;
    } else if (monthYear && namedMonthIndex >= 0) {
      year = Number(monthYear[2]);
      monthIndex = namedMonthIndex;
    } else if (namedMonthIndex >= 0 && !/\d/.test(text)) {
      monthIndex = namedMonthIndex;
    } else {
      const date = new Date(text);
      if (!Number.isNaN(date.getTime())) {
        year = date.getFullYear();
        monthIndex = date.getMonth();
      }
    }
  }

  if (monthIndex == null || monthIndex < 0 || monthIndex > 11) return undefined;
  const month = ALL_MONTHS[monthIndex];
  return {
    month: year ? `${month} ${year}` : month,
    monthIndex,
    dateKey: year ? `${year}-${String(monthIndex + 1).padStart(2, "0")}` : `--${String(monthIndex + 1).padStart(2, "0")}`,
  };
}

function getPeriodKey(row) {
  if (row.dateKey) return row.dateKey;
  return row.monthIndex >= 0
    ? `--${String(row.monthIndex + 1).padStart(2, "0")}`
    : "undated";
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
