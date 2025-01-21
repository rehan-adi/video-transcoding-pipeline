import express from "express";
import { upload } from "../utils/multer";
import { uploadFile } from "../controllers/upload";

export const uploadRouter = express.Router();

uploadRouter.post("/", upload.single("video"), uploadFile);
