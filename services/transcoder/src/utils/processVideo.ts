import fs from "fs";
import path from "path";
import prisma from "database";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from "uuid";

export const processVideoForHLS = async (
  inputFile: string,
  outputDir: string,
  key: string,
  bucket: string
) => {
  return new Promise<string>((resolve, reject) => {
    // Generate a unique video ID based on the original key and current timestamp
    const videoId = `${path.basename(
      key,
      path.extname(key)
    )}_${Date.now()}_${uuidv4()}`;
    const videoOutputDir = path.join(outputDir, videoId);

    if (!fs.existsSync(videoOutputDir)) {
      fs.mkdirSync(videoOutputDir, { recursive: true });
    }

    const resolutions = [
      { label: "480p", size: "854x480" },
      { label: "720p", size: "1280x720" },
      { label: "1080p", size: "1920x1080" },
    ];

    const ffmpegInstance = ffmpeg(inputFile);

    resolutions.forEach(({ label, size }) => {
      const resolutionDir = path.join(videoOutputDir, label);

      if (!fs.existsSync(resolutionDir)) {
        fs.mkdirSync(resolutionDir, { recursive: true });
      }

      // HLS Output
      ffmpegInstance
        .output(path.join(resolutionDir, `${label}.m3u8`))
        .videoCodec("libx264")
        .size(size)
        .outputOptions(
          "-preset",
          "veryfast",
          "-g",
          "48",
          "-sc_threshold",
          "0",
          "-hls_time",
          "6",
          "-hls_playlist_type",
          "vod"
        );

      // MP4 Output
      ffmpegInstance
        .output(path.join(videoOutputDir, `${label}.mp4`))
        .videoCodec("libx264")
        .size(size)
        .outputOptions("-preset", "veryfast", "-crf", "23");
    });

    ffmpegInstance
      .on("start", async (commandLine) => {
        console.log("FFmpeg process started with command:", commandLine);

        try {
          await prisma.video.update({
            where: {
              bucket_key: {
                bucket: bucket,
                key: key,
              },
            },
            data: {
              status: "Processing",
            },
          });
          console.log(`Video status updated to 'Processing' for ${key}`);
        } catch (err) {
          console.error("Error updating video status to 'Processing':", err);
        }
      })
      .on("progress", (progress) => {
        console.log(`Processing: ${progress.percent?.toFixed(2)}%`);
      })
      .on("error", async (err: Error) => {
        try {
          await prisma.video.update({
            where: {
              bucket_key: {
                bucket: bucket,
                key: key,
              },
            },
            data: {
              status: "Failed",
              updatedAt: new Date(),
            },
          });
        } catch (error) {
          console.error("Error during video processing database update", error);
        }
        console.error("Error during video processing:", err.message);
        reject(err);
      })
      .on("end", async () => {
        console.log("Video processing complete.");
        try {
          await prisma.video.update({
            where: {
              bucket_key: {
                bucket: bucket,
                key: key,
              },
            },
            data: {
              status: "Published",
              updatedAt: new Date(),
            },
          });
        } catch (error) {
          console.error("Error updating video status to 'Published':", error);
        }
        resolve(videoId);
      })
      .run();
  });
};
