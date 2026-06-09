import mongoose from "mongoose";

const universitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    domain: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
export const University = mongoose.model("University", universitySchema);
