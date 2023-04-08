import express from "express";
import { Data } from "../models/Data.js";
import { Restaurant } from "../models/Restaurant.js";
import { Model } from "../models/Model.js";
import { User } from "../models/User.js";
import { predict, update } from "../utils/ml.js";
import { sendText } from "../utils/twilio.js";
import bcrypt from "bcrypt";
import { generateAuthToken } from "../models/Restaurant.js";
import axios from "axios";

const router = express.Router();
const send_init_msg_cn = async (phone, name, restaurantName, userId, rid) => {
  await sendText(
    phone,
    `Hello, ${name}! This is a confirmation of your place in line at ${restaurantName}. Check your waitlist status or notify restaurant about your party status at https://line-up-usersite.herokuapp.com/${rid}/${userId}/en`
  );
};
const send_init_msg_en = async (phone, name, restaurantName, userId, rid) => {
  await sendText(
    phone,
    `您好，${name}! 您已成功加入${restaurantName}的等候名单。点此查看您的位置或通知餐厅party是否到齐 https://line-up-usersite.herokuapp.com/${rid}/${userId}/cn`
  );
};

const send_live_support = async (phone) => {
  await sendText(
    phone,
    `For questions about LineUp services, contact +9495655311. 如果有任何问题或需要帮助，可以联系 +9495655311`
  );
};

const send_almost_msg = async (phone, restaurantName) => {
  await sendText(
    phone,
    `Your table is almost ready at ${restaurantName}. Please return to the restaurant so the host can seat you soon. 您在${restaurantName}的餐桌即将准备就绪，请尽快到餐厅通知前台工作人员，期待您的光临！`
  );
};

const send_front_msg = async (phone, restaurantName) => {
  await sendText(
    phone,
    `Your table is ready at ${restaurantName}. Please checkin with the host so we can seat you as soon as possible. 您在${restaurantName}的餐桌已经准备就绪，请通知餐厅前台工作人员，祝您用餐愉快！`
  );
};

const send_notify_msg = async (phone, restaurantName) => {
  await sendText(
    phone,
    `Your table is ready at ${restaurantName}. Please checkin with the host within 5-10 mintues so we can seat you as soon as possible. 您在${restaurantName}的餐桌已经准备就绪，请在5-10分钟之内通知餐厅前台工作人员，祝您用餐愉快！`
  );
};

const send_selfRemove_msg = async (phone, restaurantName) => {
  await sendText(
    phone,
    `You have sucessfully removed your party from the waitlist at ${restaurantName}. `
  );
};

const send_removed_msg = async (phone, restaurantName) => {
  await sendText(
    phone,
    `Your party has been removed from the waitlist at ${restaurantName}. 您已被餐厅移除。`
  );
};

const send_pay_now_msg = async (phone, name, payment, amount) => {
  await sendText(
    phone,
    `${name} has sold their position for $${amount} and sucessfully checked in. ${payment.type}: ${payment.info}`
  );
};

const send_position_bought_msg = async (restaurant, position) => {
  await sendText(
    `Your position at ${restaurant} has been sold, you have been moved to position ${position}, you will receive your payment once you've checked in at the restaurant. 您在${restaurant}餐厅等候名单中出售的位置已经售出，您当前在队列中排第${position}位。您会于30分钟之内收到此次交易的首款。`
  );
};

// const send_encourage_sell = async (phone) => {
//   await sendText(
//     phone,
//     `You are near the front of the line! If you are okay with getting seated later, list your party's position for sale!`
//   );
// };

// const send_encourage_buy = async (phone) => {
//   await sendText(
//     phone,
//     `You can swap positions with parties that are selling their spot in line, checkout the marketplace for position listings.`
//   );
// };

const MINUTE = 60000;

/********************************************************************
 *                        Restaurant Routes                         *
 ********************************************************************/

