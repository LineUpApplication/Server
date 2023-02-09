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
      partySize: {
        type: Number,
      },
    },
  ],
});

export const Restaurant = mongoose.model("Restaurant", RestaurantSchema);

Restaurant.watch().on("change", async (data) => {
  try {
    const restaurant = await Restaurant.findById(data.documentKey._id);
    if (restaurant.waitlist.length > 1) {
      const user = await User.findById(restaurant.waitlist[1]);
      sendText(user.phone, "You are almost there.")
    }
    if (restaurant.waitlist.length > 0) {
      const user = await User.findById(restaurant.waitlist[0]);
      sendText(user.phone, "Your place in line is ready.")
    } 
  } catch (error) {
    // console.log(error);
  }
});
