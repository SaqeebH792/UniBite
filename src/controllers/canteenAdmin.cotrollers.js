import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { CanteenAdmin } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { generateAccessAndRefreshToken } from "../utils/generateAccessAndRefreshToken.js";
import { Notification } from "../models/notification.model.js";
import { getSocketIO } from "../socket.js";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";

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

export const getOrders = asyncHandler(async (req, res) => {
  const { status, category, search } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Base filter
  const filter = {
    universityId: req.user.universityId,
  };

  if (status) {
    filter.status = status;
  } else {
    filter.status = "Pending";
  }

  if (category) {
    filter["items.category"] = category;
  }

  // ----------------------------
  // BUILD SEARCH FILTER
  // ----------------------------
  let searchMatch = {};

  if (search) {
    searchMatch = {
      $or: [
        { "student.registrationNo": { $regex: search, $options: "i" } },
        { "student.name": { $regex: search, $options: "i" } },
      ],
    };
  }

  // ----------------------------
  // AGGREGATION PIPELINE
  // ----------------------------
  const orders = await Order.aggregate([
    {
      $match: {
        universityId: new mongoose.Types.ObjectId(req.user.universityId),
        ...(status ? { status } : { status: "Pending" }),
        ...(category ? { "items.category": category } : {}),
      },
    },

    // Join with student collection
    {
      $lookup: {
        from: "Students",
        localField: "studentId",
        foreignField: "_id",
        as: "student",
      },
    },

    {
      $unwind: "$student",
    },

    // SEARCH STAGE
    {
      $match: search
        ? {
            $or: [
              {
                "student.registrationNo": {
                  $regex: search,
                  $options: "i",
                },
              },
              {
                "student.name": {
                  $regex: search,
                  $options: "i",
                },
              },
            ],
          }
        : {},
    },

    // SORT LATEST FIRST
    {
      $sort: { createdAt: -1 },
    },

    // PAGINATION
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },

    // CLEAN OUTPUT
    {
      $project: {
        student: {
          name: 1,
          registrationNo: 1,
        },
        items: 1,
        status: 1,
        createdAt: 1,
      },
    },
  ]);

  // TOTAL COUNT (for pagination)
  const totalOrders = await Order.aggregate([
    {
      $match: {
        universityId: new mongoose.Types.ObjectId(req.user.universityId),
        ...(status ? { status } : { status: "Pending" }),
        ...(category ? { "items.category": category } : {}),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "studentId",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    ...(search
      ? [
          {
            $match: {
              $or: [
                {
                  "student.registrationNo": {
                    $regex: search,
                    $options: "i",
                  },
                },
                {
                  "student.name": {
                    $regex: search,
                    $options: "i",
                  },
                },
              ],
            },
          },
        ]
      : []),
    { $count: "total" },
  ]);

  const total = totalOrders[0]?.total || 0;

  return res.status(200).json(
    new apiResponse(
      200,
      {
        orders,
        pagination: {
          totalOrders: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
      "Orders fetched successfully"
    )
  );
});

// Update Status, Generate QR Code and Send Notification when Status Changes
export const updateStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const allowedStatuses = ["Pending", "Accepted", "Preparing", "Ready", "Delivered"];

  if (!allowedStatuses.includes(status)) {
    throw new apiError(400, "Invalid status");
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw new apiError(404, "Order not found");
  }

  if (order.universityId.toString() !== req.user.universityId.toString()) {
    throw new apiError(403, "Not allowed");
  }

  // Prevent backward movement
  const flow = {
    Pending: 1,
    Accepted: 2,
    Preparing: 3,
    Ready: 4,
    Delivered: 5,
  };

  if (flow[status] < flow[order.status]) {
    throw new apiError(400, "Cannot move status backwards");
  }

  if (status === order.status) {
    throw new apiError(400, "Order already in this status");
  }

  order.status = status;

  let qrCodeUrl = order.qrCodeUrl;

  // QR GENERATION (ONLY ON ACCEPTED)
  if (status === "Accepted" && !order.pickupToken) {
    const pickupToken = `ORD-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

    order.pickupToken = pickupToken;
    order.qrUsed = false;

    const qrPayload = JSON.stringify({
      orderId: order._id,
      token: pickupToken,
      universityId: order.universityId,
    });

    const filePath = path.join(process.cwd(), "public", "temp", `qr-${order._id}.png`);

    await QRCode.toFile(filePath, qrPayload);

    const uploaded = await uploadOnCloudinary(filePath);

    if (!uploaded) {
      throw new apiError(500, "QR upload failed");
    }

    qrCodeUrl = uploaded.secure_url;
    order.qrCodeUrl = qrCodeUrl;
  }

  // QR USAGE VALIDATION DON'T USE AGAIN
  if (status === "Delivered") {
    if (order.qrUsed) {
      throw new apiError(400, "QR already used");
    }

    order.qrUsed = true;
  }

  await order.save({ validateBeforeSave: false });
  // NOTIFICATION SYSTEM
  const messages = {
    Accepted: {
      title: "Order Accepted",
      message: "Your order has been accepted.",
    },
    Preparing: {
      title: "Order Preparing",
      message: "Your food is being prepared.",
    },
    Ready: {
      title: "Order Ready",
      message: "Your order is ready for pickup.",
    },
    Delivered: {
      title: "Order Delivered",
      message: "Order has been completed successfully.",
    },
  };

  const notifyData = messages[status];

  let notification = null;

  if (notifyData) {
    notification = await Notification.create({
      recipient: order.studentId,
      orderId: order._id,
      title: notifyData.title,
      message: notifyData.message,
      type: `ORDER_${status.toUpperCase()}`,
    });
  }

  // SOCKET.IO EMIT
  const io = getSocketIO();

  io.to(order.studentId.toString()).emit("orderStatusUpdated", {
    orderId: order._id,
    status: order.status,
  });

  if (notification) {
    io.to(order.studentId.toString()).emit("newNotification", {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      orderId: order._id,
      qrCodeUrl: order.qrCodeUrl || null,
      createdAt: notification.createdAt,
    });
  }

  return res.status(200).json(
    new apiResponse(
      200,
      {
        order,
        qrCodeUrl: order.qrCodeUrl,
      },
      "Order status updated successfully"
    )
  );
});
export { loginCanteenAdmin, listProduct, getOrders, updateStatus };
