export type TopSubredditsLeaderboardRow = {
  id: number;
  subredditLeaderboardId: number;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  iconUrl: string | null;
  previousRank: number | null;
  previousLeaderboardDate: string | null; // "YYYY-MM-DD"
  rankChange: number | null;
};

export const getTopSubredditsLeaderboardQuery = `
  WITH latest AS (
    SELECT id, date
    FROM subreddit_leaderboards
    ORDER BY date DESC
    LIMIT 1
  ),
  previous AS (
    SELECT id, date
    FROM subreddit_leaderboards
    WHERE date <= (SELECT date FROM latest) - INTERVAL '7 days'
    ORDER BY date DESC
    LIMIT 1
  )
  SELECT
    current_entry.subreddit_id AS "id",
    current_entry.subreddit_leaderboard_id AS "subredditLeaderboardId",
    current_entry.rank AS "rank",
    current_entry.created_at AS "createdAt",
    current_entry.updated_at AS "updatedAt",
    s.name AS "name",
    s.icon_url AS "iconUrl",
    previous_entry.rank AS "previousRank",
    previous.date AS "previousLeaderboardDate",
    previous_entry.rank - current_entry.rank AS "rankChange"
  FROM latest
  JOIN subreddit_leaderboard_subreddits AS current_entry
    ON current_entry.subreddit_leaderboard_id = latest.id
  JOIN subreddits AS s
    ON s.id = current_entry.subreddit_id
  LEFT JOIN previous
    ON TRUE
  LEFT JOIN subreddit_leaderboard_subreddits AS previous_entry
    ON previous_entry.subreddit_leaderboard_id = previous.id
    AND previous_entry.subreddit_id = current_entry.subreddit_id
  ORDER BY current_entry.rank ASC;
`;
