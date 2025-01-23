import amqplib, { Connection, Channel, Message } from "amqplib";

let connection: Connection | null = null;
let channel: Channel | null = null;

export async function connect(): Promise<Channel> {
  if (!connection) {
    connection = await amqplib.connect("amqp://user:password@localhost:5672");
    channel = await connection.createChannel();
    console.log("Connected to RabbitMQ");
  }

  return channel!;
}

export async function disconnect(): Promise<void> {
  if (connection && channel) {
    await channel.close();
    await connection.close();
    console.log("Disconnected from RabbitMQ");
  }
}

export async function consume(callback: (msg: Message) => void): Promise<void> {
  if (!channel) {
    throw new Error("Channel is not connected");
  }

  // Ensure the queue exists before consuming
  await channel.assertQueue("task_queue", { durable: true });
  console.log("Queue task_queue asserted");

  // Consume messages from the queue
  await channel.consume(
    "task_queue",
    (msg) => {
      if (msg) {
        try {
          const content = msg.content.toString();
          const parsedData = JSON.parse(content);

          const { key, bucket } = parsedData;
          console.log(`Received key: ${key}, bucket: ${bucket}`);

          callback(msg);

          channel!.ack(msg);
        } catch (err) {
          console.error("Error processing message:", err);
          channel!.nack(msg, false, true);
        }
      }
    },
    {
      noAck: false,
    }
  );

  console.log(`Consuming from queue: ${"task_queue"}`);
}

async function startConsumer() {
  await connect();
  console.log("Connected to RabbitMQ");

  await consume((msg) => {
    console.log('Processing message:', msg.content.toString());
  });
}

// Run the consumer
startConsumer().catch(console.error);