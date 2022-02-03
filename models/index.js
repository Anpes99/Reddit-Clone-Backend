const Comment = require("./Comment");
const User = require("./User");
const Post = require("./Post");
const Subreddit = require("./Subreddit");
const UserSubreddits = require("./UserSubreddits");

User.hasMany(Post);
User.hasMany(Comment);
Comment.hasMany(Comment);
Post.hasMany(Comment);
Subreddit.hasMany(Post);
Subreddit.belongsToMany(User, { through: UserSubreddits });
User.belongsToMany(Subreddit, { through: UserSubreddits });

Comment.belongsTo(Post);
Comment.belongsTo(Comment);
Post.belongsTo(User);
Post.belongsTo(Subreddit);
Comment.belongsTo(User);

module.exports = {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
};
