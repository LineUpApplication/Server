import mongoose from "mongoose";

const RestaurantSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  waitlist: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

export const Restaurant = mongoose.model("Restaurant", RestaurantSchema);

Restaurant.watch().on("change", async (data) => {
  // mongodb listener
});
