import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const EntrySchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    loanId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["payment", "missed", "adjustment"],
      required: true,
    },
    note: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

EntrySchema.index({ loanId: 1, date: 1 }, { unique: true });

export default mongoose.model("Entry", EntrySchema);
