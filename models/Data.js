import mongoose from "mongoose";

const DataSchema = new mongoose.Schema({
  /**************************************************************************
   *                     Training Data Information                          *
   **************************************************************************/
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  partySize: {
    type: Number,
    required: true,
  },
  placeInLine: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
  },
  actual: {
    type: Number,
  },
});

export const Data = mongoose.model("Data", DataSchema);
