import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
// const { MessagingResponse } = require('twilio').twiml;

const sendText = async (to, body) => {
  try {
    // const result = await client.messages.create({
    //   body: body,
    //   from: "+16304071061",
    //   to: to,
    // });
  } catch (err) {
    console.log(err);
  }
};

export { sendText };
