import express from "express";
import Customer from "../models/customer.js";
import Loan from "../models/loan.js";
import Entry from "../models/entry.js";
import { toPublicList } from "../utils.js";

const router = express.Router();

function isoToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIsoDate(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

router.get("/stats", async (req, res, next) => {
  try {
    const [customersRaw, loansRaw, entriesRaw] = await Promise.all([
      Customer.find({}).lean(),
      Loan.find({}).lean(),
      Entry.find({}).lean(),
    ]);

    const customers = toPublicList(customersRaw);
    const loans = toPublicList(loansRaw);
    const entries = toPublicList(entriesRaw);

    const todayStr = isoToday();
    const activeLoans = loans.filter((l) => l.status === "active");

    const totalDisbursed = loans.reduce((sum, l) => sum + l.loanAmount, 0);
    const totalCollected = entries
      .filter((e) => e.type === "payment" || e.type === "adjustment")
      .reduce((sum, e) => sum + e.amount, 0);

    let totalPending = 0;
    for (const l of activeLoans) {
      const paid = entries
        .filter((e) => e.loanId === l.id && (e.type === "payment" || e.type === "adjustment"))
        .reduce((sum, e) => sum + e.amount, 0);
      totalPending += Math.max(0, l.loanAmount - paid);
    }

    const overdue = activeLoans.filter((l) => todayStr > l.endDate);
    const todayTotal = entries
      .filter((e) => e.date === todayStr && e.type === "payment")
      .reduce((sum, e) => sum + e.amount, 0);

    const dueToday = activeLoans.filter(
      (l) => !entries.some((e) => e.loanId === l.id && e.date === todayStr)
    );

    const cmap = new Map(customers.map((c) => [c.id, c]));
    const dueTodayEnriched = dueToday.map((l) => ({
      ...l,
      customerName: cmap.get(l.customerId)?.name || "",
      customerPhone: cmap.get(l.customerId)?.phone || "",
    }));

    return res.json({
      status: "success",
      data: {
        totalDisbursed,
        totalCollected,
        totalPending,
        customerCount: customers.length,
        loanCount: loans.length,
        activeLoanCount: activeLoans.length,
        overdueLoanCount: overdue.length,
        todayTotal,
        dueTodayLoans: dueTodayEnriched,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/daily", async (req, res, next) => {
  try {
    const toDate = req.query.to ? parseIsoDate(req.query.to) : parseIsoDate(isoToday());
    const fromDate = req.query.from
      ? parseIsoDate(req.query.from)
      : new Date(toDate.getTime() - 6 * 24 * 60 * 60 * 1000);

    const entries = await Entry.find({
      type: "payment",
      date: { $gte: formatIsoDate(fromDate), $lte: formatIsoDate(toDate) },
    }).lean();

    const buckets = {};
    const cur = new Date(fromDate.getTime());
    while (cur <= toDate) {
      buckets[formatIsoDate(cur)] = 0;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    for (const e of entries) {
      if (buckets[e.date] !== undefined) buckets[e.date] += e.amount;
    }

    const result = Object.keys(buckets).map((k) => ({
      date: k.slice(5),
      amount: buckets[k],
    }));

    return res.json({ status: "success", data: result });
  } catch (err) {
    return next(err);
  }
});

export default router;
