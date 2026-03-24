import express from "express";
import Loan from "../models/loan.js";
import Entry from "../models/entry.js";
import { toPublic, toPublicList } from "../utils.js";

const router = express.Router();

function ok(res, data) {
  return res.json({ status: "success", data });
}

function addDaysIso(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

function normalizeMoney(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  const EPS = 1e-6;
  if (Math.abs(value - rounded) <= EPS) return rounded;
  return null;
}

function getYearFromDate(dateStr) {
  if (typeof dateStr !== "string") return null;
  const yearMatch = dateStr.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);
  const month = Number(yearMatch[2]);
  const day = Number(yearMatch[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    return null;
  }
  return String(year);
}

async function generateNextLoanNumber(year) {
  const prefix = String(year);
  if (!/^\d{4}$/.test(prefix)) {
    throw new Error("Invalid year for loan number generation");
  }

  let seq = 1;
  while (seq < 10000) {
    const candidate = `${prefix}${String(seq).padStart(3, "0")}`;
    const found = await Loan.findOne({ loanNumber: candidate }).lean();
    if (!found) return candidate;
    seq += 1;
  }
  throw new Error("No available loan numbers for year");
}

router.get("/", async (req, res, next) => {
  try {
    const query = {};
    if (req.query.customerId) query.customerId = req.query.customerId;
    if (req.query.status) query.status = req.query.status;
    const loans = await Loan.find(query).lean();
    return ok(res, toPublicList(loans));
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      customerId,
      loanAmount,
      dailyAmount,
      totalDays = 100,
      startDate,
      endDate,
      loanNumber: requestedLoanNumber,
    } = req.body || {};

    if (!customerId || loanAmount === undefined || dailyAmount === undefined || !startDate || !endDate) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    const normLoanAmount = normalizeMoney(loanAmount);
    const normDailyAmount = normalizeMoney(dailyAmount);
    if (normLoanAmount === null || normDailyAmount === null) {
      return res.status(400).json({ status: "error", message: "loanAmount and dailyAmount must be integer rupees" });
    }

    const startYear = getYearFromDate(startDate);
    if (!startYear) {
      return res.status(400).json({ status: "error", message: "startDate must be ISO YYYY-MM-DD" });
    }

    let finalLoanNumber;

    if (requestedLoanNumber) {
      if (!/^\d{7}$/.test(requestedLoanNumber)) {
        return res.status(400).json({ status: "error", message: "loanNumber must be 7 digits (YYYYNNN)" });
      }

      if (requestedLoanNumber.slice(0, 4) !== startYear) {
        return res.status(400).json({ status: "error", message: "loanNumber year prefix must match startDate year" });
      }

      const existing = await Loan.findOne({ loanNumber: requestedLoanNumber }).lean();
      if (existing) {
        return res.status(409).json({ status: "error", message: "loanNumber already exists" });
      }
      finalLoanNumber = requestedLoanNumber;
    } else {
      finalLoanNumber = await generateNextLoanNumber(startYear);
    }

    const doc = await Loan.create({
      loanNumber: finalLoanNumber,
      customerId,
      loanAmount: normLoanAmount,
      dailyAmount: normDailyAmount,
      totalDays,
      startDate,
      endDate,
    });

    return res.status(201).json({ status: "success", data: toPublic(doc.toObject()) });
  } catch (err) {
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.loanNumber) {
      return res.status(409).json({ status: "error", message: "loanNumber already exists" });
    }
    return next(err);
  }
});

router.get("/next-number", async (req, res, next) => {
  try {
    const requestedYear = req.query.year || getYearFromDate(req.query.startDate) || new Date().getFullYear().toString();
    if (!/^[0-9]{4}$/.test(requestedYear)) {
      return res.status(400).json({ status: "error", message: "year query must be YYYY" });
    }

    const loanNumber = await generateNextLoanNumber(requestedYear);
    return ok(res, { loanNumber });
  } catch (err) {
    return next(err);
  }
});

router.post("/migrate-loan-numbers", async (req, res, next) => {
  try {
    const loansWithoutNumber = await Loan.find({ $or: [{ loanNumber: { $exists: false } }, { loanNumber: null }, { loanNumber: "" }] }).lean();
    let migrated = 0;

    for (const loan of loansWithoutNumber) {
      const year = getYearFromDate(loan.startDate || "");
      if (!year) continue;
      const number = await generateNextLoanNumber(year);
      await Loan.findByIdAndUpdate(loan._id, { loanNumber: number });
      migrated += 1;
    }

    return ok(res, { migrated, checked: loansWithoutNumber.length });
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const doc = await Loan.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ status: "error", message: "Loan not found" });
    return ok(res, toPublic(doc));
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const fields = {};
    ["loanAmount", "dailyAmount", "totalDays", "startDate", "endDate", "status"].forEach((k) => {
      if (req.body?.[k] !== undefined) fields[k] = req.body[k];
    });
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ status: "error", message: "No fields to update" });
    }
    if (fields.loanAmount !== undefined) {
      const norm = normalizeMoney(fields.loanAmount);
      if (norm === null) {
        return res.status(400).json({ status: "error", message: "loanAmount must be integer rupees" });
      }
      fields.loanAmount = norm;
    }
    if (fields.dailyAmount !== undefined) {
      const norm = normalizeMoney(fields.dailyAmount);
      if (norm === null) {
        return res.status(400).json({ status: "error", message: "dailyAmount must be integer rupees" });
      }
      fields.dailyAmount = norm;
    }
    const doc = await Loan.findByIdAndUpdate(req.params.id, fields, { new: true, lean: true });
    if (!doc) return res.status(404).json({ status: "error", message: "Loan not found" });
    return ok(res, toPublic(doc));
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id/close", async (req, res, next) => {
  try {
    const doc = await Loan.findByIdAndUpdate(
      req.params.id,
      { status: "closed" },
      { new: true, lean: true }
    );
    if (!doc) return res.status(404).json({ status: "error", message: "Loan not found" });
    return ok(res, toPublic(doc));
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id/extend", async (req, res, next) => {
  try {
    const days = Number(req.query.days);
    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ status: "error", message: "days must be > 0" });
    }
    const loan = await Loan.findById(req.params.id).lean();
    if (!loan) return res.status(404).json({ status: "error", message: "Loan not found" });

    const newEnd = addDaysIso(loan.endDate, days);
    const doc = await Loan.findByIdAndUpdate(
      req.params.id,
      { endDate: newEnd, totalDays: loan.totalDays + days },
      { new: true, lean: true }
    );
    return ok(res, toPublic(doc));
  } catch (err) {
    return next(err);
  }
});

router.get("/:loanId/entries", async (req, res, next) => {
  try {
    const entries = await Entry.find({ loanId: req.params.loanId }).lean();
    return ok(res, toPublicList(entries));
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await Entry.deleteMany({ loanId: req.params.id });
    const doc = await Loan.findByIdAndDelete(req.params.id).lean();
    if (!doc) return res.status(404).json({ status: "error", message: "Loan not found" });
    return ok(res, { id: req.params.id });
  } catch (err) {
    return next(err);
  }
});

export default router;