router.get("/getUserInfo", async (req, res) => {
  try {
    const { rid, id } = req.query;
    let user, partySize, partyReady, place, notified;
    const restaurant = await Restaurant.findOne({ rid: rid });
    for (let i = 0; i < restaurant.waitlist.length; i++) {
      let party = restaurant.waitlist[i];
      if (party.user.toString() == id) {
        user = await User.findById(id);
        partySize = party.partySize;
        partyReady = party.partyReady;
        place = i + 1;
        notified = party.notified;
      }
    }
    if (user) {
      const estimatedWait =
        (await predict(partySize, place, restaurant._id)) * MINUTE;
      return res.status(200).send({
        restaurant: restaurant,
        user: user,
        partySize: partySize,
        partyReady: partyReady,
        timestamp: estimatedWait + new Date().getTime(),
        place: place,
      });
    } else {
      return res.status(400).send("User not in waitlist.");
    }
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/register", async (req, res) => {
  try {
    const { rid, name, password } = req.body;
    let restaurant = await Restaurant.findOne({ rid: rid });
    if (restaurant) {
      return res.status(400).send("Restaurant already exists.");
    }
    restaurant = new Restaurant({ rid: rid, name: name, waitlist: [] });
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    restaurant.password = hash;
    await restaurant.save();
    const model = new Model({ w1: 1, w2: 5, b: 0, restaurant: restaurant._id });
    await model.save();
    const token = generateAuthToken(restaurant);
    return res.status(200).send(token);
  } catch (err) {
    console.log("Failed to add restaurant: " + err);
    return res.status(400).send("Failed to add restaurant: " + err);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { rid, password } = req.body;
    let restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) return res.status(400).send("Incorrect restaurant ID.");
    const validPassword = await bcrypt.compare(password, restaurant.password);
    if (!validPassword) return res.status(400).send("Incorrect password.");
    const token = generateAuthToken(restaurant);
    return res.status(200).send(token);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/addUser", async (req, res) => {
  try {
    const { name, phone, partySize } = req.body.userInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const restaurantName = restaurant.name;
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    let user = await User.findOne({ name: name, phone: phone });
    if (!user) {
      user = new User({ name: name, phone: phone });
      await user.save();
    }
    let index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(user._id.toString());
    let data;
    if (index > -1) {
      await Data.deleteOne({ _id: restaurant.waitlist[index].data });
      data = new Data({
        user: user._id,
        restaurant: restaurant._id,
        partySize: partySize,
        placeInLine: index,
      });
      restaurant.waitlist[index] = {
        user: user._id,
        partySize: partySize,
        partyReady: false,
        data: data._id,
      };
    } else {
      index = restaurant.waitlist.length;
      data = new Data({
        user: user._id,
        restaurant: restaurant._id,
        partySize: partySize,
        placeInLine: index,
      });
      restaurant.waitlist.push({
        user: user._id,
        partySize: partySize,
        partyReady: false,
        data: data._id,
      });
    }
    await send_init_msg_en(phone, name, restaurantName, user._id, rid);
    await send_init_msg_cn(phone, name, restaurantName, user._id, rid);

    if (index == 1) {
      await send_almost_msg(phone, restaurantName);
    }
    if (index == 0) {
      await send_front_msg(phone, restaurantName);
    }
    // if (index < 5) {
    //   await send_encourage_sell(phone);
    // }
    restaurant.joinCount += 1;
    await send_live_support(phone);
    await data.save();
    await restaurant.save();
    return res.status(200).send(user);
  } catch (err) {
    console.log("Failed to add user: " + err);
    return res.status(400).send("Failed to add user: " + err);
  }
});

router.post("/moveUser", async (req, res) => {
  try {
    const { id } = req.body.userInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const restaurantName = restaurant.name;
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    let user = await User.findById(id);
    if (!user) {
      return res.status(400).send("User does not exists.");
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(user._id.toString());
    let userInfo;
    if (index < 0) {
      return res.status(400).send("User not in waitlist.");
    }
    userInfo = restaurant.waitlist.splice(index, 1)[0];
    await Data.deleteOne({ _id: userInfo.data });
    let data = new Data({
      user: user._id,
      restaurant: restaurant._id,
      partySize: userInfo.partySize,
      placeInLine: 1,
    });
    userInfo.data = data._id;
    restaurant.waitlist.splice(1, 0, userInfo);
    restaurant.linepassLimit -= 1;
    await data.save();
    await restaurant.save();
    await send_almost_msg(user.phone, restaurantName);
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log("Failed to move user: " + err);
    return res.status(400).send("Failed to move user: " + err);
  }
});

router.post("/removeUser", async (req, res) => {
  try {
    const { _id } = req.body.userInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const restaurantName = restaurant.name;
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(_id.toString());
    if (index < 0) {
      return res.status(400).send("User not in waitlist.");
    }
    let user;
    const userInfo = restaurant.waitlist.splice(index, 1)[0];
    console.log(userInfo);
    await Data.deleteOne({ _id: userInfo.data });
    user = await User.findById(_id);
    await send_removed_msg(user.phone, restaurantName);
    restaurant.removeCount += 1;
    await restaurant.save();
    for (let i = 0; i < restaurant.listings.length; i++) {
      if (restaurant.listings[i].user._id === user._id) {
        restaurant.listings.splice(i, 1);
      }
    }
    if (index == 1) {
      if (restaurant.waitlist.length > 1) {
        user = await User.findById(restaurant.waitlist[1].user);
        await send_almost_msg(user.phone, restaurantName);
      }
    } else if (index == 0) {
      if (restaurant.waitlist.length > 0) {
        user = await User.findById(restaurant.waitlist[0].user);
        await send_front_msg(user.phone, restaurantName);
      }
      if (restaurant.waitlist.length > 1) {
        user = await User.findById(restaurant.waitlist[1].user);
        await send_almost_msg(user.phone, restaurantName);
      }
    }
    // if (index < 5) {
    //   user = await User.findById(restaurant.waitlist[4].user);
    //   await send_encourage_sell(user.phone);
    // }
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Failed to remove user: " + err);
  }
});

router.post("/checkinUser", async (req, res) => {
  try {
    const { _id } = req.body.userInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const restaurantName = restaurant.name;
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(_id.toString());
    if (index < 0) {
      return res.status(400).send("User not in waitlist.");
    }
    let user;
    const userInfo = restaurant.waitlist.splice(index, 1)[0];
    const data = await Data.findById(userInfo.data);
    const currentTime = new Date().getTime();
    const joinedTime = data.createdAt.getTime();
    data.actual = (currentTime - joinedTime) / MINUTE;
    await data.save();
    // update(restaurant._id);
    user = await User.findById(_id);
    await restaurant.save();
    for (let i = 0; i < restaurant.listings.length; i++) {
      if (restaurant.listings[i].user.toString() === user._id.toString()) {
        if (restaurant.listings[i].bought) {
          // await send_pay_now_msg(
          //   "9495298312",
          //   user.name,
          //   restaurant.listings[i].payment,
          //   restaurant.listings[i].price
          // );
          await send_pay_now_msg(
            "9495655311",
            user.name,
            restaurant.listings[i].payment,
            restaurant.listings[i].price
          );
        }
        restaurant.listings.splice(i, 1);
      }
    }
    if (index == 1) {
      if (restaurant.waitlist.length > 1) {
        user = await User.findById(restaurant.waitlist[1].user);
        await send_almost_msg(user.phone, restaurantName);
      }
    } else if (index == 0) {
      if (restaurant.waitlist.length > 0) {
        user = await User.findById(restaurant.waitlist[0].user);
        await send_front_msg(user.phone, restaurantName);
      }
      if (restaurant.waitlist.length > 1) {
        user = await User.findById(restaurant.waitlist[1].user);
        await send_almost_msg(user.phone, restaurantName);
      }
    }
    // if (index < 5) {
    //   user = await User.findById(restaurant.waitlist[4].user);
    //   await send_encourage_sell(user.phone);
    // }
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Failed to checkin user: " + err);
  }
});

router.post("/notifyUser", async (req, res) => {
  try {
    const { _id } = req.body.userInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const restaurantName = restaurant.name;
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    let user = await User.findById(_id);
    if (!user) {
      return res.status(400).send("User does not exists.");
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(user._id.toString());
    restaurant.waitlist[index].notified = true;
    await restaurant.save();
    if (index > -1) {
      await send_notify_msg(user.phone, restaurantName);
    } else {
      return res.status(400).send("User not in waitlist.");
    }
    // Remove user after certain time
    setTimeout(async () => {
      let restaurant = await Restaurant.findOne({ rid: rid });
      if (!restaurant) {
        return res.status(400).send("Restaurant does not exists.");
      }
      const index = restaurant.waitlist
        .map((userInfo) => userInfo.user.toString())
        .indexOf(user._id.toString());
      if (index < 0) {
        return res.status(400).send("User not in waitlist.");
      }
      const userInfo = restaurant.waitlist.splice(index, 1)[0];
      console.log(userInfo);
      await Data.deleteOne({ _id: userInfo.data });
      user = await User.findById(_id);
      await send_removed_msg(user.phone, restaurantName);
      restaurant.removeCount += 1;
      await restaurant.save();
      for (let i = 0; i < restaurant.listings.length; i++) {
        if (restaurant.listings[i].user._id === user._id) {
          restaurant.listings.splice(i, 1);
        }
      }
      if (index == 1) {
        if (restaurant.waitlist.length > 1) {
          user = await User.findById(restaurant.waitlist[1].user);
          await send_almost_msg(user.phone, restaurantName);
        }
      } else if (index == 0) {
        if (restaurant.waitlist.length > 0) {
          user = await User.findById(restaurant.waitlist[0].user);
          await send_front_msg(user.phone, restaurantName);
        }
        if (restaurant.waitlist.length > 1) {
          user = await User.findById(restaurant.waitlist[1].user);
          await send_almost_msg(user.phone, restaurantName);
        }
      }
    }, 15 * MINUTE);
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Failed to notify user: " + err);
  }
});

router.get("/linepassCount/:rid", async (req, res) => {
  try {
    const rid = req.params.rid;
    let restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    return res.status(200).send({ linepassCount: restaurant.linepassCount });
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/setLinepassCount", async (req, res) => {
  try {
    const { rid, linepassCount } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    restaurant.linepassCount = linepassCount;
    await restaurant.save();
    return res.status(200).send({ linepassCount: restaurant.linepassCount });
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.get("/isLinepassActivated/:rid", async (req, res) => {
  try {
    const rid = req.params.rid;
    let restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    return res
      .status(200)
      .send({ linepassActivated: restaurant.linepassActivated });
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/setLinepassActivated", async (req, res) => {
  try {
    const { rid, linepassActivated } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    restaurant.linepassActivated = linepassActivated;
    await restaurant.save();
    return res
      .status(200)
      .send({ linepassActivated: restaurant.linepassActivated });
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.get("/linepassTimeSaving/:rid/:id", async (req, res) => {
  try {
    const { rid, id } = req.params;
    let restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    let user = await User.findById(id);
    if (!user) {
      return res.status(400).send("User does not exists.");
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(user._id.toString());
    if (index < 0) {
      return res.status(400).send("User not in waitlist.");
    }
    const userInfo = restaurant.waitlist[index];
    const oldEstimatedWait = await predict(
      userInfo.partySize,
      index,
      restaurant._id
    );
    const newEstimatedWait = await predict(
      userInfo.partySize,
      1,
      restaurant._id
    );
    return res.status(200).send({
      timeSaving: oldEstimatedWait - newEstimatedWait,
      newEstimatedWait: newEstimatedWait,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/dailyReset", async (req, res) => {
  try {
    let restaurants = await Restaurant.find({});
    await Promise.all(
      restaurants.map(async (restaurant) => {
        if (restaurant.name == "test") {
          return;
        }
        restaurant.waitlist = [];
        restaurant.listings = [];
        await restaurant.save();
      })
    );
    restaurants = await Restaurant.find({});
    return res.status(200).send(restaurants);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/setPartyReady", async (req, res) => {
  try {
    const { rid, id } = req.body;
    const restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    let user = await User.findById(id);
    if (!user) {
      return res.status(400).send("User does not exists.");
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(user._id.toString());
    if (index < 0) {
      return res.status(400).send("User not in waitlist.");
    }
    const userInfo = restaurant.waitlist[index];
    userInfo.partyReady = !userInfo.partyReady;
    restaurant.waitlist[index] = userInfo;
    await restaurant.save();
    res.status(200).send(userInfo);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

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
      return index >= 0;
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
    const { rid, id, price, payment } = req.body;
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
      user: id,
      price: price,
      bought: false,
      payment: payment,
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
    const { buyerId, sellerId } = req.body.swapInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    const listingIndex = restaurant.listings
      .map((listingInfo) => listingInfo.user.toString())
      .indexOf(sellerId);
    if (listingIndex < 0 || restaurant.listings[listingIndex].bought) {
      return res.status(400).send("Listing not found.");
    } else {
      restaurant.listings[listingIndex].bought = true;
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
    const buyer = await User.findById(buyerId);
    if (waitlistSellerIndex == 0) {
      await send_front_msg(buyer.phone, restaurant.name);
    } else if (waitlistSellerIndex == 1) {
      await send_almost_msg(buyer.phone, restaurant.name);
    }
    await restaurant.save();
    await send_position_bought_msg(restaurant.name, waitlistBuyerIndex + 1);
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
      .map((listingInfo) => listingInfo.user.toString())
      .indexOf(id);
    if (listingIndex < 0) {
      return res.status(400).send("User not in listing");
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
      return index >= 0;
    });
    await restaurant.save();
    result.sort((listingInfo) => listingInfo.place);
    return res.status(200).send(result);
  } catch (error) {
    return res.status(400).send(error);
  }
});

router.get("/:rid", async (req, res) => {
  try {
    const rid = req.params.rid;
    let restaurant;
    if (rid) {
      restaurant = await Restaurant.findOne({ rid: rid });
      restaurant = await Promise.all(
        restaurant.waitlist.map(async (userInfo) => {
          const user = await User.findById(userInfo.user);
          const data = await Data.findById(userInfo.data);
          return {
            user: user,
            timestamp: data.createdAt,
            notified: userInfo.notified,
            partySize: userInfo.partySize,
            partyReady: userInfo.partyReady,
          };
        })
      );
    } else {
      return res.status(400).send("No name provided");
    }
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log("Failed to get restaurant: " + err);
    return res.status(400).send("Failed to get restaurant: " + err);
  }
});

export default router;
