import { Router } from "express";
import axios from "axios";
import { AppError } from "../errors";
import { isUnsafeArticle } from "../utils/imageContentModerationOpenAI";
import type { NewsApiTopHeadlinesResponse } from "../types/news";

const newsRouter = Router();

newsRouter.get("", async (req, res, next) => {
  try {
    const result = await axios.get<NewsApiTopHeadlinesResponse>(
      `https://newsapi.org/v2/top-headlines?pageSize=12&country=us&apiKey=${process.env.NEWS_API_KEY}`,
    );

    const articles = result.data.articles.filter(
      (article) => article.urlToImage,
    );

    const moderationResults = await Promise.all(
      articles.map(async (article) => {
        try {
          const unsafe = await isUnsafeArticle(article);

          return {
            article,
            safe: !unsafe,
          };
        } catch (error) {
          return {
            article,
            safe: false,
          };
        }
      }),
    );

    const safeArticles = moderationResults
      .filter((result) => result.safe)
      .map((result) => result.article);

    return res.json({
      articles: safeArticles,
    });
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
export = newsRouter;
