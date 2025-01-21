import express from "express";
import { uploadFile } from "../controllers/upload";

export const uploadRouter = express.Router();

uploadRouter.post("/", uploadFile);
