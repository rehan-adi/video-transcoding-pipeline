import fs from "fs";
import path from "path";
import env from "dotenv";
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
          const transcodedFiles = getAllFiles(videoOutputDir);
          console.log("Transcoded files:", transcodedFiles);

          for (const transcodedFilePath of transcodedFiles) {
            const transcodedFileName = path.relative(
              videoOutputDir,
              transcodedFilePath
            ); // Maintain relative paths
            const uploadKey = path.join(videoId, transcodedFileName);

            // Read and upload each file
            const fileContent = await fs.promises.readFile(transcodedFilePath);

            await s3.send(
              new PutObjectCommand({
                Bucket: OUTPUT_BUCKET,
                Key: uploadKey,
                Body: fileContent,
                ContentType: transcodedFileName.endsWith(".m3u8")
                  ? "application/vnd.apple.mpegurl"
                  : "video/MP2T",
              })
            );

            console.log(`Uploaded ${uploadKey} to ${OUTPUT_BUCKET}`);
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
