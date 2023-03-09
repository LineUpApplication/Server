import mongoose from "mongoose";
import { Data } from "../models/Data.js";
import { Model } from "../models/Model.js";

const lr = 0.05;

const predict = async (partySize, placeInLine, restaurantId) => {
  try {
    const model = await Model.findOne({ restaurant: restaurantId });
    return partySize * model.w1 + placeInLine * model.w2 + model.b;
  } catch (error) {
    console.log(error);
  }
};

const update = async (dataId, restaurantId) => {
  try {
    const model = await Model.findOne({ restaurant: restaurantId });
    const data = await Data.findById(dataId);
    const L = Math.pow(data.actual - data.prediction, 2);
    const dLdY = 2 * (data.prediction - data.actual);
    const dYdb = 1;
    const dYdw1 = data.partySize;
    const dYdw2 = data.placeInLine;
    model.b = model.b - lr * (dLdY * dYdb);
    model.w1 = model.w1 - lr * (dLdY * dYdw1);
    model.w2 = model.w2 - lr * (dLdY * dYdw2);
    await model.save();
    return { L, model };
  } catch (error) {
    console.log(error);
  }
};

// Create default model
const create = async () => {
  const model = new Model({ w1: 1, w2: 5, b: 0 });
  await model.save();
};

export { predict, update };
