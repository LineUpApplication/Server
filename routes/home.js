import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  return res.status(200).send("Hello World! Welcome to LineUp's Backend!");
});

export default router;
