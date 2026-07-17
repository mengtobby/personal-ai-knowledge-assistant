import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { S3Settings } from "../config.js";
import type { BlobStorage } from "./types.js";

export function createS3Storage(settings: S3Settings): BlobStorage {
  const client = new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: settings.forcePathStyle,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });

  return {
    async put(key, data, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: settings.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
        })
      );
    },
    async get(key) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: settings.bucket, Key: key })
      );
      if (!result.Body) throw new Error(`Empty S3 response for key ${key}`);
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async delete(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: settings.bucket, Key: key })
      );
    },
  };
}
