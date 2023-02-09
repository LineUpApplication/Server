import express from "express";
import { Restaurant } from "../models/Restaurant.js";
import { User } from "../models/User.js";
import { sendText } from "../utils/twilio.js";

const router = express.Router();

/********************************************************************
 *                        Restaurant Routes                         *
 ********************************************************************/

router.get("/getUserInfo", async (req, res) => {
  try {
    const name = req.query.name;
    const id = req.query.id;
    let user, partySize, place;
    const restaurant = await Restaurant.findOne({ name: name })
    for (let i = 0; i < restaurant.waitlist.length; i++) {
      let party = restaurant.waitlist[i];
      if (party.user.toString() == id) {
        user = await User.findById(id);
        partySize = party.partySize;
        place = i;
      }
    }
    if (user) {
      return res.status(200).send({
        user: user,
        partySize: partySize,
        place: place
      });
    } else {
      return res.status(400).send("User not in waitlist.")
    }
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

router.post("/addRestaurant", async (req, res) => {
  try {
    const name = req.body.name;
    let restaurant = await Restaurant.findOne({ name: name });
    if (restaurant) {
      return res.status(400).send("Restaurant already added.");
    }
    restaurant = new Restaurant({ name: name, waitlist: [] });
    await restaurant.save();
    return res.status(200).send(restaurant);
  } catch (err) {
    return res.status(400).send("Failed to add restaurant: " + err);
  }
});

router.post("/addUser", async (req, res) => {
  try {
    const { name, phone, partySize } = req.body.userInfo;
    const restaurantName = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ name: restaurantName });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    let user = await User.findOne({ name: name, phone: phone });
    if (!user) {
      user = new User({ name: name, phone: phone });
      await user.save();
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(user._id.toString());
    if (index > -1) {
      restaurant.waitlist.splice(index, 1)[0];
    }
    restaurant.waitlist.push({ user: user._id, partySize: partySize });
    sendText(
      "+1" + phone,
      `Hello, ${name}! This is a confirmation of your place in the line for ${restaurantName}. The estimate wait time is now ${
        restaurant.waitlist.length * 5
      } minute/s...`
    );
    await restaurant.save();
    return res.status(200).send(restaurant);
  } catch (err) {
    return res.status(400).send("Failed to create waitlist: " + err);
  }
});

router.post("/moveUser", async (req, res) => {
  try {
    const { id } = req.body.userInfo;
    const restaurantName = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ name: restaurantName });
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
    if (index > -1) {
      userInfo = restaurant.waitlist.splice(index, 1)[0];
    } else {
      return res.status(400).send("User not in waitlist.");
    }
    restaurant.waitlist = [userInfo, ...restaurant.waitlist];
    await restaurant.save();
    return res.status(200).send(restaurant);
  } catch (err) {
    return res.status(400).send("Failed to create waitlist: " + err);
  }
});

router.post("/removeUser", async (req, res) => {
  try {
    const { phone } = req.body.userInfo;
    const restaurantName = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ name: restaurantName });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    let user = await User.findOne({ phone: phone });
    if (!user) {
      return res.status(400).send("User does not exists.");
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(user._id.toString());
    if (index > -1) {
      restaurant.waitlist.splice(index, 1)[0];
    } else {
      return res.status(400).send("User not in waitlist.");
    }
    await restaurant.save();
    return res.status(200).send(restaurant);
  } catch (err) {
    return res.status(400).send("Failed to create waitlist: " + err);
  }
});

router.get("/:name", async (req, res) => {
  try {
    const name = req.params.name;
    let restaurant;
    if (name) {
      restaurant = await Restaurant.findOne({ name: name });
      restaurant = await Promise.all(
        restaurant.waitlist.map(
          async (userInfo) => {
            const user = await User.findById(userInfo.user);
            console.log(user)
            return {
              user: user,
              partySize: userInfo.partySize
            }
          }
        )
      );
    } else {
      return res.status(400).send("No name provided");
    }
    return res.status(200).send(restaurant);
  } catch (err) {
    return res.status(400).send("Failed to get restaurant: " + err);
  }
});

export default router;
