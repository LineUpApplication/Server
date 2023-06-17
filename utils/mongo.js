import mongoose from "mongoose";
import { Restaurant } from "../models/Restaurant.js";
import { ObjectId } from "mongodb";
import { Actions } from "./actionTypes.js";

const findUserInRestaurant = async (rid, userId) => {
  const result = await Restaurant.aggregate([
    {
      $match: {
        rid: rid,
      },
    },
    {
      $project: {
        name: 1,
        waitlist: {
          $filter: {
            input: "$waitlist",
            as: "waitlist",
            cond: {
              $eq: ["$$waitlist.user", new ObjectId(userId)],
            },
          },
        },
        matchedIndex: {
          $indexOfArray: ["$waitlist.user", new ObjectId(userId)],
        },
      },
    },
  ]);
  if (result.length <= 0) {
    throw new Error("Restaurant does not exists.");
  }
  return result[0];
};

const upsertUserInRestaurant = async (rid, user, partySize, data) => {
  await Restaurant.updateOne(
    {
      rid: rid,
      waitlist: { $not: { $elemMatch: { user: new ObjectId(user._id) } } },
    },
    {
      $addToSet: {
        waitlist: {
          user: user._id,
          username: user.name,
          phone: user.phone,
          partySize: partySize,
          partyReady: false,
          data: data._id,
          createdAt: data.createdAt,
        },
      },
    },
    { multi: false, upsert: false }
  );

  await Restaurant.updateOne(
    {
      rid: rid,
      "waitlist.user": new ObjectId(user._id),
    },
    {
      $set: {
        "waitlist.$.partySize": partySize,
        "waitlist.$.partyReady": false,
        "waitlist.$.data": data._id,
      },
      $inc: { joinCount: 1 },
    },
    { multi: false, upsert: false }
  );
};

const removeUserInRestaurant = async (rid, userId, partySize) => {
  await Restaurant.updateOne(
    { rid: rid },
    {
      $pull: { waitlist: { user: userId } },
      $inc: { removeCount: 1 },
      $push: {
        historyList: {
          $each: [
            {
              user: userId,
              partySize: partySize,
              actionType: Actions.Removed,
              timestamp: Date.now(),
            },
          ],
          $position: 0,
          $limit: 20,
        },
      },
    }
  );
};

const insertUserInRestaurant = async (
  rid,
  user,
  partySize,
  data,
  place
) => {
  await Restaurant.updateOne(
    {
      rid: rid,
    },
    {
      $push: {
        waitlist: {
          $each: [
            {
              user: user._id,
              username: user.name,
              phone: user.phone,
              partySize: partySize,
              partyReady: false,
              data: data._id,
              createdAt: data.createdAt
            },
          ],
          $position: place,
        },
      },
    }
  );
};

export {
  findUserInRestaurant,
  upsertUserInRestaurant,
  removeUserInRestaurant,
  insertUserInRestaurant,
};
