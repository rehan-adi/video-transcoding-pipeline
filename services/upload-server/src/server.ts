import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import express from "express";
import { uploadRouter } from "./routes/upload";

env.config();

const server = express();

// middleware
server.use(cors());
server.use(express.json());
server.use(morgan("dev"));
server.use(helmet());

// routes
server.use("/api/v1/upload", uploadRouter);

// health check
server.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Ok" });
});

server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
