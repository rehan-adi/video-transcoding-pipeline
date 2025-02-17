import env from "dotenv";
import prisma from "database";
import { connectProducer, publishMessage } from "rabbitmq";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  QueueAttributeName,
} from "@aws-sdk/client-sqs";

env.config();

const sqsClient = new SQSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Initialize RabbitMQ connection once
let producerConnected = false;
const initializeRabbitMQ = async (): Promise<void> => {
  if (!producerConnected) {
    try {
      await connectProducer();
      producerConnected = true;
      console.log("Connected to RabbitMQ");
    } catch (error) {
      console.error("Error connecting to RabbitMQ:", error);
      throw new Error(
        "Failed to connect to RabbitMQ, stopping further processing"
      );
    }
  }
};

const receiveMessages = async (): Promise<void> => {
  // params for receiving messages
  const params = {
    QueueUrl: process.env.SQS_QUEUE_URL!,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20,
    AttributeNames: [QueueAttributeName.All],
    MessageAttributeNames: ["All"],
  };

  try {
    const command = new ReceiveMessageCommand(params);
    const data = await sqsClient.send(command);

    if (data.Messages && data.Messages.length > 0) {
      if (data.Messages[0].Body) {
        const message = JSON.parse(data.Messages[0].Body);

        // Extract bucket and key from the correct path
        const record = message.Records[0];
        const bucket = record.s3.bucket.name;
        const key = record.s3.object.key;

        // Insert video key and bucket into the database
        try {
          await prisma.video.create({
            data: {
              key,
              bucket,
              status: "Pending",
            },
          });
          console.log("Video inserted into database");
        } catch (error) {
          console.error("Error inserting video into database:", error);
        }
        await initializeRabbitMQ();

        try {
          await publishMessage(JSON.stringify({ key, bucket }));
          console.log("Message sent to RabbitMQ");
        } catch (rabbitmqError) {
          console.error("Error sending message to RabbitMQ:", rabbitmqError);
          return;
        }
      } else {
        throw new Error("Message body is undefined");
      }

      const deleteParams = {
        QueueUrl: process.env.SQS_QUEUE_URL!,
        ReceiptHandle: data.Messages[0].ReceiptHandle!,
      };

      const deleteCommand = new DeleteMessageCommand(deleteParams);
      await sqsClient.send(deleteCommand);
      console.log("Message deleted from queue");
    } else {
      console.log("No messages to process");
    }
  } catch (err) {
    console.error("Error receiving message:", err);
  }
};

// Continuously poll for messages
const startPolling = () => {
  setInterval(() => {
    receiveMessages();
  }, 10000);
};

startPolling();
