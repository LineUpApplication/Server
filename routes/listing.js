import express from "express";
import { Restaurant } from "../models/Restaurant.js";
import { User } from "../models/User.js";
import { sendText } from "../utils/twilio.js";
import { sendPayment } from "../utils/payment.js";
import { ListingStatus } from "../utils/listingStatus.js";

const router = express.Router();

const send_position_sold_msg = async (
  rid,
  phone,
  restaurant,
  position,
  price
) => {
  if (rid == "kaiyuexuan" || rid == "spicycity") {
    await sendText(
      phone,
      `You’ve accepted a swap request! You have been moved to position ${position}. Reminder that you will only receive the $${price} payment after you check in at ${restaurant}. \nFor questions about LineUp services, message or call +19495655311`
    );
  } else {
    await sendText(
      phone,
      `You’ve accepted a swap request! You have been moved to position ${position}. Reminder that you will only receive the $${price} payment after you check in at ${restaurant}. \nFor questions about LineUp services, message or call +19495655311`
    );
  }
};

const send_almost_msg = async (rid, phone, restaurantName) => {
  if (rid == "kaiyuexuan" || rid == "spicycity") {
    // await sendText(
    //   phone,
    //   `Your table is almost ready at ${restaurantName}. Please return to the restaurant so the host can seat you soon. 您在${restaurantName}的餐桌即将准备就绪，请尽快回到餐厅门口等待，期待您的光临！`
    // );
  } else {
    // await sendText(
    //   phone,
    //   `Your table is almost ready at ${restaurantName}. Please return to the restaurant so the host can seat you soon.`
    // );
  }
};

const send_new_request_made = async (phone, rid, userId) => {
  if (rid === "test" || rid === "noodledynasty") {
    await sendText(
      phone,
      `A party in the back has made a request to swap positions with you! If you want to get paid to wait a little longer and okay with getting seated later, checkout the swap requests at https://line-up-usersite.herokuapp.com/${rid}/${userId}/en/linemarket`
    );
  }
};

