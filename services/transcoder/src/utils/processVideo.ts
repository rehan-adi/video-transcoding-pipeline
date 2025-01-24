import fs from "fs";
import path from "path";
import prisma from "database";
import ffmpeg from "fluent-ffmpeg";

export const processVideoForHLS = async (
  inputFile: string,
  outputDir: string,
  key: string,
  bucket: string
) => {
  return new Promise<void>((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Start the ffmpeg process to transcode the video for HLS
    ffmpeg(inputFile)
      // Output for 480p video stream
      .output(path.join(outputDir, "480p.m3u8"))
      .videoCodec("libx264")
      .size("854x480")
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
      )

      // Output for 720p video stream
      .output(path.join(outputDir, "720p.m3u8"))
      .videoCodec("libx264")
      .size("1280x720")
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
      )

      // Output for 1080p video stream
      .output(path.join(outputDir, "1080p.m3u8"))
      .videoCodec("libx264")
      .size("1920x1080")
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
      )

      // Event listeners
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
      .on("error", (err: Error) => {
        console.error("Error during video processing:", err.message);
        reject(err);
      })
      .on("end", () => {
        console.log("HLS processing complete.");
        resolve();
      })
      .run();
  });
};
