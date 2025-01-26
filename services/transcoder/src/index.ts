import fs from "fs";
import path from "path";
import { s3 } from "./utils/s3";
import { promisify } from "util";
import { pipeline } from "stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { processVideoForHLS } from "./utils/processVideo";
import { connectConsumer, consumeMessages } from "rabbitmq";
import { createWriteStream, mkdirSync, existsSync } from "fs";

const pipelineAsync = promisify(pipeline);

const ensureDownloadDirectory = () => {
  const downloadDir = path.resolve(__dirname, "downloads");
  if (!existsSync(downloadDir)) {
    mkdirSync(downloadDir, { recursive: true });
  }
  return downloadDir;
};

const main = async () => {
  try {
    await connectConsumer();
    console.log("Connected to RabbitMQ");

    await consumeMessages(async (messageContent, rawMessage) => {
      let filePath;
      try {
        const { bucket, key } = JSON.parse(messageContent);

        const downloadDir = ensureDownloadDirectory();

        const safeFileName = path.basename(key).replace(/[^a-zA-Z0-9.-]/g, "_");
        filePath = path.join(downloadDir, safeFileName);

        // Download from S3
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const { Body } = await s3.send(command);

        if (!Body) {
          throw new Error("No body found in S3 object");
        }

        // Create write stream
        const writeStream = createWriteStream(filePath);

        console.log("Downloading video file...");
        const bodyStream = Body as unknown as NodeJS.ReadableStream;
        await pipelineAsync(bodyStream, writeStream);

        console.log(`Video downloaded successfully to ${filePath}`);

        try {
          await processVideoForHLS(
            filePath,
            path.join("./output"),
            key,
            bucket
          );
          console.log("Video processing complete");
        } catch (error) {
          console.error("Error during video processing:", error);
        } finally {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("Deleted video file from downloads folder");
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
        throw error;
      }
    });
  } catch (error) {
    console.error("Error in main:", error);
  }
};

main().catch((err) => {
  console.error("Unhandled error in main:", err);
});
