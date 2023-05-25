import stripe from "stripe";
import axios from "axios";
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

const sendPayout = async (amount, receiver) => {
  let response = await axios.post(
    `https://api-m.sandbox.paypal.com/v1/oauth2/token`,
    {
      grant_type: "client_credentials",
    },
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
    }
  );

  // make Paypal API calls with your access token here!!
  const authToken = response.data.access_token;
  response = await axios.post(
    `https://api-m.sandbox.paypal.com/v1/payments/payouts`,
    {
      sender_batch_header: {
        recipient_type: "EMAIL",
        email_subject: "You have a payout!",
        email_message:
          "You have received a payout! Thanks for using our service!",
      },
      items: [
        {
          amount: {
            value: amount,
            currency: "USD",
          },
          receiver: receiver,
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    }
  );
  return response;
};

export { sendPayment, sendPayout };
