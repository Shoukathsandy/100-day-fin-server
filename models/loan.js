import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const LoanSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    loanNumber: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
      match: [/^\d{7}$/, "loanNumber must be YYYYNNN"],
    },
    customerId: { type: String, required: true, index: true },
    loanAmount: { type: Number, required: true },
    dailyAmount: { type: Number, required: true },
    totalDays: { type: Number, default: 100 },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: { type: String, enum: ["active", "closed"], default: "active", index: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

export default mongoose.model("Loan", LoanSchema);
