import amqp, { Channel, Connection, ConsumeMessage } from "amqplib";

let channel: Channel;

const connectConsumer = async (): Promise<Connection> => {
  const connection = await amqp.connect("amqp://user:password@localhost:5672");
  channel = await connection.createChannel();
  await channel.assertQueue("task_queue", { durable: true });
  return connection;
};

const consumeMessages = async (
  onMessage: (
    messageContent: string,
    rawMessage: ConsumeMessage
  ) => Promise<void>
): Promise<void> => {
  if (!channel) {
    throw new Error(
      "Channel not initialized. Please connect to RabbitMQ first."
    );
  }

  console.log('Waiting for messages in "task_queue"...');

  channel.consume(
    "task_queue",
    async (msg) => {
      if (msg) {
        try {
          const content = msg.content.toString();
          console.log(`Received message: ${content}`);

          // Pass the message content and the raw message to the callback
          await onMessage(content, msg);

          // Acknowledge the message after successful processing
          channel.ack(msg);
        } catch (error) {
          console.error("Error processing message:", error);

          // Optionally reject the message and don't requeue it
          channel.nack(msg, false, false);
        }
      }
    },
    { noAck: false } // Ensures messages must be acknowledged manually
  );
};

export { connectConsumer, consumeMessages };
