import express from "express";
import Customer from "../models/customer.js";
import { toPublic, toPublicList } from "../utils.js";

const router = express.Router();

function ok(res, data) {
  return res.json({ status: "success", data });
}

router.get("/", async (req, res, next) => {
  try {
    const customers = await Customer.find({}).lean();
    return ok(res, toPublicList(customers));
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, phone = "", address = "", panCard = "" } = req.body || {};
    if (!name) return res.status(400).json({ status: "error", message: "name is required" });
    const doc = await Customer.create({ name, phone, address, panCard });
    return res.status(201).json({ status: "success", data: toPublic(doc.toObject()) });
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const doc = await Customer.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ status: "error", message: "Customer not found" });
    return ok(res, toPublic(doc));
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const fields = {};
    if (req.body?.name !== undefined) fields.name = req.body.name;
    if (req.body?.phone !== undefined) fields.phone = req.body.phone;
    if (req.body?.address !== undefined) fields.address = req.body.address;
    if (req.body?.panCard !== undefined) fields.panCard = req.body.panCard;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ status: "error", message: "No fields to update" });
    }

    const doc = await Customer.findByIdAndUpdate(req.params.id, fields, {
      new: true,
      lean: true,
    });

    if (!doc) return res.status(404).json({ status: "error", message: "Customer not found" });
    return ok(res, toPublic(doc));
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await Customer.findByIdAndDelete(req.params.id).lean();
    if (!doc) return res.status(404).json({ status: "error", message: "Customer not found" });
    return ok(res, { id: req.params.id });
  } catch (err) {
    return next(err);
  }
});

export default router;
