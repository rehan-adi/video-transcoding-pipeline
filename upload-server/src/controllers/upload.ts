import s3 from "../utils/s3";
import { Request, Response } from "express";

export const uploadFile = async (req: Request, res: Response) => {
  try {
    console.log(req.file);

    res
      .status(200)
      .json({ success: true, message: "Video uploaded successfully" });
  } catch (error) {
    console.error(error, "Error uploading file");
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
