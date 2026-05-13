import { Kafka, logLevel, Producer } from "kafkajs";
import { ENV } from "../config/env";

const kafka = new Kafka({
  clientId: "smartqueue-producer",
  brokers: [ENV.KAFKA.broker],
  logLevel: logLevel.WARN,
});

let producer: Producer;

export const connectProducer = async (): Promise<void> => {
  producer = kafka.producer();
  await producer.connect();
  console.log("✅ Kafka producer connected");
};

export const publishEvent = async (
  topic: string,
  message: object
): Promise<void> => {
  if (!producer) {
    console.warn("⚠️ Kafka producer not connected");
    return;
  }

  await producer.send({
    topic,
    messages: [
      {
        value: JSON.stringify(message),
        timestamp: Date.now().toString(),
      },
    ],
  });
};

export default kafka;