const send_request_taken = async (phone, rid, userId) => {
  if (rid === "test" || rid === "noodledynasty") {
    await sendText(
      phone,
      `A party in the front has taken up your request to swap positions! Click the link and pay to complete the swap request at https://line-up-usersite.herokuapp.com/${rid}/${userId}/en/confirmswap`
    );
  }
};

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
      .map((listingInfo) => listingInfo.buyer.toString())
      .indexOf(id);
    const listing = {
      buyer: id,
      price: price,
    };
    if (listingIndex < 0) {
      restaurant.listings.push(listing);
    } else {
      restaurant.listings[listingIndex] = listing;
    }
    for (let i = 1; i < Math.min(waitlistIndex - 4, 5); i++) {
      const userInfo = restaurant.waitlist[i];
      const user = await User.findById(userInfo.user);
      await send_new_request_made(user.phone, rid, user._id);
    }
    await restaurant.save();
    const user = await User.findById(id);
    await send_position_requested(user.phone, rid, id, price);
    let place = waitlistIndex + 1;
    let suffix;
    switch (place % 10) {
      case 1:
        suffix = "st";
        break;
      case 2:
        suffix = "nd";
        break;
      case 3:
        suffix = "rd";
        break;
      default:
        suffix = "th";
        break;
    }
    if (10 < place % 100 && place % 100 < 14) {
      suffix = "th";
    }
    place = place + suffix;
    for (let i = 1; i < Math.min(waitlistIndex - 3, 5); i++) {
      const userInfo = restaurant.waitlist[i];
      const user = await User.findById(userInfo.user);
      await send_new_request_made(user.phone, rid, user._id, place, price);
    }
    return res.status(200).send(restaurant.listings);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/takeListing", async (req, res) => {
  try {
    const { buyerId, sellerId, payout } = req.body.swapInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const listingIndex = restaurant.listings
      .map((listingInfo) => listingInfo.buyer.toString())
      .indexOf(buyerId);
    if (
      listingIndex < 0 ||
      restaurant.listings[listingIndex].status != ListingStatus.REQUESTED
    ) {
      return res.status(404).send("Listing not found.");
    }
    const waitlistSellerIndex = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(sellerId);
    if (waitlistSellerIndex < 0) {
      return res.status(404).send("Seller not in waitlist.");
    }
    const waitlistBuyerIndex = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(buyerId);
    if (waitlistBuyerIndex < 0) {
      return res.status(404).send("Buyer not in waitlist.");
    }
    restaurant.listings[listingIndex].status = ListingStatus.PENDING;
    restaurant.listings[listingIndex].seller = sellerId;
    restaurant.listings[listingIndex].payout = payout;
    await restaurant.save();
    const buyer = await User.findById(buyerId);
    await send_request_taken(buyer.phone, rid, buyerId);
    return res.status(200).send(restaurant.waitlist);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/swapPosition", async (req, res) => {
  try {
    const { buyerId, sellerId, paymentId } = req.body.swapInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const listingIndex = restaurant.listings
      .map((listingInfo) => listingInfo.buyer.toString())
      .indexOf(buyerId);
    if (
      listingIndex < 0 ||
      restaurant.listings[listingIndex].status != ListingStatus.PENDING
    ) {
      return res.status(404).send("Listing not found.");
    }
    const waitlistSellerIndex = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(sellerId);
    if (waitlistSellerIndex < 0) {
      return res.status(404).send("Seller not in waitlist.");
    }
    const waitlistBuyerIndex = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(buyerId);
    if (waitlistBuyerIndex < 0) {
      return res.status(404).send("Buyer not in waitlist.");
    }
    const sellerInfo = restaurant.waitlist[waitlistSellerIndex];
    const buyerInfo = restaurant.waitlist[waitlistBuyerIndex];
    restaurant.waitlist[waitlistSellerIndex] = buyerInfo;
    restaurant.waitlist[waitlistBuyerIndex] = sellerInfo;
    restaurant.listings[listingIndex].status = ListingStatus.COMPLETED;
    restaurant.listings[listingIndex].seller = sellerId;
    await restaurant.save();
    await sendPayment(restaurant.listings[listingIndex].price * 100, paymentId);
    const buyer = await User.findById(buyerId);
    if (waitlistSellerIndex <= 1) {
      await send_almost_msg(rid, buyer.phone, restaurant.name);
    }
    const seller = await User.findById(sellerId);
    if (waitlistSellerIndex == 1) {
      await send_almost_msg(buyer.phone, restaurant.name);
    }
    await send_position_sold_msg(
      rid,
      seller.phone,
      restaurant.name,
      waitlistBuyerIndex + 1,
      restaurant.listings[listingIndex].price
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
    restaurant.listings = restaurant.listings.filter((listingInfo) => {
      const index = restaurant.waitlist
        .map((userInfo) => userInfo.user.toString())
        .indexOf(listingInfo.buyer.toString());
      if (index < 0) {
        const index = restaurant.waitlist
          .map((userInfo) => userInfo.user.toString())
          .indexOf(listingInfo.seller.toString());
        return index >= 0;
      } else {
        return true;
      }
    });
    await restaurant.save();
    return res.status(200).send(restaurant.listings);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.get("/:rid", async (req, res) => {
  try {
    const rid = req.params.rid;
    const restaurant = await Restaurant.findOne({ rid: rid });
    let result = [];
    restaurant.listings = restaurant.listings.filter((listingInfo) => {
      const index = restaurant.waitlist
        .map((userInfo) => userInfo.user.toString())
        .indexOf(listingInfo.buyer.toString());
      if (!listingInfo.taken && index >= 0) {
        result.push({ ...listingInfo._doc, place: index + 1 });
      }
      if (index < 0) {
        const index = restaurant.waitlist
          .map((userInfo) => userInfo.user.toString())
          .indexOf(listingInfo.seller.toString());
        return index >= 0;
      } else {
        return true;
      }
    });
    await restaurant.save();
    result.sort((listingInfo) => listingInfo.place);
    return res.status(200).send(result);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

export default router;
