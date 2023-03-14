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
    },
  ],
  linepassCount: {
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
