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
    } = req.body || {};

    if (!customerId || loanAmount === undefined || dailyAmount === undefined || !startDate || !endDate) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    const doc = await Loan.create({
      customerId,
      loanAmount,
      dailyAmount,
      totalDays,
      startDate,
      endDate,
    });

    return res.status(201).json({ status: "success", data: toPublic(doc.toObject()) });
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
