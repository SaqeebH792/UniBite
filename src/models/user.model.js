import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
    },
    userName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["University Admin", "Canteen Admin"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);
userSchema.index(
  {
    universityId: 1,
    registrationNo: 1,
  },
  {
    unique: true,
  }
);
userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    return next();
  } catch (error) {
    return;
  }
});
// Check the Validity of Password
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      domain: this.domain,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
// Generate Refresh Token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};
export const UniversityAdmin = mongoose.model("UniversityAdmin", userSchema);
export const CanteenAdmin = mongoose.model("CanteenAdmin", userSchema);
