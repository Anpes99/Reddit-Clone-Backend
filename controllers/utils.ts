import { Router } from "express";
import { requireAuth } from "../utils/middleware/middleware.js";
import { generateUploadURL } from "../utils/s3.js";

const utilsRouter = Router();

utilsRouter.get("/s3Url", requireAuth, async (req, res) => {
  const url = await generateUploadURL();

  return res.send({ url });
});
export = utilsRouter;
