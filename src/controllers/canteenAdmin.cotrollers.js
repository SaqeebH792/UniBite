import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { CanteenAdmin } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { generateAccessAndRefreshToken } from "../utils/generateAccessAndRefreshToken.js";

const loginCanteenAdmin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new apiError(400, "All Fields are Required");
  }
  // Check if user is Registered with Email
  const canteenAdminRecord = await CanteenAdmin.findOne({ email });
  if (!canteenAdminRecord) {
    throw new apiError(400, "Invalid Credentials");
  }
  // If Record Found Validate Password
  const isPasswordValid = await canteenAdminRecord.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new apiError(400, "Invalid Credentials");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    CanteenAdmin,
    canteenAdminRecord._id
  );

  console.log("Access Token: ", accessToken);
  console.log("Refresh Token", refreshToken);
  const loggedInUser = await CanteenAdmin.findById(canteenAdminRecord._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new apiResponse(200, { user: loggedInUser, accessToken, refreshToken }));
});

// Canteen Admin List Products

const listProduct = asyncHandler(async (req, res, next) => {
  const { name, price, category } = req.body;
  if (!price || !name || !category) {
    throw new apiError(400, "All Fields are Required");
  }

  const imageLocalPath = req.file?.path;
  if (!imageLocalPath) {
    throw new apiError(400, "Image is Required");
  }
  const image = await uploadOnCloudinary(imageLocalPath);
  if (!image) {
    throw new apiError(400, "Image is Required");
  }
  // Upload Data in Database
  const product = await Product.create({
    name,
    category,
    price,
    image: image.url,
    canteenAdminId: req.user._id,
    universityId: req.user.universityId,
  });

  res.status(200).json(200, new apiResponse(200, product, "Uploaded Successfully"));
});

const getOrders = asyncHandler(async (req, res, next) => {
  // Get ordered Items by the Students
  const { status, category } = req.query;
  const filter = {
    universityId: req.user.universityId,
  };
  // default Product Status
  filter.status = status || "Pending";

  if (category) {
    filter["items.category"] = category;
  }

  const orders = await Order.find(filter)
    .populate("studentId", "registrationNo")
    .sort({ createdAt: -1 });

  return res.status(200).json(new apiResponse(200, orders, "Orders fetched successfully"));
});

// Update Status
const updateStatus = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const { status } = req.body;

  // Allowed statuses
  const allowedStatuses = ["Pending", "Accepted", "Preparing", "Ready", "Delivered"];

  if (!status || !allowedStatuses.includes(status)) {
    throw new apiError(400, "Invalid order status");
  }
  const order = await Order.findById(orderId);

  if (!order) {
    throw new apiError(404, "Order not found");
  }
  // Ensure only Order change that belongs to Logged in University Canteen Admin
  if (order.universityId.toString() !== req.user.universityId.toString()) {
    throw new apiError(403, "Not allowed to update this order");
  }

  const statusFlow = {
    Pending: 1,
    Accepted: 2,
    Preparing: 3,
    Ready: 4,
    Delivered: 5,
  };

  if (statusFlow[status] < statusFlow[order.status]) {
    throw new apiError(400, "Cannot move status backwards");
  }

  // Update status
  order.status = status;
  await order.save({ validateBeforeSave: false });

  return res.status(200).json(new apiResponse(200, order, "Order status updated successfully"));
});
export { loginCanteenAdmin, listProduct, getOrders, updateStatus };
