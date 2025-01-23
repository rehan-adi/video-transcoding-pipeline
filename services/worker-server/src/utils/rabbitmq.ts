import amqplib, { Connection, Channel } from "amqplib";

let connection: Connection | null = null;
let channel: Channel | null = null;

export async function connect(url: string): Promise<Channel> {
  if (!connection) {
    connection = await amqplib.connect(url);
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

export async function produce(message: string) {
  const channel = await connect("amqp://user:password@localhost:5672");
  await channel.assertQueue("task_queue", { durable: true });
  console.log(`Sending message: ${message}`);

  channel.sendToQueue("task_queue", Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
  console.log(`Sent message: ${JSON.stringify(message)}`);
}
