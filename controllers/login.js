const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const loginRouter = require("express").Router();
const User = require("../models/User");

loginRouter.post("/", async (request, response) => {
  const { body } = request;
  console.log(body);
  try {
    const user = await User.findOne({ where: { username: body.username } });
    console.log("usre", user);
    const passwordCorrect =
      user === null
        ? false
        : await bcrypt.compare(body.password, user.passwordHash);

    if (!(user && passwordCorrect)) {
      return response.status(401).json({
        error: "invalid username or password",
      });
    }
    const userForToken = {
      username: user.username,
      id: user.id,
    };

    const token = jwt.sign(userForToken, process.env.SECRET, {
      expiresIn: 60 * 60 * 24,
    });

    response.status(200).send({
      token,
      username: user.username,
      name: user.name,
      id: user._id,
      favourites: user.favourites,
    });
  } catch (error) {
    console.log("error2:", error);
    res.status(401).json(error);
  }
});

/*loginRouter.get("/checkToken", async (request, response) => {
  console.log("@@@2 token ", req.token);
  jwt.verify(req.token, process.env.SECRET, (err, decoded) => {
    console.log("decoded:  @@@@ ", decoded);
    console.log("error:   ", err);
    if (decoded.id) {
      return res.status(200).json("Json token valid");
    }
  });
  return res.status(401).json("Json token expired or invalid");
});
*/
module.exports = loginRouter;
