import { s3 } from "./utils/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { connectConsumer, consumeMessages } from "rabbitmq";

const main = async () => {
  try {
    await connectConsumer();
    console.log("Connected to RabbitMQ");

    await consumeMessages(async (messageContent, rawMessage) => {
      try {
        const { bucket, key } = JSON.parse(messageContent);
        console.log(`Processing message: bucket=${bucket}, key=${key}`);

        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const data = await s3.send(command);

        console.log("S3 Object Data:", data);
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
