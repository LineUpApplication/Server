import mongoose from "mongoose";
import { sendText } from "../utils/twilio.js";
import { User } from "./User.js";

const RestaurantSchema = new mongoose.Schema({
  name: {
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
  }
});

export const Restaurant = mongoose.model("Restaurant", RestaurantSchema);

Restaurant.watch().on("change", async (data) => {
  // mongodb listener
});
