import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const twiml = twilio.twiml;
const { MessagingResponse } = twiml;

const sendText = async (to, body) => {
  try {
    const result = await client.messages.create({
      body: body,
      from: "+16304071061",
      to: to,
    });
    console.log(result)
  } catch (err) {
    console.log(err);
  }
};


const sendInitText = (phone, name, restaurantName, userId) => {
  sendText(
    "+1" + phone,
    `Hello, ${name}! This is a confirmation of your place in line for ${restaurantName}. Check the updated estimated wait time at https://line-up-usersite.herokuapp.com/${userId}`
  );
};

const sendAlmostText = (phone, restaurantName) => {
  sendText(
    phone,
    `Your table is almost ready at ${restaurantName}. Please return to the restaurant so the host can seat you soon`
  );
};

const sendFrontText = (phone, restaurantName) => {
  sendText(
    phone,
    `Your table is ready at ${restaurantName}. Please checkin with the host so we can seat you as soon as possible`
  );
};

const messageResponder = (req) => {
  const twiml = new MessagingResponse();
  const {From, Body} = req.body;
  return {responder: twiml, from: From, body: Body};
}

export { sendInitText, sendAlmostText, sendFrontText, messageResponder };
