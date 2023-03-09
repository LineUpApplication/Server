import express from "express";
import { connectDB } from "./utils/db.js";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

// Connect to MongoDB database
(async () => await connectDB())();

const app = express();
const corsOptions ={
  origin:'*', 
  credentials:true,            //access-control-allow-credentials:true
  optionSuccessStatus:200
}
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// Routers
import  home from "./routes/home.js";
import restaurant from "./routes/restaurant.js";
import payment from "./routes/payment.js";
import { update } from "./utils/ml.js";

// middleware
app.use(express.json());

// Routes
app.use("/", home);
app.use("/restaurant", restaurant);
app.use("/payment", payment);

//Listener for Msg
// app.post('/message', (req, res) => {
//   console.log(req.body);
//   msgBody = req.body.Body;

// })


export default app;
