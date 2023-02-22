import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  /**************************************************************************
   *                           Account Information                          *
   **************************************************************************/
  name: {
    type: String,
    required: true,
    maxlength: 50,
  },
  phone: {
    type: String,
    required: true,
    length: 10,
    unique: true,
  },
  partySize: {
    type: Number,
    required: true,
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
  },
});

export const User = mongoose.model("User", UserSchema);
