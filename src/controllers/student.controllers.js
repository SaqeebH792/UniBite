import { Student, UploadedStudent } from "../models/student.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import fs from "fs";
import csv from "csv-parser";
import { Readable } from "stream";
import { generateAccessAndRefreshToken } from "../utils/generateAccessAndRefreshToken.js";
import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { getSocketIO } from "../socket.js";

const uploadStudents = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new apiError(400, "File is Required");
  }
  const students = [];

  const dataStream = Readable.from(req.file.buffer);

  await new Promise((resolve, reject) => {
    dataStream
      .pipe(csv())
      .on("data", row => {
        if (!row.fullName || !row.registrationNo || !row.email || !row.cnic || !row.session) {
          return;
        }

        students.push({
          fullName: row.fullName.trim(),
          registrationNo: row.registrationNo.trim().toLowerCase(),
          email: row.email.trim(),
          cnic: row.cnic.trim(),
          session: row.session,
          universityId: req.user.universityId,
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  if (!students.length) {
    throw new apiError(400, "CSV File is Empty");
  }

  const existingStudents = await Student.find({
    universityId: req.user.universityId,
    registrationNo: {
      $in: students.map(student => student.registrationNo),
    },
  });

  const existingRegistrationNos = new Set(existingStudents.map(student => student.registrationNo));

  const newStudents = students.filter(
    student => !existingRegistrationNos.has(student.registrationNo)
  );

  await UploadedStudent.insertMany(newStudents);

  return res.status(201).json(
    new apiResponse(
      201,
      {
        uploaded: newStudents.length,
        skipped: students.length - newStudents.length,
      },
      "Students uploaded successfully"
    )
  );
});

// ---------------------------------- Register Student -------------------------------------------------
const registerStudent = asyncHandler(async (req, res, next) => {
  const { registrationNo, cnic, email, password } = req.body;

  if (!registrationNo || !cnic || !email || !password) {
    throw new apiError(400, "All fields are Required");
  }
  // Check if Student is already Register
  const existingStudent = await Student.findOne({ registrationNo, cnic });
  if (existingStudent) {
    throw new apiError(400, "User already Registered");
  }
  // Validate the Student Registration No
  const studentRecord = await UploadedStudent.findOne({ registrationNo, cnic });
  if (!studentRecord) {
    throw new apiError("Invalid Registration No");
  }
  const session = studentRecord.session;
  const endYear = "20" + session.split("-")[1];

  const currentYear = new Date().getFullYear();

  if (currentYear > endYear) {
    throw new apiError(400, "Cannot Create Account! Session End");
  }
  const status = await studentRecord.isActive;
  if (status !== true) {
    throw new apiError(400, "Cannot Create Account! Session Expired");
  }
  // Save student data
  const student = await Student.create({
    registrationNo,
    cnic,
    email,
    password,
    universityId: studentRecord.universityId,
    isActive: true,
    isRegistered: true,
    session: session,
  });

  const createdStudet = await Student.findById(student._id).select("-password");

  res.status(201).json(new apiResponse(201, createdStudet, "Registration Successful"));
});

// ----------------------------- Login Student Controller -----------------------------------------

const loginStudent = asyncHandler(async (req, res, next) => {
  const { registrationNo, cnic, password } = req.body;
  if ((!registrationNo && !cnic) || (registrationNo && cnic)) {
    throw new apiError(400, "Please provide either registration number or CNIC, not both");
  }
  if (!password) {
    throw new apiError(400, "All Fields are Required");
  }
  // Check if user is Registered or Not
  const studentRecord = await Student.findOne({
    $or: [{ registrationNo }, { cnic }],
  });
  if (!studentRecord) {
    throw new apiError(400, "Invlid Credentials");
  }
  // if Student Exists Validate the Password
  const isPasswordValid = await studentRecord.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new apiError(400, "Invalid Credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    Student,
    studentRecord._id
  );

  const loggedInStudent = await Student.findById(studentRecord._id).select(
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
    .json(
      new apiResponse(200, { user: loggedInStudent, accessToken, refreshToken }, "Login Successful")
    );
});

// Get Food Items from Database

const getProducts = asyncHandler(async (req, res) => {
  const { search, category } = req.query;

  const filter = {
    universityId: req.user.universityId,
    isAvailable: true,
  };

  // Filter by category
  if (category) {
    filter.category = category;
  }

  // Search by name
  if (search) {
    filter.name = {
      $regex: search,
      $options: "i",
    };
  }

  const products = await Product.find(filter).sort({
    createdAt: -1,
  });

  return res.status(200).json(new apiResponse(200, products, "Products Fetched Successfully"));
});

// ----------------------------- Students Order Food ----------------------------------------
const orderFood = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new apiError(400, "Items are Required");
  }

  const prepTimeMap = {
    "Fast Food": 6,
    Drinks: 2,
    fries: 2,
    Snacks: 2,
    Desserts: 5,
  };

  let orderItems = [];
  let totalAmount = 0;
  let currentOrderTime = 0;

  // Check Items selected by Student for order
  for (const item of items) {
    if (!item.productId || !item.quantity) {
      throw new apiError(400, "Invalid Item Data");
    }

    const product = await Product.findById(item.productId);

    if (!product) {
      throw new apiError(404, "Product not found");
    }

    if (!product.isAvailable) {
      throw new apiError(400, `${product.name} is Not Available`);
    }

    // Let user Select Fast Food -> product.category gives Fast Food, -> prepTimeMap gives prepTimeMap(Fast Food)
    // How much time item Fast Food Takes
    const itemTime = (prepTimeMap[product.category] || 5) * item.quantity;
    currentOrderTime += itemTime;

    orderItems.push({
      productId: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: item.quantity,
    });

    totalAmount += product.price * item.quantity;
  }

  // Get all Pending orders
  const pendingOrders = await Order.find({
    universityId: req.user.universityId,
    status: "Pending",
  });

  let queueWorkload = 0;

  for (const order of pendingOrders) {
    for (const item of order.items) {
      const itemPrep = prepTimeMap[item.category] || 5; // Same like above explanation
      queueWorkload += itemPrep * item.quantity;
    }
  }

  // Estimated Time
  const estimatedTime = Math.ceil((queueWorkload + currentOrderTime) / 2);

  const order = await Order.create({
    studentId: req.user._id,
    universityId: req.user.universityId,
    items: orderItems,
    totalAmount,
    estimatedTime,
    status: "Pending",
  });

  const io = getSocketIO();

  io.emit("newOrder", {
    orderId: order._id,
    student: req.user.name,
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt,
  });

  return res.status(200).json(new apiResponse(200, order, "Order Created Successfully"));
});

// Order Cancellation if in Pending or Accepted State
const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);

  if (!order) {
    throw new apiError(404, "Order not found");
  }

  if (order.studentId.toString() !== req.user._id.toString()) {
    throw new apiError(403, "Not allowed");
  }

  if (!["Pending", "Accepted"].includes(order.status)) {
    throw new apiError(400, "Order cannot be cancelled at this stage");
  }

  order.status = "Cancelled";
  await order.save();

  const io = getSocketIO();

  io.to(order.studentId.toString()).emit("orderStatusUpdated", {
    orderId: order._id,
    status: "Cancelled",
  });

  return res.status(200).json(new apiResponse(200, order, "Order cancelled successfully"));
});
export { uploadStudents, registerStudent, loginStudent, getProducts, orderFood, cancelOrder };
/*



















































*/
// const { items } = req.body;
//   if (!items || items.length === 0) {
//     throw new apiError(400, "Order Items are Required");
//   }

//   let totalAmount = 0;
//   const orderItems = [];

//   for (const item of items) {
//     const product = await Product.findById(item.productId);
//     if (!product) {
//       throw new apiError(400, "Product not Found");
//     }
//     if (!product.isAvailable) {
//       throw new apiError(400, `${product.name} is Not Available`);
//     }
//     orderItems.push({
//       productId: product._id,
//       quantity: item.quantity,
//       price: item.price,
//       name: item.name,
//       category: item.category,
//     });
//     totalAmount += item.price * item.quantity;
//   }

//   const order = Order.create({
//     universityId: req.user.universityId,
//     studentId: req.user._id,
//     items: orderItems,
//     amount: totalAmount,
//   });
