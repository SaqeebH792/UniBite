import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { authPlugin } from "../utils/authPlugin.js";

const studentSchema = new mongoose.Schema(
  {
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
      required: true,
    },
    registrationNo: {
      type: String,
      required: true,
    },
    cnic: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: function () {
        return this.constructor.modelName === "Student";
      },
    },
    session: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

studentSchema.index(
  {
    universityId: 1,
    registrationNo: 1,
  },
  {
    unique: true,
  }
);

studentSchema.plugin(authPlugin, { tokenFields: ["registraionNo", "email"] });

export const Student = mongoose.model("Student", studentSchema);
export const UploadedStudent = mongoose.model("UploadedStudent", studentSchema);
