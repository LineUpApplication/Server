import express from "express";
import { Restaurant } from "../models/Restaurant.js";
import { User } from "../models/User.js";
import { sendText } from "../utils/twilio.js";

const router = express.Router();
const send_init_msg = (phone, name, restaurantName, userId) => {
  sendText(
    "+1" + phone,
    `Hello, ${name}! This is a confirmation of your place in line at NoLine-Burgers & Fries. Check the updated estimated wait time at https://line-up-usersite.herokuapp.com/${userId}`
  );
};

const send_almost_msg = (phone, restaurantName) => {
  sendText(
    phone,
    `Your table is almost ready at ${restaurantName}. Please return to the restaurant so the host can seat you soon`
  );
};

const send_front_msg = (phone, restaurantName) => {
  sendText(
    phone,
    `Your table is ready at ${restaurantName}. Please checkin with the host so we can seat you as soon as possible`
  );
};

const send_selfRemove_msg = (phone, restaurantName) => {
  sendText(
  phone,
  `You have sucessfully removed your party from the waitlist at ${restaurantName}`
  );
}

const ESTIMATED_WAIT = 5 * 60000;

/********************************************************************
 *                        Restaurant Routes                         *
 ********************************************************************/

router.get("/getUserInfo", async (req, res) => {
  try {
    const name = req.query.name;
    const id = req.query.id;
    let user, partySize, place;
    const restaurant = await Restaurant.findOne({ name: name });
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
        timestamp: place * ESTIMATED_WAIT + new Date().getTime(),
      });
    } else {
      return res.status(400).send("User not in waitlist.");
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
    console.log("Failed to add restaurant: " + err);
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
      restaurant.waitlist[index] = { user: user, partySize: partySize };
    } else {
      restaurant.waitlist.push({ user: user._id, partySize: partySize });
    }
    send_init_msg(phone, name, restaurantName, user._id)
    if (restaurant.waitlist.length == 2) {
      send_almost_msg(phone, restaurantName);
    }
    if (restaurant.waitlist.length == 1) {
      send_front_msg(phone, restaurantName);
    }
    await restaurant.save();
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log("Failed to add user: " + err);
    return res.status(400).send("Failed to add user: " + err);
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
    restaurant.waitlist.splice(1, 0, userInfo);
    await restaurant.save();
    send_almost_msg(user.phone, restaurantName);
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log("Failed to move user: " + err);
    return res.status(400).send("Failed to move user: " + err);
  }
});

router.post("/removeUser", async (req, res) => {
  try {
    const { _id } = req.body.userInfo;
    const restaurantName = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ name: restaurantName });
    if (!restaurant) {
      return res.status(400).send("Restaurant does not exists.");
    }
    const index = restaurant.waitlist
      .map((userInfo) => userInfo.user.toString())
      .indexOf(_id.toString());
    if (index > -1) {
      let user;
      if (index == 1) {
        if (restaurant.waitlist.length > 2) {
          user = await User.findById(restaurant.waitlist[2].user);
          send_almost_msg(user.phone, restaurantName);
        }
      } else if (index == 0) {
        if (restaurant.waitlist.length > 1) {
          user = await User.findById(restaurant.waitlist[1].user);
          send_front_msg(user.phone, restaurantName);
        }
        if (restaurant.waitlist.length > 2) {
          user = await User.findById(restaurant.waitlist[2].user);
          send_almost_msg(user.phone, restaurantName);
        }
      }
      restaurant.waitlist.splice(index, 1)[0];
    } else {
      return res.status(400).send("User not in waitlist.");
    }
    await restaurant.save();
    return res.status(200).send(restaurant);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Failed to remove user: " + err);
  }
});

router.post("/notifyUser", async (req, res) => {
  try {
    const { _id } = req.body.userInfo;
    const restaurantName = req.body.restaurant;
    let restaurant = await Restaurant.findOne({ name: restaurantName });
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
      send_almost_msg(user.phone, restaurantName);
    } else {
      return res.status(400).send("User not in waitlist.");
    }
    return res.status(200);
  } catch (err) {
    console.log("Failed to move user: " + err);
    return res.status(400).send("Failed to move user: " + err);
  }
});

router.get("/:name", async (req, res) => {
  try {
    const name = req.params.name;
    let restaurant;
    if (name) {
      restaurant = await Restaurant.findOne({ name: name });
      restaurant = await Promise.all(
        restaurant.waitlist.map(async (userInfo) => {
          const user = await User.findById(userInfo.user);
          return {
            user: user,
            partySize: userInfo.partySize,
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
