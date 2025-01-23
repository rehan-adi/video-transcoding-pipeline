import amqp, { Channel, Connection } from "amqplib";

let channel: Channel;

const connectConsumer = async (): Promise<Connection> => {
  const connection = await amqp.connect("amqp://user:password@localhost:5672");
  channel = await connection.createChannel();
  await channel.assertQueue("task_queue", { durable: true });
  return connection;
};

const consumeMessages = async (): Promise<void> => {
  if (!channel) {
    throw new Error("Channel not initialized");
  }
  console.log('Waiting for messages in "task_queue"...');
  channel.consume(
    "task_queue",
    (msg) => {
      if (msg) {
        const content = msg.content.toString();
        console.log(`Received message: ${content}`);
        // Acknowledge the message to RabbitMQ
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
};

export { connectConsumer, consumeMessages };
