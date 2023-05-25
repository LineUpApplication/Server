import express from "express";
import { sendPayment, sendPayout } from "../utils/payment.js";

const router = express.Router();

/********************************************************************
 *                           Payment Routes                         *
 ********************************************************************/

router.post("/charge", async (req, res) => {
  let { amount, id } = req.body;
  try {
    await sendPayment(amount, id);
    res.status(200).send({
      message: "Payment successful",
      success: true,
    });
  } catch (error) {
    return res.status(400).send("Payment failed: " + err);
  }
});

router.post("/payout", async (req, res) => {
  try {
    await sendPayout(1, "sb-f2npg25455803@business.example.com")
    return res.status(200).send("bruh");
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

export default router;
