import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { Order } from "../models/order.model.js";
import { getSocketIO } from "../socket.js";
import { Notification } from "../models/notification.model.js";

const scanQRCode = asyncHandler(async (req, res) => {
  const { orderId, token } = req.body;

  if (!orderId || !token) {
    throw new apiError(400, "OrderId and token are required");
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      pickupToken: token,
      qrUsed: false,
      status: "Ready",
    },
    {
      $set: {
        status: "Delivered",
        qrUsed: true,
        pickedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!order) {
    throw new apiError(400, "Invalid, expired or already used QR");
  }

  // Save notification
  const notification = await Notification.create({
    recipient: order.studentId,
    orderId: order._id,
    title: "Order Completed",
    message: "Your order has been successfully collected.",
    type: "ORDER_DELIVERED",
  });

  // Emit real-time update
  const io = getSocketIO();

  io.to(order.studentId.toString()).emit("orderStatusUpdated", {
    orderId: order._id,
    status: "Delivered",
  });

  io.to(order.studentId.toString()).emit("newNotification", {
    _id: notification._id,
    title: notification.title,
    message: notification.message,
    orderId: order._id,
  });

  return res
    .status(200)
    .json(new apiResponse(200, order, "QR verified, order delivered successfully"));
});

export { scanQRCode };
