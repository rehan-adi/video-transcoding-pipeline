import fs from "fs";
import path from "path";
import env from "dotenv";
import prisma from "database";
import { s3 } from "./utils/s3";
import { promisify } from "util";
import { pipeline } from "stream";
import { createWriteStream } from "fs";
import { processVideoForHLS } from "./utils/processVideo";
import { connectConsumer, consumeMessages } from "rabbitmq";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  getAllFiles,
  ensureDownloadDirectory,
  deleteDirectoryRecursive,
} from "./utils/utils";

env.config();

const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET!;

const pipelineAsync = promisify(pipeline);

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

        const outputDir = path.join(__dirname, "output");

        try {
          const videoId = await processVideoForHLS(
            filePath,
            outputDir,
            key,
            bucket
          );
          console.log("Video processing complete");

          const videoOutputDir = path.join(outputDir, videoId);

          // Upload the entire videoId folder to S3
          const mp4Files = getAllFiles(videoOutputDir);
          console.log("MP4 files to upload:", mp4Files);

          for (const mp4FilePath of mp4Files) {
            const resolution = path.basename(mp4FilePath, ".mp4");
            const uploadKey = path.join(videoId, `${resolution}.mp4`);

            // Read file content
            const fileContent = await fs.promises.readFile(mp4FilePath);

            await s3.send(
              new PutObjectCommand({
                Bucket: OUTPUT_BUCKET,
                Key: uploadKey,
                Body: fileContent,
                ContentType: "video/mp4",
              })
            );

            console.log(
              `Uploaded ${resolution}.mp4 to ${OUTPUT_BUCKET}/${uploadKey}`
            );

            await prisma.video.update({
              where: {
                bucket_key: { bucket, key },
              },
              data: {
                outputBucket: OUTPUT_BUCKET,
                outputKey: videoId,
              },
            });
          }

          // Delete the processed video from S3
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          });

          await s3.send(deleteCommand);
          console.log("Deleted video file from S3");

          // Delete the output directory
          try {
            deleteDirectoryRecursive(videoOutputDir);
          } catch (error) {
            console.error("Error deleting video output directory:", error);
          }
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
