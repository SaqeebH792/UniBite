import mongoose from "mongoose";
import bcrypt from "bcrypt";

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

studentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  return;
});
// Compare Password
studentSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};
// Generate Access Token

// Generate Refresh Token
export const Student = mongoose.model("Student", studentSchema);
export const UploadedStudent = mongoose.model("UploadedStudent", studentSchema);
