import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      unique: true,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enun: ["Register Admin", "Password Reset"],
      required: true,
    },
  },
  { timestamps: true }
);

export const Otp = mongoose.model("Otp", otpSchema);
