const searchRouter = require("express").Router();
const { Op } = require("sequelize");
const { Subreddit } = require("../models/index");

searchRouter.post("/", async (req, res) => {
  const searchWord = req.body.searchWord;
  const result = await Subreddit.findAll({
    where: {
      name: {
        [Op.like]: `%${searchWord}%`,
      },
    },
    attributes: ["id", "name"],
    limit: 10,
  });
  return res.send({ result });
});

module.exports = searchRouter;
