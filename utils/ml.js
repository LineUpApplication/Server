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

const update = async (restaurantId) => {
  try {
    const model = await Model.findOne({ restaurant: restaurantId });
    const allData = await Data.find({});
    for (let i = 0; i < 5; i++) {
      await Promise.all(
        allData.map(async (data) => {
          const prediction = await predict(
            data.partySize,
            data.placeInLine,
            restaurantId
          );
          const dLdY = 2 * (prediction - data.actual);
          const dYdb = 1;
          const dYdw1 = data.partySize;
          const dYdw2 = data.placeInLine;
          model.b = model.b - lr * (dLdY * dYdb);
          model.w1 = model.w1 - lr * (dLdY * dYdw1);
          model.w2 = model.w2 - lr * (dLdY * dYdw2);
        })
      );
    }
    await model.save();
    return model;
  } catch (error) {
    console.log(error);
  }
};

// Create default model
const create = async () => {
  const model = new Model({ w1: 1, w2: 5, b: 0 });
  await model.save();
};

const generateData = async () => {
  const w1 = 1;
  const w2 = 5;
  const b = 0;
  for (let i = 0; i < 200; i++) {
    const partySize = Math.round(Math.random() * 10);
    const placeInLine = Math.round(Math.random() * 20);
    const fakeActual = partySize * w1 + placeInLine * w2 + b;
    const data = new Data({
      user: new mongoose.Types.ObjectId("63eaffe997af1fe45d996759"),
      restaurant: new mongoose.Types.ObjectId("63d869513bea2baa196a1a6e"),
      partySize: partySize,
      placeInLine: placeInLine,
      actual: fakeActual,
    });
    await data.save();
  }
};

export { predict, update, create, generateData };
