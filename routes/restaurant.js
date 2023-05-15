import express from "express";
import { Data } from "../models/Data.js";
import { Restaurant } from "../models/Restaurant.js";
import { Model } from "../models/Model.js";
import { User } from "../models/User.js";
import { predict, update } from "../utils/ml.js";
import { sendText } from "../utils/twilio.js";
import bcrypt from "bcrypt";
import { generateAuthToken } from "../models/Restaurant.js";
import { Actions } from "../utils/actionTypes.js";
import axios from "axios";
import { sendPayment } from "../utils/stripe.js";

const router = express.Router();
const send_init_msg = async (phone, name, restaurantName, userId, rid) => {
  if (rid == "kaiyuexuan" || rid == "spicycity") {
    await sendText(
      phone,
      `您好，${name}! 您已成功加入${restaurantName}的等候名单。点此查看您的位置或通知餐厅party是否到齐 https://line-up-usersite.herokuapp.com/${rid}/${userId}/cn`
    );
  }
  await sendText(
    phone,
    `Hello, ${name}! This is a confirmation of your place in line at ${restaurantName}. Check your waitlist status or notify restaurant about your party status at https://line-up-usersite.herokuapp.com/${rid}/${userId}/en`
  );
};

const send_live_support = async (rid, phone) => {
  // if (rid == "kaiyuexuan" || rid == "spicycity") {
  //   await sendText(
  //     phone,
  //     `For questions about LineUp services, contact +9495655311. 如果有任何问题或需要帮助，可以联系 +9495655311`
  //   );
  // } else {
  //   await sendText(
  //     phone,
  //     `For questions about LineUp services, contact +9495655311.`
  //   );
  // }
};

const send_almost_msg = async (rid, phone, restaurantName) => {
  if (rid == "kaiyuexuan" || rid == "spicycity") {
    // await sendText(
    //   phone,
    //   `Your table is almost ready at ${restaurantName}. Please return to the restaurant so the host can seat you soon. 您在${restaurantName}的餐桌即将准备就绪，请尽快回到餐厅门口等待，期待您的光临！`
    // );
  } else {
    await sendText(
      phone,
      `Your table is almost ready at ${restaurantName}. Please return to the restaurant so the host can seat you soon.`
    );
  }
};

const send_notify_msg = async (rid, phone, restaurantName) => {
  if (rid == "kaiyuexuan" || rid == "spicycity") {
    await sendText(
      phone,
      `Your table is ready at ${restaurantName}. Please checkin with the host within 5-10 mintues so we can seat you as soon as possible. 您在${restaurantName}的餐桌已经准备就绪，请在5-10分钟之内通知餐厅前台工作人员，祝您用餐愉快！`
    );
  } else {
    await sendText(
      phone,
      `Your table is ready at ${restaurantName}. Please checkin with the host within 5-10 mintues so we can seat you as soon as possible.`
    );
  }
};

const send_removed_msg = async (rid, phone, restaurantName) => {
  if (rid == "kaiyuexuan" || rid == "spicycity") {
    await sendText(
      phone,
      `Your party has been removed from the waitlist at ${restaurantName}. 您已被餐厅移除。`
    );
  } else {
    await sendText(
      phone,
      `Your party has been removed from the waitlist at ${restaurantName}.`
    );
  }
};

const send_encourage_sell = async (phone, rid, userId) => {
  await sendText(
    phone,
    `You are near the front of the line! If you are okay with getting seated later, checkout the swap requests at https://line-up-usersite.herokuapp.com/${rid}/${userId}/en/linemarket and get paid to wait a little longer!`
  );
};

const send_pay_now_msg = async (phone, name, payment, amount) => {
  await sendText(
    phone,
    `${name} has sold their position for $${amount} and sucessfully checked in. ${payment.type}: ${payment.info}`
  );
};

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
      data = await Data.findById(restaurant.waitlist[index].data);
      await Data.deleteOne({ _id: restaurant.waitlist[index].data });
      data = new Data({
        user: user._id,
        restaurant: restaurant._id,
        partySize: partySize,
        placeInLine: index,
        createdAt: data.createdAt,
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
        createdAt: new Date(),
      });
      restaurant.waitlist.push({
        user: user._id,
        partySize: partySize,
        partyReady: false,
        data: data._id,
      });
    }
    restaurant.joinCount += 1;
    await data.save();
    await restaurant.save();
    await send_init_msg(phone, name, restaurantName, user._id, rid);
    if (index == 1) {
      await send_almost_msg(rid, phone, restaurantName);
    }
    if (
      (restaurant.listings.length && restaurant.waitlist.length < 5) ||
      index == 4
    ) {
      await send_encourage_sell(phone, rid, user._id);
    }
    await send_live_support(rid, phone);
    return res.status(200).send(user);
  } catch (err) {
    console.log("Failed to add user: " + err);
    return res.status(400).send("Failed to add user: " + err);
  }
});

