import kafka from "../utils/kafkaClient.js"; // Mengimpor client Kafka
import db from "../utils/database.js";     // Mengimpor koneksi database
import readline from "readline";

const consumer = kafka.consumer({ groupId: "kasir-group" }); // Membuat consumer untuk grup 'kasir-group'
const producer = kafka.producer(); // Membuat producer untuk mengirim detail pembayaran

// Buat interface readline untuk input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk menanyakan input dengan promise
const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

// Fungsi untuk menampilkan daftar pesanan yang siap dibayar
const tampilkanPesananSiapBayar = async () => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, 
             GROUP_CONCAT(CONCAT(dp.nama_makanan, ' (', dp.jumlah, 'x @', dp.harga_satuan, ')') SEPARATOR ', ') as detail_menu
      FROM pesanan p
      LEFT JOIN detail_pesanan dp ON p.id = dp.id_pesanan
      WHERE p.status = 'Makanan Siap'
      GROUP BY p.id
      ORDER BY p.timestamp_siap ASC
    `);

    if (rows.length === 0) {
      console.log("\n💳 Tidak ada pesanan yang siap dibayar.");
      return [];
    }

    console.log("\n💳 === DAFTAR PESANAN YANG SIAP DIBAYAR ===");
    rows.forEach((pesanan, index) => {
      console.log(`\n${index + 1}. 🪑 Meja ${pesanan.nomor_meja} - ${pesanan.nama_customer}`);
      console.log(`   📅 Siap: ${new Date(pesanan.timestamp_siap).toLocaleString()}`);
      console.log(`   🍽️  Menu: ${pesanan.detail_menu}`);
      console.log(`   💰 Total: Rp${pesanan.total_harga.toLocaleString()}`);
      console.log(`   🆔 ID: ${pesanan.id}`);
    });

    return rows;
  } catch (error) {
    console.error("[Kasir] Error mengambil data pesanan:", error);
    return [];
  }
};

// Fungsi untuk memproses pembayaran
const prosesPembayaran = async (pesanan) => {
  try {
    console.log(`\n✅ Memproses pembayaran pesanan #${pesanan.id}...`);

    // Tampilkan detail pembayaran
    console.log(`\n💰 === DETAIL PEMBAYARAN ===`);
    console.log(`👤 Customer: ${pesanan.nama_customer}`);
    console.log(`🪑 Meja: ${pesanan.nomor_meja}`);
    console.log(`💳 Total Pembayaran: Rp${pesanan.total_harga.toLocaleString()}`);

    // Tanya metode pembayaran
    console.log(`\n💳 Pilih metode pembayaran:`);
    console.log(`1. 💰 Tunai`);
    console.log(`2. 💳 Debit/Credit Card`);
    console.log(`3. 📱 QRIS`);
    console.log(`4. 🏦 Transfer Bank`);

    const metodePembayaran = await question("Pilih metode (1-4): ");
    let metode = "";
    switch (metodePembayaran) {
      case "1": metode = "Tunai"; break;
      case "2": metode = "Debit/Credit Card"; break;
      case "3": metode = "QRIS"; break;
      case "4": metode = "Transfer Bank"; break;
      default: metode = "Tunai";
    }

    // Konfirmasi pembayaran
    const konfirmasi = await question(`\n❓ Konfirmasi pembayaran Rp${pesanan.total_harga.toLocaleString()} dengan ${metode}? (y/n): `);
    
    if (konfirmasi.toLowerCase() === 'y' || konfirmasi.toLowerCase() === 'yes') {
      // Update status pesanan
      const updateSql = `
        UPDATE pesanan
        SET status = ?, timestamp_bayar = NOW()
        WHERE id = ?
      `;
      await db.execute(updateSql, ["Selesai Dibayar", pesanan.id]);
      console.log(`[Kasir] Status pesanan #${pesanan.id} diupdate menjadi 'Selesai Dibayar'`);

      // Kirim detail pembayaran ke topik pembayaran
      await producer.send({
        topic: "pembayaran",
        messages: [{ value: JSON.stringify({
          id_pesanan: pesanan.id,
          nomor_meja: pesanan.nomor_meja,
          total_pembayaran: pesanan.total_harga,
          metode_pembayaran: metode,
          status_pembayaran: "Berhasil"
        }) }],
      });

      console.log(`[Kasir] ✅ Pembayaran #${pesanan.id} berhasil diproses`);
      console.log(`🧾 Struk pembayaran telah dicetak untuk ${pesanan.nama_customer}`);
    } else {
      console.log("❌ Pembayaran dibatalkan.");
    }
    
  } catch (error) {
    console.error("[Kasir] Error memproses pembayaran:", error);
  }
};

// Fungsi untuk menyimpan notifikasi makanan siap
const simpanNotifikasiMakananSiap = async (notification) => {
  try {
    const { id_pesanan, nomor_meja } = notification;
    
    console.log(`\n📨 [Kasir] Menerima notifikasi makanan siap: Meja ${nomor_meja}`);
    console.log(`[Kasir] ✅ Pesanan #${id_pesanan} siap untuk pembayaran`);
    
  } catch (error) {
    console.error("[Kasir] Error menyimpan notifikasi:", error);
  }
};

// Fungsi untuk menu utama kasir
const menuKasir = async () => {
  console.log("\n👨‍💼 === SISTEM KASIR ===");
  console.log("1. 📋 Lihat pesanan siap dibayar");
  console.log("2. 💳 Proses pembayaran");
  console.log("3. 🔄 Refresh data");
  console.log("4. 🚪 Keluar");
  
  const pilihan = await question("\nPilih menu (1-4): ");
  
  switch (pilihan) {
    case "1":
      await tampilkanPesananSiapBayar();
      break;
    case "2":
      const pesananList = await tampilkanPesananSiapBayar();
      if (pesananList.length > 0) {
        const pilihanPesanan = await question(`\nPilih nomor pesanan yang akan dibayar (1-${pesananList.length}): `);
        const index = parseInt(pilihanPesanan) - 1;
        if (index >= 0 && index < pesananList.length) {
          await prosesPembayaran(pesananList[index]);
        } else {
          console.log("❌ Nomor pesanan tidak valid!");
        }
      }
      break;
    case "3":
      console.log("🔄 Data diperbarui...");
      break;
    case "4":
      return false;
    default:
      console.log("❌ Pilihan tidak valid!");
  }
  
  return true;
};

// Fungsi utama
const runKasir = async () => {
  try {
    await consumer.connect();
    await producer.connect();
    console.log("[Kasir] ✅ Consumer dan Producer terhubung");

    // Subscribe ke topik notifikasi
    await consumer.subscribe({ topic: "notifikasi", fromBeginning: true });

    // Jalankan consumer di background
    consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const notification = JSON.parse(message.value.toString());
        await simpanNotifikasiMakananSiap(notification);
      },
    });

    // Jalankan menu interaktif
    let lanjut = true;
    while (lanjut) {
      lanjut = await menuKasir();
      if (lanjut) {
        await question("\nTekan Enter untuk melanjutkan...");
      }
    }

  } catch (error) {
    console.error("[Kasir] Error:", error);
  } finally {
    await consumer.disconnect();
    await producer.disconnect();
    rl.close();
    console.log("[Kasir] 🔌 Terputus dari sistem");
  }
};

// Jalankan aplikasi
runKasir().catch(console.error); 