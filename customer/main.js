import kafka from "../utils/kafkaClient.js"; // Mengimpor client Kafka
import readline from "readline";

const producer = kafka.producer(); // Membuat instance producer Kafka

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

// Fungsi untuk mengirim pesanan ke Kafka
const sendOrder = async (orderData) => {
  try {
    await producer.send({
      topic: "pemesan", // Topik tujuan: 'pemesan'
      messages: [{ value: JSON.stringify(orderData) }], // Pesan dalam format JSON
    });
    console.log(`\n[Customer] ✅ Pesanan berhasil dikirim ke sistem!`);
    console.log(`📋 Detail pesanan: ${JSON.stringify(orderData, null, 2)}`);
  } catch (error) {
    console.error("[Customer] ❌ Gagal mengirim pesanan:", error);
  }
};

// Fungsi untuk input data pesanan
const inputPesanan = async () => {
  console.log("\n🍽️  === SISTEM PEMESANAN RUMAH MAKAN LEZAT RASA === 🍽️");
  console.log("Silakan isi data pesanan Anda:\n");

  try {
    // Input data customer
    const namaCustomer = await question("👤 Nama Customer: ");
    const nomorMeja = await question("🪑 Nomor Meja: ");
    
    const items = [];
    let lanjutTambah = true;
    
    console.log("\n📝 Silakan masukkan menu yang dipesan:");
    
    while (lanjutTambah) {
      console.log(`\n--- Item ke-${items.length + 1} ---`);
      const namaMakanan = await question("🍽️  Nama Makanan/Minuman: ");
      const jumlah = await question("🔢 Jumlah: ");
      const hargaSatuan = await question("💰 Harga Satuan (Rp): ");
      
      items.push({
        nama_makanan: namaMakanan,
        jumlah: parseInt(jumlah),
        harga_satuan: parseInt(hargaSatuan)
      });
      
      const tambahLagi = await question("\n❓ Tambah menu lagi? (y/n): ");
      lanjutTambah = tambahLagi.toLowerCase() === 'y' || tambahLagi.toLowerCase() === 'yes';
    }
    
    // Buat objek pesanan
    const orderData = {
      nomor_meja: parseInt(nomorMeja),
      items: items,
      nama_customer: namaCustomer
    };
    
    // Konfirmasi pesanan
    console.log("\n📋 === KONFIRMASI PESANAN ===");
    console.log(`👤 Customer: ${namaCustomer}`);
    console.log(`🪑 Meja: ${nomorMeja}`);
    console.log("🍽️  Menu:");
    items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.nama_makanan} - ${item.jumlah}x @Rp${item.harga_satuan.toLocaleString()}`);
    });
    
    const totalHarga = items.reduce((sum, item) => sum + (item.jumlah * item.harga_satuan), 0);
    console.log(`💰 Total: Rp${totalHarga.toLocaleString()}`);
    
    const konfirmasi = await question("\n❓ Konfirmasi pesanan? (y/n): ");
    
    if (konfirmasi.toLowerCase() === 'y' || konfirmasi.toLowerCase() === 'yes') {
      await sendOrder(orderData);
    } else {
      console.log("\n❌ Pesanan dibatalkan.");
    }
    
  } catch (error) {
    console.error("[Customer] Error:", error);
  }
};

// Fungsi utama
const runCustomer = async () => {
  try {
    await producer.connect();
    console.log("[Customer] ✅ Terhubung ke sistem Kafka");
    
    let lanjutPesan = true;
    
    while (lanjutPesan) {
      await inputPesanan();
      
      const pesanLagi = await question("\n❓ Ingin pesan lagi? (y/n): ");
      lanjutPesan = pesanLagi.toLowerCase() === 'y' || pesanLagi.toLowerCase() === 'yes';
    }
    
    console.log("\n👋 Terima kasih telah menggunakan sistem pemesanan kami!");
    
  } catch (error) {
    console.error("[Customer] Error:", error);
  } finally {
    await producer.disconnect();
    rl.close();
    console.log("[Customer] 🔌 Terputus dari sistem");
  }
};

// Jalankan aplikasi
runCustomer().catch(console.error); 