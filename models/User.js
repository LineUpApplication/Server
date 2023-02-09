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
    unique: true,
    required: true,
    length: 10,
  },
});

export const User = mongoose.model("User", UserSchema);
