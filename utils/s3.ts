import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import crypto from "crypto";
import "dotenv/config";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MiB

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials:
    process.env.S3_ACCESS_KEY && process.env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  forcePathStyle: true,
});

export const generateUploadURL = async () => {
  const imageName = crypto.randomBytes(16).toString("hex");
  const key = imageName;

  const presigned = await createPresignedPost(s3, {
    Bucket: process.env.S3_BUCKET_NAME as string,
    Key: key,
    Expires: 60,
    Conditions: [
      ["content-length-range", 1, MAX_FILE_SIZE],
      ["eq", "$Content-Type", "image/jpeg"],
    ],
    Fields: {
      "Content-Type": "image/jpeg",
    },
  });

  return { ...presigned, key };
};
