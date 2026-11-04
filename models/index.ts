import Comment from "./Comment";
import User from "./User";
import Post from "./Post";
import Subreddit from "./Subreddit";
import UserSubreddits from "./UserSubreddits";
import UserRatedPosts from "./UserRatedPosts";
import UserRatedComments from "./UserRatedComments";
import SubredditModerators from "./SubredditModerators";
import SubredditLeaderboard from "./SubredditLeaderboard";
import SubredditLeaderboardSubreddit from "./SubredditLeaderboardSubreddit";
import EmailVerificationToken from "./EmailVerificationToken";
import PasswordResetToken from "./PasswordResetToken";
import UserNotifications from "./UserNotifications";

User.hasMany(Post);
User.hasMany(Comment);
Comment.hasMany(Comment, { as: "replies", foreignKey: "commentId" });
Post.hasMany(Comment);
Subreddit.hasMany(Post, {
  foreignKey: {
    name: "subredditId",
    field: "subreddit_id",
  },
  as: "posts",
});
Subreddit.belongsToMany(User, {
  through: UserSubreddits,
  as: "members",
});
Subreddit.belongsToMany(User, {
  through: SubredditModerators,
  as: "moderators",
});
User.belongsToMany(Subreddit, {
  through: UserSubreddits,
  as: "subreddits",
});
User.belongsToMany(Subreddit, {
  through: SubredditModerators,
  as: "subredditsModerated",
});
User.belongsToMany(Post, { through: UserRatedPosts, as: "ratedPosts" });
Post.belongsToMany(User, { through: UserRatedPosts, as: "usersRated" });
User.belongsToMany(Comment, {
  through: UserRatedComments,
  as: "ratedComments",
});
Comment.belongsToMany(User, {
  through: UserRatedComments,
  as: "commentRatedByUsers",
});

Post.belongsTo(Subreddit, {
  foreignKey: {
    name: "subredditId",
    field: "subreddit_id",
  },
});
Comment.belongsTo(Post);
Comment.belongsTo(User);
Comment.belongsTo(Comment, { as: "parentComment", foreignKey: "commentId" });

Post.belongsTo(User);
Subreddit.belongsToMany(SubredditLeaderboard, {
  through: SubredditLeaderboardSubreddit,
  as: "subredditLeaderboards",
});
SubredditLeaderboard.belongsToMany(Subreddit, {
  through: SubredditLeaderboardSubreddit,
  as: "rankedSubreddits",
});
SubredditLeaderboardSubreddit.belongsTo(Subreddit, {
  foreignKey: "subredditId",
});
EmailVerificationToken.belongsTo(User);
User.hasOne(EmailVerificationToken);

PasswordResetToken.belongsTo(User);
User.hasOne(PasswordResetToken);

UserNotifications.belongsTo(User);
User.hasMany(UserNotifications, { as: "notifications" });

export {
  User,
  Comment,
  Post,
  Subreddit,
  SubredditLeaderboard,
  SubredditLeaderboardSubreddit,
  SubredditModerators,
  UserSubreddits,
  UserRatedPosts,
  UserRatedComments,
  EmailVerificationToken,
  PasswordResetToken,
  UserNotifications,
};