router.post("/updateUser", async (req, res) => {
  try {
    const { name, phone, partySize } = req.body.userInfo;
    const { rid } = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ rid: rid });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    let user = await User.findOne({ name: name, phone: phone });
    if (!user) {
      return res.status(400).send("User does not exists.");
    }
    let index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(user._id.toString());
    let data;
    if (index < 0) {
      return res.status(400).send("User not in waitlist.");
    }
    data = await Data.findById(restaurant.waitlist[index].data);
    await Data.deleteOne({ _id: restaurant.waitlist[index].data });
    data = new Data({
      user: user._id,
      restaurant: restaurant._id,
      partySize: partySize,
      placeInLine: index,
      createdAt: data.createdAt,
    });
    await data.save();
    restaurant.waitlist[index] = {
      user: user._id,
      partySize: partySize,
      partyReady: false,
      data: data._id,
    };
    await restaurant.save();
    return res.status(200).send(user);
  } catch (err) {
    console.log("Failed to update user: " + err);
    return res.status(400).send("Failed to update user: " + err);
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
    let data = await Data.findById(userInfo.data);
    await Data.deleteOne({ _id: userInfo.data });
    data = new Data({
      user: user._id,
      restaurant: restaurant._id,
      partySize: userInfo.partySize,
      placeInLine: 1,
      createdAt: new Date(),
    });
    userInfo.data = data._id;
    restaurant.waitlist.splice(1, 0, userInfo);
    restaurant.linepassLimit -= 1;
    await data.save();
    await restaurant.save();
    await send_almost_msg(rid, user.phone, restaurantName);
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
    user = await User.findById(_id);
    await send_removed_msg(rid, user.phone, restaurantName);
    restaurant.removeCount += 1;
    for (let i = 0; i < restaurant.listings.length; i++) {
      if (
        (restaurant.listings[i].taken &&
          restaurant.listings[i].seller._id.toString() === userInfo.user.toString()) ||
        (!restaurant.listings[i].taken &&
          restaurant.listings[i].buyer._id.toString() === userInfo.user.toString())
      ) {
        restaurant.listings.splice(i, 1);
      }
    }
    restaurant.historyList.unshift({
      user: userInfo.user,
      partySize: userInfo.partySize,
      actionType: Actions.Removed,
      timestamp: Date.now(),
    });
    if (restaurant.historyList.length > 20) {
      restaurant.historyList = restaurant.historyList.slice(0, 20);
    }
    await restaurant.save();
    await Data.deleteOne({ _id: userInfo.data });
    if (index <= 1) {
      if (restaurant.waitlist.length > 1) {
        user = await User.findById(restaurant.waitlist[1].user);
        await send_almost_msg(rid, user.phone, restaurantName);
      }
    }
    if (restaurant.listings.length && index <= 4) {
      if (restaurant.waitlist.length >= 5) {
        user = await User.findById(restaurant.waitlist[4].user);
        await send_encourage_sell(user.phone, rid, user._id);
      }
    }
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
    const userInfo = restaurant.waitlist.splice(index, 1)[0];
    restaurant.historyList.unshift({
      user: userInfo.user,
      partySize: userInfo.partySize,
      actionType: Actions.CheckedIn,
      timestamp: Date.now(),
    });
    if (restaurant.historyList.length > 20) {
      restaurant.historyList = restaurant.historyList.slice(0, 20);
    }
    for (let i = 0; i < restaurant.listings.length; i++) {
      if (
        restaurant.listings[i].taken &&
        restaurant.listings[i].seller._id.toString() === userInfo.user.toString()
      ) {
        const seller = await User.findById(userInfo.user);
        await send_pay_now_msg(
          "9495298312",
          seller.name,
          restaurant.listings[i].payment,
          restaurant.listings[i].price
        );
        await send_pay_now_msg(
          "9495655311",
          seller.name,
          restaurant.listings[i].payment,
          restaurant.listings[i].price
        );
        restaurant.listings.splice(i, 1);
      } else if (
        !restaurant.listings[i].taken &&
        restaurant.listings[i].buyer._id.toString() === userInfo.user.toString()
      ) {
        restaurant.listings.splice(i, 1);
      }
    }
    await restaurant.save();
    const data = await Data.findById(userInfo.data);
    const currentTime = new Date().getTime();
    const joinedTime = data.createdAt.getTime();
    data.actual = (currentTime - joinedTime) / MINUTE;
    await data.save();
    await restaurant.save();
    if (index <= 1) {
      if (restaurant.waitlist.length > 1) {
        const user = await User.findById(restaurant.waitlist[1].user);
        await send_almost_msg(user.phone, restaurantName);
      }
    }
    if (restaurant.listings.length && index <= 4) {
      if (restaurant.waitlist.length >= 5) {
        const user = await User.findById(restaurant.waitlist[4].user);
        await send_encourage_sell(user.phone, rid, user._id);
      }
    }
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
    if (index > -1) {
      await send_notify_msg(rid, user.phone, restaurantName);
    } else {
      return res.status(400).send("User not in waitlist.");
    }
    restaurant.waitlist[index].notified = true;
    await restaurant.save();
    // Remove user after certain time
    setTimeout(async () => {
      try {
        let restaurant = await Restaurant.findOne({ rid: rid });
        const index = restaurant.waitlist
          .map((userInfo) => userInfo.user.toString())
          .indexOf(user._id.toString());
        if (index < 0) {
          console.log("User not in waitlist.");
          return;
        }
        const userInfo = restaurant.waitlist.splice(index, 1)[0];
        restaurant.historyList.unshift({
          user: userInfo.user,
          partySize: userInfo.partySize,
          actionType: Actions.Removed,
          timestamp: Date.now(),
        });
        if (restaurant.historyList.length > 20) {
          restaurant.historyList = restaurant.historyList.slice(0, 20);
        }
        await Data.deleteOne({ _id: userInfo.data });
        user = await User.findById(_id);
        await send_removed_msg(rid, user.phone, restaurantName);
        restaurant.removeCount += 1;
        for (let i = 0; i < restaurant.listings.length; i++) {
          if (
            (restaurant.listings[i].taken &&
              restaurant.listings[i].seller._id === user._id) ||
            (!restaurant.listings[i].taken &&
              restaurant.listings[i].buyer._id === user._id)
          ) {
            restaurant.listings.splice(i, 1);
          }
        }
        await restaurant.save();
        for (let i = 0; i < restaurant.listings.length; i++) {
          if (restaurant.listings[i].user._id === user._id) {
            restaurant.listings.splice(i, 1);
          }
        }
        if (index <= 1) {
          if (restaurant.waitlist.length > 1) {
            user = await User.findById(restaurant.waitlist[1].user);
            await send_almost_msg(rid, user.phone, restaurantName);
          }
        }
        if (restaurant.listings.length && index <= 4) {
          if (restaurant.waitlist.length >= 5) {
            const user = await User.findById(restaurant.waitlist[4].user);
            await send_encourage_sell(phone, rid, user._id);
          }
        }
      } catch (error) {
        console.log(error);
      }
    }, 15 * MINUTE);
    return res.status(200).send(user);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Failed to notify user: " + err);
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
        restaurant.historyList = [];
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
    return res.status(200).send(userInfo);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.get("/history/:rid", async (req, res) => {
  try {
    const rid = req.params.rid;
    const restaurant = await Restaurant.findOne({ rid: rid });
    const historyList = await Promise.all(
      restaurant.historyList?.map(async (historyInfo) => {
        const user = await User.findById(historyInfo.user);
        return {
          user: user,
          partySize: historyInfo.partySize,
          actionType: historyInfo.actionType,
          timestamp: historyInfo.timestamp,
        };
      })
    );
    return res.status(200).send(historyList);
  } catch (err) {
    console.log("Failed to get restaurant: " + err);
    return res.status(400).send("Failed to get restaurant: " + err);
  }
});

router.get("/:rid", async (req, res) => {
  try {
    const rid = req.params.rid;
    let restaurant = await Restaurant.findOne({ rid: rid });
    restaurant = await Promise.all(
      restaurant.waitlist.map(async (userInfo) => {
        const user = await User.findById(userInfo.user);
        const data = await Data.findById(userInfo.data);
        return {
          user: user,
          timestamp: data ? data.createdAt : Date.now(),
          notified: userInfo.notified,
          partySize: userInfo.partySize,
          partyReady: userInfo.partyReady,
        };
      })
    );
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log("Failed to get restaurant: " + err);
    return res.status(400).send("Failed to get restaurant: " + err);
  }
});

export default router;
