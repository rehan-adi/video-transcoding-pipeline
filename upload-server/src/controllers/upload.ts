import { Request, Response } from "express";

export const uploadFile = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error(error, "Error uploading file");
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
