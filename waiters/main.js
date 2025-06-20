import kafka from "../utils/kafkaClient.js"; // Mengimpor client Kafka
import db from "../utils/database.js";     // Mengimpor koneksi database
import { v4 as uuidv4 } from 'uuid';       // Untuk membuat ID unik
import readline from "readline";

const consumer = kafka.consumer({ groupId: "waiters-group" }); // Membuat consumer untuk grup 'waiters-group'
const producer = kafka.producer(); // Membuat producer untuk mengirim pesan ke topik lain

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

// Fungsi untuk menampilkan daftar pesanan pending
const tampilkanPesananPending = async () => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, 
             GROUP_CONCAT(CONCAT(dp.nama_makanan, ' (', dp.jumlah, 'x @', dp.harga_satuan, ')') SEPARATOR ', ') as detail_menu
      FROM pesanan p
      LEFT JOIN detail_pesanan dp ON p.id = dp.id_pesanan
      WHERE p.status = 'Diterima Waiters'
      GROUP BY p.id
      ORDER BY p.tanggal ASC
    `);

    if (rows.length === 0) {
      console.log("\n📭 Tidak ada pesanan pending untuk dikonfirmasi.");
      return [];
    }

    console.log("\n📋 === DAFTAR PESANAN PENDING ===");
    rows.forEach((pesanan, index) => {
      console.log(`\n${index + 1}. 🪑 Meja ${pesanan.nomor_meja} - ${pesanan.nama_customer}`);
      console.log(`   📅 ${new Date(pesanan.tanggal).toLocaleString()}`);
      console.log(`   🍽️  Menu: ${pesanan.detail_menu}`);
      console.log(`   💰 Total: Rp${pesanan.total_harga.toLocaleString()}`);
      console.log(`   🆔 ID: ${pesanan.id}`);
    });

    return rows;
  } catch (error) {
    console.error("[Waiters] Error mengambil data pesanan:", error);
    return [];
  }
};

// Fungsi untuk memproses pesanan yang dipilih
const prosesPesanan = async (pesanan) => {
  try {
    console.log(`\n✅ Mengkonfirmasi pesanan #${pesanan.id}...`);

    // Update status pesanan
    const updateSql = `
      UPDATE pesanan
      SET status = ?, timestamp_konfirmasi = NOW()
      WHERE id = ?
    `;
    await db.execute(updateSql, ["Diteruskan ke Dapur", pesanan.id]);
    console.log(`[Waiters] Status pesanan #${pesanan.id} diupdate menjadi 'Diteruskan ke Dapur'`);

    // Ambil detail pesanan untuk dikirim ke dapur
    const [detailRows] = await db.execute(`
      SELECT nama_makanan, jumlah, harga_satuan
      FROM detail_pesanan
      WHERE id_pesanan = ?
    `, [pesanan.id]);

    // Kirim ke topik konfirmasi-pesanan
    await producer.send({
      topic: "konfirmasi-pesanan",
      messages: [{ value: JSON.stringify({ 
        id_pesanan: pesanan.id, 
        nomor_meja: pesanan.nomor_meja, 
        status: "Pesanan Diterima & Akan Diproses" 
      }) }],
    });

    // Kirim ke topik order untuk dapur
    await producer.send({
      topic: "order",
      messages: [{ value: JSON.stringify({ 
        id_pesanan: pesanan.id, 
        nomor_meja: pesanan.nomor_meja, 
        items: detailRows,
        nama_customer: pesanan.nama_customer 
      }) }],
    });

    console.log(`[Waiters] ✅ Pesanan #${pesanan.id} berhasil dikonfirmasi dan diteruskan ke Dapur`);
    
  } catch (error) {
    console.error("[Waiters] Error memproses pesanan:", error);
  }
};

// Fungsi untuk menyimpan pesanan baru ke database
const simpanPesananBaru = async (orderData) => {
  try {
    const { nomor_meja, items, nama_customer } = orderData;
    const id_pesanan = uuidv4();

    // Hitung total harga
    let totalHarga = items.reduce((sum, item) => sum + (item.jumlah * item.harga_satuan), 0);

    // Simpan pesanan utama
    const insertPesananSql = `
      INSERT INTO pesanan (id, nama_customer, nomor_meja, status, total_harga, tanggal)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    await db.execute(insertPesananSql, [id_pesanan, nama_customer, nomor_meja, "Diterima Waiters", totalHarga]);
    console.log(`[Waiters] 📝 Pesanan #${id_pesanan} (Meja ${nomor_meja}) disimpan ke database`);

    // Simpan detail pesanan
    for (const item of items) {
      const id_detail = uuidv4();
      const insertDetailSql = `
        INSERT INTO detail_pesanan (id, id_pesanan, nama_makanan, jumlah, harga_satuan)
        VALUES (?, ?, ?, ?, ?)
      `;
      await db.execute(insertDetailSql, [id_detail, id_pesanan, item.nama_makanan, item.jumlah, item.harga_satuan]);
    }

    console.log(`[Waiters] ✅ Pesanan baru dari Customer berhasil disimpan dan siap dikonfirmasi`);
    
  } catch (error) {
    console.error("[Waiters] Error menyimpan pesanan:", error);
  }
};

// Fungsi untuk menu utama waiters
const menuWaiters = async () => {
  console.log("\n👨‍💼 === SISTEM WAITERS ===");
  console.log("1. 📋 Lihat pesanan pending");
  console.log("2. ✅ Konfirmasi pesanan");
  console.log("3. 🔄 Refresh data");
  console.log("4. 🚪 Keluar");
  
  const pilihan = await question("\nPilih menu (1-4): ");
  
  switch (pilihan) {
    case "1":
      await tampilkanPesananPending();
      break;
    case "2":
      const pesananList = await tampilkanPesananPending();
      if (pesananList.length > 0) {
        const pilihanPesanan = await question(`\nPilih nomor pesanan yang akan dikonfirmasi (1-${pesananList.length}): `);
        const index = parseInt(pilihanPesanan) - 1;
        if (index >= 0 && index < pesananList.length) {
          await prosesPesanan(pesananList[index]);
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
const runWaiters = async () => {
  try {
    await consumer.connect();
    await producer.connect();
    console.log("[Waiters] ✅ Consumer dan Producer terhubung");

    // Subscribe ke topik pemesan
    await consumer.subscribe({ topic: "pemesan", fromBeginning: true });

    // Jalankan consumer di background
    consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const orderData = JSON.parse(message.value.toString());
        console.log(`\n📨 [Waiters] Menerima pesanan baru dari Customer: ${orderData.nama_customer} (Meja ${orderData.nomor_meja})`);
        await simpanPesananBaru(orderData);
      },
    });

    // Jalankan menu interaktif
    let lanjut = true;
    while (lanjut) {
      lanjut = await menuWaiters();
      if (lanjut) {
        await question("\nTekan Enter untuk melanjutkan...");
      }
    }

  } catch (error) {
    console.error("[Waiters] Error:", error);
  } finally {
    await consumer.disconnect();
    await producer.disconnect();
    rl.close();
    console.log("[Waiters] 🔌 Terputus dari sistem");
  }
};

// Jalankan aplikasi
runWaiters().catch(console.error); 