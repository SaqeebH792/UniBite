import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    items: [
      {
        name: {
          type: String, // Order Name is Required like Burger, fries, Cold Drinks etc
          required: true,
        },
        category: {
          type: String,
          required: true,
        },
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Preparing", "Ready", "Delivered"],
      default: "Pending",
    },
    pickupToken: {
      type: String,
    },
    qrCodeUrl: {
      type: String,
    },
    pickedUpAt: {
      type: Date,
    },
    qrUsed: {
      type: Boolean,
      default: false,
    },
    queuePosition: {
      type: Number,
      default: 0,
    },

    estimatedTime: {
      type: Number, // in minutes
      default: 0,
    },
  },

  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
