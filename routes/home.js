import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Hello World! Welcome to LineUp's Backend!");
});

export default router;
