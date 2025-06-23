import kafka from "../utils/kafkaClient.js"; // Mengimpor client Kafka
import readline from "readline";
import { v4 as uuidv4 } from 'uuid';

const producer = kafka.producer(); // Membuat instance producer Kafka

// Buat interface readline untuk input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Menu tetap dengan 10 pilihan
const MENU_MAKANAN = [
  { id: 1, nama: "Nasi Goreng Spesial", harga: 28000, kategori: "Nasi" },
  { id: 2, nama: "Mie Ayam Bakso", harga: 25000, kategori: "Mie" },
  { id: 3, nama: "Sate Ayam (10 tusuk)", harga: 15000, kategori: "Sate" },
  { id: 4, nama: "Ayam Goreng Crispy", harga: 22000, kategori: "Ayam" },
  { id: 5, nama: "Ikan Gurame Goreng", harga: 35000, kategori: "Ikan" },
  { id: 6, nama: "Es Jeruk", harga: 8000, kategori: "Minuman" },
  { id: 7, nama: "Es Teh Manis", harga: 3000, kategori: "Minuman" },
  { id: 8, nama: "Teh Hangat", harga: 5000, kategori: "Minuman" },
  { id: 9, nama: "Kopi Hitam", harga: 7000, kategori: "Minuman" },
  { id: 10, nama: "Es Campur", harga: 12000, kategori: "Minuman" }
];

// Fungsi untuk menanyakan input dengan promise
const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

// Fungsi untuk menampilkan menu
const tampilkanMenu = () => {
  console.log("\n🍽️  === MENU RUMAH MAKAN LEZAT RASA ===");
  console.log("ID | Menu                    | Harga    | Kategori");
  console.log("---+-------------------------+----------+----------");
  
  MENU_MAKANAN.forEach(item => {
    const nama = item.nama.padEnd(23);
    const harga = `Rp${item.harga.toLocaleString()}`.padStart(8);
    console.log(`${item.id.toString().padStart(2)} | ${nama} | ${harga} | ${item.kategori}`);
  });
  console.log("---+-------------------------+----------+----------");
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
    
    console.log("\n📝 Silakan pilih menu yang dipesan:");
    tampilkanMenu();
    
    while (lanjutTambah) {
      console.log(`\n--- Item ke-${items.length + 1} ---`);
      
      // Pilih menu berdasarkan ID
      const menuId = await question("🔢 Pilih ID Menu: ");
      const selectedMenu = MENU_MAKANAN.find(item => item.id === parseInt(menuId));
      
      if (!selectedMenu) {
        console.log("❌ ID menu tidak valid! Silakan pilih lagi.");
        continue;
      }
      
      const jumlah = await question(`🔢 Jumlah ${selectedMenu.nama}: `);
      
      items.push({
        id_pesanan: uuidv4(),
        nama_makanan: selectedMenu.nama,
        jumlah: parseInt(jumlah),
        harga_satuan: selectedMenu.harga
      });
      
      console.log(`✅ ${selectedMenu.nama} (${jumlah}x) ditambahkan ke pesanan`);
      
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