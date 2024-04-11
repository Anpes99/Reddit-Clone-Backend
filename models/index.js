const Comment = require("./Comment");
const User = require("./User");
const Post = require("./Post");
const Subreddit = require("./Subreddit");
const UserSubreddits = require("./UserSubreddits");
const UserRatedPosts = require("./UserRatedPosts");
const UserRatedComments = require("./UserRatedComments");

User.hasMany(Post);
User.hasMany(Comment);
Comment.hasMany(Comment);
Post.hasMany(Comment);
Subreddit.hasMany(Post);
Subreddit.belongsToMany(User, {
  through: UserSubreddits,
});
User.belongsToMany(Subreddit, {
  through: UserSubreddits,
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

Post.belongsTo(Subreddit);
Comment.belongsTo(Post);
Comment.belongsTo(User);
Post.belongsTo(User);

// uncomment to sync database tables
/* 
UserRatedPosts.sync({ alter: true });
User.sync({ alter: true });
Post.sync({ alter: true });
Subreddit.sync({ alter: true });
Comment.sync({ alter: true });
UserSubreddits.sync({ alter: true });
UserRatedComments.sync({ alter: true }); */

module.exports = {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
  UserRatedPosts,
};
