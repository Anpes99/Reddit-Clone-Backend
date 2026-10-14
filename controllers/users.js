const bcrypt = require("bcrypt");
const usersRouter = require("express").Router();
const { User } = require("../models/index");
const { validate } = require("../utils/middleware");
const { postNewUserSchema } = require("../validators/user.validator");
require("express-async-errors");

usersRouter.post(
  "/",
  validate(postNewUserSchema),
  async (request, response) => {
    const { body } = request;

    const userFound = await User.findOne({
      where: { username: body.username },
    });
    if (userFound) {
      return response.status(400).json({ error: "username already taken" });
    }

    if (!(body.username && body.password)) {
      return response
        .status(400)
        .json({ error: "username or password missing" });
    }
    if (!(body.username.length > 2 && body.password.length > 2)) {
      return response
        .status(400)
        .json({ error: "username or password is too short" });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    await User.create({
      username: body.username,
      passwordHash,
    }).catch((e) => {
      return response.status(400).json("error when creating user");
    });

    response.status(200).json("new user created");
  },
);

module.exports = usersRouter;
