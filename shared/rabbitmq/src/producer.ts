import amqp, { Channel, Connection } from "amqplib";

let channel: Channel;

const connectProducer = async (): Promise<Connection> => {
  const connection = await amqp.connect("amqp://user:password@localhost:5672");
  channel = await connection.createChannel();
  await channel.assertQueue("task_queue", { durable: true });
  return connection;
};

const publishMessage = async (message: string): Promise<void> => {
  if (!channel) {
    throw new Error("Channel not initialized");
  }
  channel.sendToQueue("task_queue", Buffer.from(message), {
    persistent: true,
  });
  console.log(`Message sent: ${message}`);
};

export { connectProducer, publishMessage };
