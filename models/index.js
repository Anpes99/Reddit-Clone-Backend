const Comment = require("./Comment");
const User = require("./User");
const Post = require("./Post");
const Subreddit = require("./Subreddit");
const UserSubreddits = require("./UserSubreddits");
const UserRatedPosts = require("./UserRatedPosts");
const UserRatedComments = require("./UserRatedComments");
const SubredditModerators = require("./SubredditModerators");
const SubredditLeaderboard = require("./SubredditLeaderboard");
const SubredditLeaderboardSubreddit = require("./SubredditLeaderboardSubreddit");
const EmailVerificationToken = require("./EmailVerificationToken");
const PasswordResetToken = require("./PasswordResetToken");

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
});
Subreddit.belongsToMany(User, {
  through: SubredditModerators,
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
User.hasMany(EmailVerificationToken);

PasswordResetToken.belongsTo(User);
User.hasMany(PasswordResetToken);
// uncomment to sync database tables
/*
UserRatedPosts.sync({ alter: true });
User.sync({ alter: true });
Post.sync({ alter: true });
Subreddit.sync({ alter: true });
Comment.sync({ alter: true });
UserSubreddits.sync({ alter: true });
UserRatedComments.sync({ alter: true });
SubredditModerators.sync();
SubredditLeaderboard.sync();
SubredditLeaderboardSubreddit.sync();
EmailVerificationToken.sync({
  alter: true,
});
PasswordResetToken.sync({
  alter: true,
});

{ alter: true }{ alter: true }{ alter: true } */

module.exports = {
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
};
