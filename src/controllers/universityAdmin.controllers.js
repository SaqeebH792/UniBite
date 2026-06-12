import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { CanteenAdmin, UniversityAdmin } from "../models/user.model.js";
import { Otp } from "../models/otp.model.js";
import { University } from "../models/university.model.js";
import { generateAccessAndRefreshToken } from "../utils/generateAccessAndRefreshToken.js";

const sendOtp = async function (code, email) {
  console.log(`OTP ${code} sent to email ${email}`);
};

// OTP Request to Register Account
const requestOtp = asyncHandler(async (req, res, next) => {
  const { domain, email, name } = req.body;

  if (!domain || !email || !name) {
    throw new apiError(400, "All Fields are Required");
  }

  // Check if University Admin with Domain or Email is already Reigistered
  const existingUniversityAdmin = await UniversityAdmin.findOne({ domain, email });
  if (existingUniversityAdmin) {
    throw new apiError(400, "Already Registered");
  }

  const existingOtpRecord = await Otp.findOne({ email });
  if (existingOtpRecord) {
    await Otp.deleteMany({ email });
  }

  // Check if Domain is Valid
  const emailDomain = email.split("@")[1];
  if (domain !== emailDomain) {
    throw new apiError(400, "Domain is not Valid");
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  const otpRecord = await Otp.create({
    domain,
    email,
    name,
    code: otp,
    type: "Admin Registration",
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const createdOtpRecord = await Otp.findById(otpRecord._id).select("-code");
  sendOtp(otp, email);

  res.status(201).json(new apiResponse(201, createdOtpRecord, "OTP sent"));
});

// Register University Admin After OTP Verification

const registerUniAdmin = asyncHandler(async (req, res, next) => {
  const { email, password, otp } = req.body;
  if (!email || !password || !otp) {
    throw new apiError(400, "All Fields are Required");
  }
  const otpRecord = await Otp.findOne({ email });
  if (!otpRecord) {
    throw new apiError(400, "Record not found");
  }
  if (otpRecord.expiresAt < Date.now()) {
    throw new apiError(400, "OTP is not valid or expired");
  }
  if (otp !== otpRecord.code) {
    throw new apiError(400, "OTP is not Valid or Expired");
  }

  // Check if University created with this Email & Domain
  let existingUniversity = await University.findOne({ email });
  if (!existingUniversity) {
    existingUniversity = await University.create({
      email,
      domain: otpRecord.domain,
      name: otpRecord.name,
    });
  }
  const existingUniAdmin = await UniversityAdmin.findOne({ email });
  if (existingUniAdmin) {
    throw new apiError(400, "Already Registered");
  }
  const universityAdmin = await UniversityAdmin.create({
    universityId: existingUniversity._id,
    domain: existingUniversity.domain,
    email,
    password,
    role: "University Admin",
  });
  await Otp.deleteMany({ email });
  const createdUniAdmin = await UniversityAdmin.findById(universityAdmin._id).select("-password");
  res.status(201).json(new apiResponse(201, createdUniAdmin, "Registration Successful"));
});

// Login University Admin

const loginUniAdmin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new apiError(400, "All fields are Required");
  }
  // Check if User is Registere
  const registeredUniAdmin = await UniversityAdmin.findOne({ email });
  if (!registeredUniAdmin) {
    throw new apiError(400, "Invalid Credentials");
  }
  // Validate Password
  const isPasswordValid = await registeredUniAdmin.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new apiError(400, "Invalid Credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    UniversityAdmin,
    registeredUniAdmin._id
  );
  const loggedInUser = await UniversityAdmin.findById(registeredUniAdmin._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(201, { user: loggedInUser, accessToken, refreshToken }, "Login Successful")
    );
});

// Canteen Admin Registration ---------------> By University Admin

const registerCanteenAdmin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new apiError(400, "All fields are Required");
  }
  // Check if Canteen Admin is Registered
  const existingCanteenAdmin = await CanteenAdmin.findOne({ email });
  if (existingCanteenAdmin) {
    throw new apiError(400, "Already Registered");
  }

  // Save Canteen Admin Data in Canteen Admin Collection
  const canteenAdmin = await CanteenAdmin.create({
    email,
    password,
    role: "Canteen Admin",
    // university: req.user.name, // Save The University Name
    universityId: req.user.universityId,
  });

  const createdCanteenAdmin = await CanteenAdmin.findById(canteenAdmin._id).select("-password");
  res.status(201).json(new apiResponse(201, createdCanteenAdmin, "Admin Registered Successfully"));
});
export { requestOtp, registerUniAdmin, loginUniAdmin, registerCanteenAdmin };
