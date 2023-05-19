import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const RestaurantSchema = new mongoose.Schema({
  rid: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
  },
  password: {
    type: String,
  },
  waitlist: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      data: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Data",
      },
      partySize: {
        type: Number,
      },
      partyReady: {
        type: Boolean,
      },
      notified: {
        type: Boolean,
        default: false,
      },
    },
  ],
  historyList: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      partySize: {
        type: Number,
      },
      actionType: {
        type: String,
      },
      timestamp: {
        type: Date,
      },
    },
  ],
  listings: [
    {
      seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      buyer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      stripeId: {
        type: String,
      },
      payment: {
        type: {
          type: String,
        },
        info: {
          type: String,
        },
      },
      price: {
        type: Number,
      },
      taken: {
        type: Boolean,
      },
    },
  ],
  waitlistActivated: {
    type: Boolean,
    default: true,
    required: true,
  },
  marketplaceActivated: {
    type: Boolean,
    default: false,
    required: true,
  },
  joinCount: {
    type: Number,
    default: 0,
  },
  removeCount: {
    type: Number,
    default: 0,
  },
});

export const Restaurant = mongoose.model("Restaurant", RestaurantSchema);

export function generateAuthToken(restaurant) {
  const token = jwt.sign(
    { _id: restaurant._id, rid: restaurant.rid, name: restaurant.name },
    process.env.JWT_PRIVATE_KEY
  );
  return token;
}
