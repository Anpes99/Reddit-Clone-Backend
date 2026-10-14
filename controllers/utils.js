const { requireAuth } = require("../utils/middleware.js");
const { generateUploadURL } = require("../utils/s3.js");
const utilsRouter = require("express").Router();

utilsRouter.get("/s3Url", requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json("token invalid or missing");
  }
  const url = await generateUploadURL();

  return res.send({ url });
});
module.exports = utilsRouter;
