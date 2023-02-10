import express from "express";
import stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const client = stripe(process.env.STRIPE_SECRET_TEST)
const router = express.Router();

/********************************************************************
 *                           Payment Routes                         *
 ********************************************************************/

router.post("/charge", async (req, res) => {
	let { amount, id } = req.body
	try {
		const payment = await client.paymentIntents.create({
			amount,
			currency: "USD",
			description: "Spatula company",
			payment_method: id,
			confirm: true
		})
		res.json({
			message: "Payment successful",
			success: true
		})
	} catch (error) {
		console.log("Payment error: ", error)
		res.json({
			message: "Payment failed",
			success: false
		})
	}
});

export default router;

