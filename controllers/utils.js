const { generateUploadURL } = require("../s3");
const utilsRouter = require("express").Router();

utilsRouter.get("/s3Url", async (req, res) => {
  if (!req.user) {
    console.log("token invalid or missing");
    return res.status(401).json("token invalid or missing");
  }
  const url = await generateUploadURL();

  console.log(url);
  return res.send({ url });
});
module.exports = utilsRouter;
