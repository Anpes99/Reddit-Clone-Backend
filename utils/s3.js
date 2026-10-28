const aws = require("aws-sdk");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MiB

const s3 = new aws.S3({
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  signatureVersion: "v4",
});

const generateUploadURL = async () => {
  const imageName = crypto.randomBytes(16).toString("hex");
  const key = imageName;

  const presigned = await s3.createPresignedPost({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Expires: 60,
    Conditions: [
      ["content-length-range", 1, MAX_FILE_SIZE],
      ["eq", "$Content-Type", "image/jpeg"],
    ],
    Fields: {
      "Content-Type": "image/jpeg",
      key,
    },
  });

  return { ...presigned, key };
};

module.exports = { generateUploadURL };
