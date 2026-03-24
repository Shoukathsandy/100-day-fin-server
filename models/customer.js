import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const CustomerSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    panCard: { type: String, default: "" },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

export default mongoose.model("Customer", CustomerSchema);
