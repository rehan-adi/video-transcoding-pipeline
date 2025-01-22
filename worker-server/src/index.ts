import env from "dotenv";
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

const receiveMessages = async (): Promise<void> => {
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
      console.log("Received Message:", data.Messages[0].Body);

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
