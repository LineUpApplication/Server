import express from "express";
import { Restaurant } from "../models/Restaurant.js";
import { User } from "../models/User.js";
import { sendText } from "../utils/twilio.js";
import { sendPayment } from "../utils/stripe.js";

const router = express.Router();

const send_pay_now_msg = async (phone, name, payment, amount) => {
  await sendText(
    phone,
    `${name} has sold their position for $${amount} and sucessfully checked in. ${payment.type}: ${payment.info}`
  );
};

const send_position_sold_msg = async (phone, restaurant, position) => {
  if (rid == "kaiyuexuan" || rid == "spicycity") {
    await sendText(
      phone,
      `Your position at ${restaurant} has been sold, you have been moved to position ${position}, you will receive your payment once you've checked in at the restaurant. 您在${restaurant}餐厅等候名单中出售的位置已经售出，您当前在队列中排第${position}位。您会于30分钟之内收到此次交易的首款。`
    );
  } else {
    await sendText(
      phone,
      `Your position at ${restaurant} has been sold, you have been moved to position ${position}, you will receive your payment once you've checked in at the restaurant.`
    );
  }
};

const send_position_bought_msg = async (phone, restaurant, position) => {
  if (rid == "kaiyuexuan" || rid == "spicycity") {
    await sendText(
      phone,
      `Someone has taken your request to swap position at ${restaurant}, you have been moved to position ${position}, enjoy! 有人同意了您在${restaurant}餐厅交换等候名单位置的请求，您当前在队列中排第${position}位。祝您用餐愉快！`
    );
  } else {
    await sendText(
      phone,
      `Someone has taken your request to swap position at ${restaurant}, you have been moved to position ${position}, enjoy!`
    );
  }
};

router.get("/getListings/:rid", async (req, res) => {
  try {
    const rid = req.params.rid;
    const restaurant = await Restaurant.findOne({ rid: rid });
    let result = [];
    restaurant.listings = restaurant.listings.filter((listingInfo) => {
      const index = restaurant.waitlist
        .map((userInfo) => userInfo.user.toString())
        .indexOf(listingInfo.user.toString());
      if (index >= 0) {
        result.push({ ...listingInfo, place: index + 1 });
      }
      return !listingInfo.taken && index >= 0;
    });
    await restaurant.save();
    result.sort((listingInfo) => listingInfo.place);
    return res.status(200).send(result);
  } catch (error) {
    return res.status(400).send(error);
  }
});

router.post("/listPosition", async (req, res) => {
  try {
    const { rid, id, price, stripeId } = req.body;
    const restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    const waitlistIndex = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(id);
    if (waitlistIndex < 0) {
      return res.status(400).send("User not in waitlist.");
    }
    const listingIndex = restaurant.listings
      .map((listingInfo) => listingInfo.user.toString())
      .indexOf(id);
    const listing = {
      buyer: id,
      price: price,
      taken: false,
      stripeId: stripeId,
    };
    if (listingIndex < 0) {
      restaurant.listings.push(listing);
    } else {
      restaurant.listings[listingIndex] = listing;
    }
    await restaurant.save();
    return res.status(200).send(restaurant.listings);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/swapPosition", async (req, res) => {
  try {
    const { buyerId, sellerId, payment } = req.body.swapInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const listingIndex = restaurant.listings
      .map((listingInfo) => listingInfo.user.toString())
      .indexOf(buyerId);
    if (listingIndex < 0 || restaurant.listings[listingIndex].taken) {
      return res.status(400).send("Listing not found.");
    }
    const waitlistSellerIndex = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(sellerId);
    if (waitlistSellerIndex < 0) {
      return res.status(400).send("Seller not in waitlist.");
    }
    const waitlistBuyerIndex = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(buyerId);
    if (waitlistBuyerIndex < 0) {
      return res.status(400).send("Buyer not in waitlist.");
    }
    const sellerInfo = restaurant.waitlist[waitlistSellerIndex];
    const buyerInfo = restaurant.waitlist[waitlistBuyerIndex];
    restaurant.waitlist[waitlistSellerIndex] = buyerInfo;
    restaurant.waitlist[waitlistBuyerIndex] = sellerInfo;
    await sendPayment(
      restaurant.listings[listingIndex].price,
      restaurant.listings[listingIndex].stripeId
    );
    restaurant.listings[listingIndex].taken = true;
    await restaurant.save();
    const buyer = await User.findById(buyerId);
    if (waitlistSellerIndex <= 1) {
      await send_almost_msg(rid, buyer.phone, restaurant.name);
    }
    const seller = await User.findById(sellerId);
    if (waitlistSellerIndex == 0) {
      await send_front_msg(buyer.phone, restaurant.name);
    } else if (waitlistSellerIndex == 1) {
      await send_almost_msg(buyer.phone, restaurant.name);
    }
    await send_position_bought_msg(
      buyer.phone,
      restaurant.name,
      waitlistSellerIndex + 1
    );
    await send_position_sold_msg(
      seller.phone,
      restaurant.name,
      waitlistBuyerIndex + 1
    );
    await send_pay_now_msg(
      "9495298312",
      seller.name,
      payment,
      restaurant.listings[i].price
    );
    await send_pay_now_msg(
      "9495655311",
      seller.name,
      payment,
      restaurant.listings[i].price
    );
    return res.status(200).send(restaurant.waitlist);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/unlistPosition", async (req, res) => {
  try {
    const { rid, id } = req.body;
    const restaurant = await Restaurant.findOne({ rid: rid });
    const listingIndex = restaurant.listings
      .map((listingInfo) => listingInfo.buyer.toString())
      .indexOf(id);
    if (listingIndex < 0) {
      return res.status(400).send("Listing not found");
    } else {
      restaurant.listings.splice(listingIndex, 1);
    }
    let result = [];
    restaurant.listings = restaurant.listings.filter((listingInfo) => {
      const index = restaurant.waitlist
        .map((userInfo) => userInfo.user.toString())
        .indexOf(listingInfo.user.toString());
      if (index >= 0) {
        result.push({ ...listingInfo, place: index + 1 });
      }
      return !listingInfo.taken && index >= 0;
    });
    await restaurant.save();
    result.sort((listingInfo) => listingInfo.place);
    return res.status(200).send(result);
  } catch (error) {
    return res.status(400).send(error);
  }
});

export default router;
