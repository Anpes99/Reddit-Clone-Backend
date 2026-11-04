import OpenAI from "openai";
import type { ModerationMultiModalInput } from "openai/resources/moderations";
import { redisClient } from "./redis";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type NewsArticle = {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  urlToImage?: string | null;
};

export const isUnsafeArticle = async (
  article: NewsArticle,
): Promise<boolean> => {
  const cached = await redisClient.get(
    `moderation:news:imageUrl:${article.urlToImage}`,
  );
  const cachedIsUnsafe: { isUnsafe: boolean } | null =
    cached === null ? null : JSON.parse(cached);
  if (cachedIsUnsafe) {
    return cachedIsUnsafe.isUnsafe;
  }
  const input: ModerationMultiModalInput[] = [
    {
      type: "text",
      text: [article.title, article.description, article.content]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  if (article.urlToImage) {
    input.push({
      type: "image_url",
      image_url: {
        url: article.urlToImage,
      },
    });
  }
  let result;
  try {
    result = await openai.moderations.create({
      model: "omni-moderation-latest",
      input,
    });
  } catch (e) {
    if ((e as { status?: number }).status === 400) {
      await redisClient.set(
        `moderation:news:imageUrl:${article.urlToImage}`,
        JSON.stringify({ isUnsafe: true }),
        {
          EX: 24 * 60 * 60,
        },
      );
      return true;
    }
    throw e;
  }
  const categories = result.results[0].categories;

  const isUnsafe =
    categories["violence/graphic"] ||
    categories["sexual"] ||
    categories["self-harm"] ||
    categories["self-harm/intent"] ||
    categories["self-harm/instructions"];

  await redisClient.set(
    `moderation:news:imageUrl:${article.urlToImage}`,
    JSON.stringify({ isUnsafe }),
    {
      EX: 24 * 60 * 60,
    },
  );

  return isUnsafe;
};
