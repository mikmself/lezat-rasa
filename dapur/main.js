import kafka from "../utils/kafkaClient.js"; // Mengimpor client Kafka
import db from "../utils/database.js";     // Mengimpor koneksi database
import readline from "readline";

const consumer = kafka.consumer({ groupId: "dapur-group" }); // Membuat consumer untuk grup 'dapur-group'
const producer = kafka.producer(); // Membuat producer untuk mengirim notifikasi

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

// Fungsi untuk menampilkan daftar pesanan yang perlu dimasak
const tampilkanPesananMasak = async () => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, 
             GROUP_CONCAT(CONCAT(dp.nama_makanan, ' (', dp.jumlah, 'x)') SEPARATOR ', ') as detail_menu
      FROM pesanan p
      LEFT JOIN detail_pesanan dp ON p.id = dp.id_pesanan
      WHERE p.status = 'Diteruskan ke Dapur'
      GROUP BY p.id
      ORDER BY p.timestamp_konfirmasi ASC
    `);

    if (rows.length === 0) {
      console.log("\n🍳 Tidak ada pesanan yang perlu dimasak.");
      return [];
    }

    console.log("\n🍳 === DAFTAR PESANAN YANG PERLU DIMASAK ===");
    rows.forEach((pesanan, index) => {
      console.log(`\n${index + 1}. 🪑 Meja ${pesanan.nomor_meja} - ${pesanan.nama_customer}`);
      console.log(`   📅 Konfirmasi: ${new Date(pesanan.timestamp_konfirmasi).toLocaleString()}`);
      console.log(`   🍽️  Menu: ${pesanan.detail_menu}`);
      console.log(`   💰 Total: Rp${pesanan.total_harga.toLocaleString()}`);
      console.log(`   🆔 ID: ${pesanan.id}`);
    });

    return rows;
  } catch (error) {
    console.error("[Dapur] Error mengambil data pesanan:", error);
    return [];
  }
};

// Fungsi untuk memproses pesanan yang sudah siap
const prosesPesananSiap = async (pesanan) => {
  try {
    console.log(`\n✅ Menandai pesanan #${pesanan.id} sebagai siap...`);

    // Update status pesanan
    const updateSql = `
      UPDATE pesanan
      SET status = ?, timestamp_siap = NOW()
      WHERE id = ?
    `;
    await db.execute(updateSql, ["Makanan Siap", pesanan.id]);
    console.log(`[Dapur] Status pesanan #${pesanan.id} diupdate menjadi 'Makanan Siap'`);

    // Kirim notifikasi ke topik notifikasi
    await producer.send({
      topic: "notifikasi",
      messages: [{ value: JSON.stringify({ 
        id_pesanan: pesanan.id, 
        nomor_meja: pesanan.nomor_meja, 
        status: "Makanan Siap Diantar" 
      }) }],
    });

    console.log(`[Dapur] ✅ Pesanan #${pesanan.id} berhasil ditandai siap dan notifikasi dikirim`);
    
  } catch (error) {
    console.error("[Dapur] Error memproses pesanan:", error);
  }
};

// Fungsi untuk menyimpan pesanan baru dari waiters
const simpanPesananBaru = async (orderData) => {
  try {
    const { id_pesanan, nomor_meja, items, nama_customer } = orderData;
    
    console.log(`\n📨 [Dapur] Menerima pesanan baru dari Waiters: ${nama_customer} (Meja ${nomor_meja})`);
    console.log(`🍽️  Menu yang perlu dimasak:`);
    items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.nama_makanan} - ${item.jumlah}x`);
    });
    console.log(`[Dapur] ✅ Pesanan #${id_pesanan} siap untuk dimasak`);
    
  } catch (error) {
    console.error("[Dapur] Error menyimpan pesanan:", error);
  }
};

// Fungsi untuk menu utama dapur
const menuDapur = async () => {
  console.log("\n👨‍🍳 === SISTEM DAPUR ===");
  console.log("1. 📋 Lihat pesanan yang perlu dimasak");
  console.log("2. ✅ Tandai pesanan siap");
  console.log("3. 🔄 Refresh data");
  console.log("4. 🚪 Keluar");
  
  const pilihan = await question("\nPilih menu (1-4): ");
  
  switch (pilihan) {
    case "1":
      await tampilkanPesananMasak();
      break;
    case "2":
      const pesananList = await tampilkanPesananMasak();
      if (pesananList.length > 0) {
        const pilihanPesanan = await question(`\nPilih nomor pesanan yang sudah siap (1-${pesananList.length}): `);
        const index = parseInt(pilihanPesanan) - 1;
        if (index >= 0 && index < pesananList.length) {
          await prosesPesananSiap(pesananList[index]);
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
const runDapur = async () => {
  try {
    await consumer.connect();
    await producer.connect();
    console.log("[Dapur] ✅ Consumer dan Producer terhubung");

    // Subscribe ke topik order
    await consumer.subscribe({ topic: "order", fromBeginning: true });

    // Jalankan consumer di background
    consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const orderData = JSON.parse(message.value.toString());
        await simpanPesananBaru(orderData);
      },
    });

    // Jalankan menu interaktif
    let lanjut = true;
    while (lanjut) {
      lanjut = await menuDapur();
      if (lanjut) {
        await question("\nTekan Enter untuk melanjutkan...");
      }
    }

  } catch (error) {
    console.error("[Dapur] Error:", error);
  } finally {
    await consumer.disconnect();
    await producer.disconnect();
    rl.close();
    console.log("[Dapur] 🔌 Terputus dari sistem");
  }
};

// Jalankan aplikasi
runDapur().catch(console.error); 