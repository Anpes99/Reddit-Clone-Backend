const OpenAI = require("openai");
const { redisClient } = require("./redis");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const isUnsafeArticle = async (article) => {
  const cachedIsUnsafe = JSON.parse(
    await redisClient.get(`moderation:news:imageUrl:${article.urlToImage}`),
  );
  if (cachedIsUnsafe) {
    return cachedIsUnsafe.isUnsafe;
  }
  const input = [
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

  const result = await openai.moderations.create({
    model: "omni-moderation-latest",
    input,
  });

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

module.exports = { isUnsafeArticle };
