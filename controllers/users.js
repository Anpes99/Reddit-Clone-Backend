const bcrypt = require("bcrypt");
const usersRouter = require("express").Router();
const User = require("../models/User");
require("express-async-errors");

usersRouter.post("/", async (request, response) => {
  const { body } = request;
  if (!(body.username && body.password)) {
    return response.status(400).json({ error: "username or password missing" });
  }
  if (!(body.username.length > 2 && body.password.length > 2)) {
    return response
      .status(400)
      .json({ error: "username or password is too short" });
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(body.password, saltRounds);

  const user = await User.create({
    username: body.username,
    passwordHash,
  }).catch((e) => {
    return res.status(400).json("error when creating user");
  });

  response.status(200).json({ user, passwordHash });
});
/*
usersRouter.get("/", async (req, res) => {
  const users = await User.findAll({});
  res.json(users.map((user) => user.toJSON()));
});

usersRouter.delete("/:username", async (req, res) => {
  const result = await User.findOneAndDelete({ username: req.params.username });
  res.json(result);
});

usersRouter.get("/:username", async (req, res) => {
  const result = await User.findOne({ username: req.params.username });
  console.log(result);
  res.json(result);
});

usersRouter.put("/:username", async (req, res) => {
  const { body } = req;

  const user = await User.findOne({ username: req.params.username });
  console.log(user);

  if (body.items) user.items = body.items;
  if (body.name) user.name = body.name;
  if (body.email) user.email = body.email;
  if (body.favourites) user.favourites = body.favourites;
  const result = await User.findByIdAndUpdate(user._id, user);

  res.json(result);
});*/
module.exports = usersRouter;
