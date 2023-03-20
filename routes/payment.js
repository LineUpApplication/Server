import express from "express";
import stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const client = stripe(process.env.STRIPE_SECRET_TEST);
const router = express.Router();

/********************************************************************
 *                           Payment Routes                         *
 ********************************************************************/

router.post("/charge", async (req, res) => {
  let { amount, id } = req.body;
  try {
    const payment = await client.paymentIntents.create({
      amount,
      currency: "USD",
      description: "Spatula company",
      payment_method: id,
      confirm: true,
    });
    res.status(200);
  } catch (error) {
    return res.status(400).send("Payment failed: " + err);
  }
});

export default router;
