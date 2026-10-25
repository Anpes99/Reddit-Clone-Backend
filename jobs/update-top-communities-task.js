import cron from "node-cron";
import { SubredditLeaderboard } from "../models/index.js";
import moment from "moment";
import { sequelize } from "../utils/db.js";

export function startUpdateTopCommunitiesTask() {
  cron.schedule(
    "0 9 * * *", //  "* * * * *",
    async () => {
      try {
        const leaderboardDate = moment()
          .tz("Europe/Helsinki")
          .format("YYYY-MM-DD");

        await sequelize.transaction(async (t) => {
          await SubredditLeaderboard.destroy({
            where: {
              date: leaderboardDate,
            },
          });

          const newSubredditLeaderboard = await SubredditLeaderboard.create(
            {
              date: leaderboardDate,
            },
            { transaction: t },
          );
          const subredditLeaderboardId = newSubredditLeaderboard.id;
          await sequelize.query(
            `
        INSERT INTO subreddit_leaderboard_subreddits (
          subreddit_leaderboard_id,
          subreddit_id,
          rank,
          created_at,
          updated_at
        )
        SELECT
          :subredditLeaderboardId,
          ranked.id,
          ranked.rank::integer,
          NOW(),
          NOW()
        FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY member_count DESC, id ASC) AS rank
          FROM subreddits
          ORDER BY member_count DESC, id ASC
          LIMIT 50
        ) AS ranked;
      `,
            {
              replacements: { subredditLeaderboardId },
              transaction: t,
            },
          );
        });

        console.log("startUpdateTopCommunitiesTask completed");
      } catch (error) {
        console.error("startUpdateTopCommunitiesTask failed:", error);
      }
    },
    {
      timezone: "Europe/Helsinki",
    },
  );
}
