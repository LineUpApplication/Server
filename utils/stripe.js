import stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const client = stripe(process.env.STRIPE_SECRET_KEY);

const sendPayment = async (amount, id) => {
  return await client.paymentIntents.create({
    amount,
    currency: "USD",
    description: "LineUp",
    payment_method: id,
    confirm: true,
  });
};

export { sendPayment };
