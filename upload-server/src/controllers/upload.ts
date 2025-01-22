import fs from "fs";
import { s3 } from "../utils/s3";
import { Request, Response } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: req.file.originalname,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3.send(command);

    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error("Error deleting file from local storage:", err);
      } else {
        console.log("File deleted from local storage");
      }
    });

    res.status(200).json({
      success: true,
      message: "Video uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
