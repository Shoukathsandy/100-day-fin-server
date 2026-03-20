import express from "express";
import Entry from "../models/entry.js";
import { toPublic, toPublicList } from "../utils.js";

const router = express.Router();

function ok(res, data) {
  return res.json({ status: "success", data });
}

router.get("/", async (req, res, next) => {
  try {
    const query = {};
    if (req.query.loanId) query.loanId = req.query.loanId;
    const entries = await Entry.find(query).lean();
    return ok(res, toPublicList(entries));
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { loanId, date, amount, type, note = null } = req.body || {};
    if (!loanId || !date || amount === undefined || !type) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    const existing = await Entry.findOne({ loanId, date }).lean();
    if (existing) {
      return res.status(409).json({
        status: "error",
        message: `Entry for ${date} already exists on this loan`,
      });
    }

    const doc = await Entry.create({ loanId, date, amount, type, note });
    return res.status(201).json({ status: "success", data: toPublic(doc.toObject()) });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({
        status: "error",
        message: "Entry for this date already exists on this loan",
      });
    }
    return next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const fields = {};
    if (req.body?.amount !== undefined) fields.amount = req.body.amount;
    if (req.body?.type !== undefined) fields.type = req.body.type;
    if (req.body?.note !== undefined) fields.note = req.body.note;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ status: "error", message: "No fields to update" });
    }

    const doc = await Entry.findByIdAndUpdate(req.params.id, fields, { new: true, lean: true });
    if (!doc) return res.status(404).json({ status: "error", message: "Entry not found" });
    return ok(res, toPublic(doc));
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await Entry.findByIdAndDelete(req.params.id).lean();
    if (!doc) return res.status(404).json({ status: "error", message: "Entry not found" });
    return ok(res, { id: req.params.id });
  } catch (err) {
    return next(err);
  }
});

export default router;
