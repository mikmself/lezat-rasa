import kafka from "../utils/kafkaClient.js"; // Mengimpor client Kafka
import db from "../utils/database.js";     // Mengimpor koneksi database untuk analisis data

const consumer = kafka.consumer({ groupId: "manager-group" }); // Membuat consumer untuk grup 'manager-group'

const runManager = async () => {
  try {
    await consumer.connect(); // Menghubungkan consumer
    console.log("[Manager] Consumer terhubung.");

    // Subscribe ke semua topik untuk memantau seluruh alur
    await consumer.subscribe({
      topics: ["pemesan", "konfirmasi-pesanan", "order", "notifikasi", "pembayaran"],
      fromBeginning: true, // Mulai dari awal topik
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const data = JSON.parse(message.value.toString());
        console.log(`[Manager] Menerima pesan dari topik "${topic}": ${JSON.stringify(data)}`);

        // Logika analisis Manager bisa ditambahkan di sini.
        // Contoh: Mengambil data pesanan dari DB untuk melacak status dan menghitung durasi.
        if (data.id_pesanan) { // Jika pesan mengandung ID pesanan
            try {
                const [rows] = await db.execute(
                    `SELECT
                        id,
                        nama_customer,
                        nomor_meja,
                        status,
                        tanggal AS waktu_pemesanan,
                        timestamp_konfirmasi AS waktu_konfirmasi,
                        timestamp_siap AS waktu_siap,
                        timestamp_bayar AS waktu_bayar
                    FROM pesanan WHERE id = ?`,
                    [data.id_pesanan]
                );
                if (rows.length > 0) {
                    const orderInfo = rows[0];
                    console.log(`--- [Manager - Analisis Pesanan #${orderInfo.id}] ---`);
                    console.log(`  Customer: ${orderInfo.nama_customer}, Meja: ${orderInfo.nomor_meja}`);
                    console.log(`  Status Terkini: ${orderInfo.status}`);
                    console.log(`  Waktu Pesan: ${orderInfo.waktu_pemesanan}`);

                    // Hitung durasi setiap tahap jika timestamp tersedia
                    if (orderInfo.waktu_konfirmasi) {
                        const durasiKonfirmasi = new Date(orderInfo.waktu_konfirmasi).getTime() - new Date(orderInfo.waktu_pemesanan).getTime();
                        console.log(`  Durasi Konfirmasi oleh Waiters: ${durasiKonfirmasi / 1000} detik`);
                    }
                    if (orderInfo.waktu_siap) {
                        const durasiMemasak = new Date(orderInfo.waktu_siap).getTime() - (orderInfo.waktu_konfirmasi ? new Date(orderInfo.waktu_konfirmasi).getTime() : new Date(orderInfo.waktu_pemesanan).getTime());
                        console.log(`  Durasi Memasak oleh Dapur: ${durasiMemasak / 1000} detik`);
                    }
                    if (orderInfo.waktu_bayar) {
                        const durasiPembayaran = new Date(orderInfo.waktu_bayar).getTime() - (orderInfo.waktu_siap ? new Date(orderInfo.waktu_siap).getTime() : new Date(orderInfo.waktu_pemesanan).getTime());
                        console.log(`  Durasi Pembayaran oleh Kasir: ${durasiPembayaran / 1000} detik`);
                    }
                    if (orderInfo.waktu_pemesanan && orderInfo.waktu_bayar) {
                        const durasiTotalMs = new Date(orderInfo.waktu_bayar).getTime() - new Date(orderInfo.waktu_pemesanan).getTime();
                        console.log(`  Total Waktu Pemrosesan Pesanan: ${durasiTotalMs / 1000} detik`);
                    }
                    console.log(`------------------------------------`);
                }
            } catch (dbErr) {
                console.error("[Manager] Gagal mengambil data pesanan dari DB untuk analisis:", dbErr);
            }
        }
      },
    });
  } catch (error) {
    console.error("[Manager] Error pada consumer Manager:", error);
  }
};

// Jalankan peran Manager
runManager().catch(console.error); 