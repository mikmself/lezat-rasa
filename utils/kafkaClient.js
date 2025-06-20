import { Kafka } from "kafkajs";

// Konfigurasi Kafka client
const kafka = new Kafka({
  clientId: "lezat-rasa-app", // ID unik untuk aplikasi Kafka ini
  brokers: ["192.168.0.108:9092"], // Alamat IP dan port broker Kafka Anda
});

export default kafka; 