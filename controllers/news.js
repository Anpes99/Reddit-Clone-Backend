const newsRouter = require("express").Router();
const axios = require("axios");
const { AppError } = require("../errors");
newsRouter.get("", async (req, res, next) => {
  try {
    const result = await axios.get(
      `https://newsapi.org/v2/top-headlines?pageSize=4&country=us&apiKey=${process.env.NEWS_API_KEY}`,
    );

    return res.json(result.data);
  } catch (e) {
    next(
      new AppError({
        status: 502,
        code: "NEWS_UNAVAILABLE",
        message: "News unavailable",
        details: {},
      }),
    );
  }
});
module.exports = newsRouter;
