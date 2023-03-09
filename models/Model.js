import mongoose from "mongoose";

const ModelSchema = new mongoose.Schema({
  /**************************************************************************
   *                          ML Model Information                          *
   **************************************************************************/
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  w1: {
    type: Number,
    required: true,
  },
  w2: {
    type: Number,
    required: true,
  },
  b: {
    type: Number,
    required: true,
  },
});

export const Model = mongoose.model("Model", ModelSchema);
