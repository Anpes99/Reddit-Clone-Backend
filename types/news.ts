// https://newsapi.org/docs/endpoints/top-headlines
export type NewsApiArticle = {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
};

export type NewsApiTopHeadlinesResponse = {
  articles: NewsApiArticle[];
};
