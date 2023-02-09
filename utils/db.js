import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
  let db;
  if (process.env.NODE_ENV === "production") {
    db = process.env.DB;
  } else {
    db = process.env.DEV_DB;
  }

  console.log("database url:" + db);

  await mongoose
    .connect(db)
    .then(() => {
      console.log("Connected to MongoDB...");
    })
    .catch((err) => console.log(err));
};

export { connectDB };
