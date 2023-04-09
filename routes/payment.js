import express from "express";
import { sendPayment } from "../utils/stripe";

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

export default router;
