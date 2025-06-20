# Aplikasi Sistem Pemesanan Rumah Makan "Lezat Rasa" dengan Kafka dan Node.js

---

Aplikasi ini mensimulasikan alur pemesanan hingga pembayaran di sebuah rumah makan bernama "Lezat Rasa" menggunakan **Apache Kafka** sebagai tulang punggung komunikasi antar-layanan (mikroservis) dan **Node.js** untuk implementasi logika bisnis setiap peran. Data pesanan disimpan secara persisten di database **MySQL**.

**🆕 VERSI INTERAKTIF CLI** - Sistem ini sekarang menggunakan interface CLI interaktif dimana setiap peran dapat berinteraksi secara manual untuk memproses pesanan.

## Daftar Isi

1.  [Gambaran Umum Sistem](#gambaran-umum-sistem)
2.  [Arsitektur Aplikasi](#arsitektur-aplikasi)
3.  [Topik Kafka yang Digunakan](#topik-kafka-yang-digunakan)
4.  [Persyaratan Sistem](#persyaratan-sistem)
5.  [Persiapan Database](#persiapan-database)
6.  [Langkah-Langkah Menjalankan Aplikasi](#langkah-langkah-menjalankan-aplikasi)
7.  [Cara Penggunaan Sistem Interaktif](#cara-penggunaan-sistem-interaktif)
8.  [Verifikasi Data](#verifikasi-data)

---

## Gambaran Umum Sistem

Rumah Makan "Lezat Rasa" menggunakan sistem terdistribusi berbasis Kafka untuk mengelola setiap tahap pemesanan. Proses ini melibatkan beberapa peran utama: **Customer**, **Waiters**, **Dapur**, **Kasir**, dan **Manager**. Setiap peran berkomunikasi melalui pesan Kafka, memastikan alur kerja yang efisien dan data yang konsisten. Data pesanan juga dicatat dan diperbarui secara real-time di database MySQL.

**Fitur Baru:**

- **Customer**: Input data pesanan secara manual (nama, meja, menu, harga)
- **Waiters**: Lihat daftar pesanan pending dan konfirmasi secara manual
- **Dapur**: Lihat daftar pesanan yang perlu dimasak dan tandai siap secara manual
- **Kasir**: Lihat daftar pesanan siap bayar dan proses pembayaran secara manual
- **Manager**: Tetap monitoring otomatis

---

## Arsitektur Aplikasi

Aplikasi ini mengadopsi arsitektur _event-driven_ dengan Kafka sebagai _message broker_.

- **Kafka Broker & Zookeeper:** Dijalankan dalam Docker container, bertindak sebagai pusat komunikasi.
- **Producer:** Peran yang mengirim pesan ke topik Kafka (misalnya, Customer mengirim pesanan).
- **Consumer:** Peran yang menerima pesan dari topik Kafka dan memprosesnya (misalnya, Waiters menerima pesanan).
- **Database MySQL:** Digunakan untuk menyimpan dan memperbarui status pesanan secara persisten.
- **CLI Interface:** Setiap peran memiliki interface CLI interaktif untuk input dan konfirmasi manual.

Berikut adalah alur komunikasi utama:

`Customer (Producer)` --(_pemesan_)--> `Waiters (Consumer/Producer)`
`Waiters (Producer)` --(_konfirmasi-pesanan_)--> `(Opsional: Notifikasi Customer)`
`Waiters (Producer)` --(_order_)--> `Dapur (Consumer/Producer)`
`Dapur (Producer)` --(_notifikasi_)--> `Kasir (Consumer/Producer)`
`Kasir (Producer)` --(_pembayaran_)--> `(Opsional: Notifikasi Akhir Customer)`
`Manager (Consumer)` <--(_pemesan, konfirmasi-pesanan, order, notifikasi, pembayaran_)-- `(Semua Topik)`

---

## Topik Kafka yang Digunakan

| Topik                | Deskripsi                                             |
| :------------------- | :---------------------------------------------------- |
| `pemesan`            | Pesan awal dari Customer berisi detail pemesanan.     |
| `konfirmasi-pesanan` | Konfirmasi dari Waiters bahwa pesanan diterima.       |
| `order`              | Detail pesanan yang diteruskan dari Waiters ke Dapur. |
| `notifikasi`         | Notifikasi dari Dapur bahwa makanan sudah siap.       |
| `pembayaran`         | Detail pembayaran yang diproses oleh Kasir.           |

---

## Persyaratan Sistem

Pastikan Anda telah menginstal komponen-komponen berikut di sistem Anda:

- **Node.js** (Versi LTS disarankan)
- **npm** (biasanya terinstal bersama Node.js)
- **Docker** dan **Docker Compose** (untuk menjalankan Kafka dan Zookeeper)
- **MySQL Server** (dijalankan secara lokal di host, atau bisa juga ditambahkan ke Docker Compose jika diinginkan)

---

## Persiapan Database

Aplikasi ini menggunakan database MySQL dengan nama `lezat-rasa`. Pastikan Anda telah membuat database dan menjalankan skrip SQL berikut untuk menyiapkan tabel yang diperlukan.

1.  **Buat Database:**
    ```sql
    CREATE DATABASE `lezat-rasa`;
    ```
2.  **Gunakan Database:**
    ```sql
    USE `lezat-rasa`;
    ```
3.  **Buat Tabel `pesanan`:** (Jika belum ada dari modul pertemuan sebelumnya, atau pastikan strukturnya sesuai)
    ```sql
    CREATE TABLE `pesanan` (
      `id` varchar(50) NOT NULL,
      `nama_customer` varchar(100) DEFAULT NULL,
      `tanggal` timestamp NOT NULL DEFAULT current_timestamp(),
      `status` varchar(50) NOT NULL,
      `nomor_meja` int(11) NOT NULL,
      `total_harga` decimal(10,2) NOT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
    ```
4.  **Buat Tabel `detail_pesanan`:** Tabel ini menyimpan item-item spesifik dari setiap pesanan.
    ```sql
    CREATE TABLE `detail_pesanan` (
      `id` VARCHAR(50) NOT NULL,
      `id_pesanan` VARCHAR(50) NOT NULL,
      `nama_makanan` VARCHAR(100) NOT NULL,
      `jumlah` INT(11) NOT NULL,
      `harga_satuan` DECIMAL(10,2) NOT NULL,
      PRIMARY KEY (`id`),
      INDEX `idx_id_pesanan` (`id_pesanan`),
      CONSTRAINT `fk_id_pesanan` FOREIGN KEY (`id_pesanan`) REFERENCES `pesanan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
    ```
5.  **Tambahkan Kolom Timestamp ke Tabel `pesanan`:** Kolom ini penting untuk analisis waktu proses oleh Manager.
    ```sql
    ALTER TABLE `pesanan`
    ADD COLUMN `timestamp_konfirmasi` TIMESTAMP NULL AFTER `status`,
    ADD COLUMN `timestamp_siap` TIMESTAMP NULL AFTER `timestamp_konfirmasi`,
    ADD COLUMN `timestamp_bayar` TIMESTAMP NULL AFTER `timestamp_siap`;
    ```

**Atau gunakan file `database_setup.sql` yang sudah disediakan:**

```bash
mysql -u root -p < database_setup.sql
```

---

## Langkah-Langkah Menjalankan Aplikasi

Ikuti urutan langkah ini untuk menjalankan seluruh sistem dengan benar.

### 1. Inisialisasi Proyek & Instal Dependensi

Jika Anda belum melakukannya, ikuti langkah-langkah ini di terminal pada root folder proyek Anda (`lezat-rasa`):

```bash
# Inisialisasi proyek Node.js
npm init -y

# Instal semua dependensi yang diperlukan
npm install kafkajs mysql2 uuid
```

### 2. Konfigurasi Docker Compose

Buat file docker-compose.yml di root folder proyek Anda dengan isi berikut:

```yaml
# docker-compose.yml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:latest
    container_name: kafka
    hostname: kafka
    ports:
      - "9092:9092"
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      # Pastikan IP ini sesuai dengan IP host Anda agar aplikasi Node.js bisa terhubung
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://192.168.158.94:9092
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_DEFAULT_REPLICATION_FACTOR: 1
```

**Penting:** Pastikan alamat IP `KAFKA_ADVERTISED_LISTENERS` (192.168.158.94) di file docker-compose.yml sesuai dengan alamat IP lokal komputer Anda yang dapat diakses dari aplikasi Node.js Anda. Ini krusial agar aplikasi Node.js Anda bisa terhubung ke Kafka yang berjalan di dalam Docker.

### 3. Jalankan Zookeeper dan Kafka Broker dengan Docker Compose

Buka terminal baru di root folder proyek Anda dan jalankan Docker Compose:

```bash
docker-compose up -d
```

Perintah ini akan mengunduh image yang diperlukan (jika belum ada) dan menjalankan Zookeeper serta Kafka Broker di background.

### 4. Buat Topik Kafka

Jalankan perintah berikut untuk membuat topik yang diperlukan:

```bash
# Pastikan Anda berada di direktori bin instalasi Kafka
# Contoh: cd /opt/kafka/bin

# Jalankan perintah dari file commands.txt
while IFS= read -r line; do
  if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
    echo "Menjalankan: $line"
    ./kafka-topics.sh $line
    echo "---"
  fi
done < /path/to/your/commands.txt
```

### 5. Jalankan Semua Consumer Node.js

Buka empat terminal terpisah di direktori proyek Anda. Jalankan masing-masing consumer di terminal yang berbeda. Biarkan mereka berjalan dan mendengarkan pesan.

**Waiters Consumer:**

```bash
node waiters/main.js
```

**Dapur Consumer:**

```bash
node dapur/main.js
```

**Kasir Consumer:**

```bash
node kasir/main.js
```

**Manager Consumer:**

```bash
node manager/main.js
```

### 6. Jalankan Customer Producer (Untuk Input Pesanan)

Setelah semua consumer berjalan, buka terminal kelima di direktori proyek Anda. Jalankan Customer Producer untuk memulai input pesanan:

```bash
node customer/main.js
```

---

## Cara Penggunaan Sistem Interaktif

### Customer (Input Pesanan)

1. Jalankan `node customer/main.js`
2. Ikuti prompt untuk input:
   - Nama customer
   - Nomor meja
   - Menu makanan (nama, jumlah, harga satuan)
   - Konfirmasi pesanan
3. Pesanan akan dikirim ke sistem

### Waiters (Konfirmasi Pesanan)

1. Jalankan `node waiters/main.js`
2. Pilih menu:
   - **1**: Lihat pesanan pending
   - **2**: Konfirmasi pesanan (pilih nomor pesanan)
   - **3**: Refresh data
   - **4**: Keluar
3. Pesanan yang dikonfirmasi akan diteruskan ke Dapur

### Dapur (Proses Memasak)

1. Jalankan `node dapur/main.js`
2. Pilih menu:
   - **1**: Lihat pesanan yang perlu dimasak
   - **2**: Tandai pesanan siap (pilih nomor pesanan)
   - **3**: Refresh data
   - **4**: Keluar
3. Pesanan yang ditandai siap akan diteruskan ke Kasir

### Kasir (Proses Pembayaran)

1. Jalankan `node kasir/main.js`
2. Pilih menu:
   - **1**: Lihat pesanan siap dibayar
   - **2**: Proses pembayaran (pilih nomor pesanan)
   - **3**: Refresh data
   - **4**: Keluar
3. Pilih metode pembayaran dan konfirmasi
4. Status pesanan akan menjadi "Selesai Dibayar"

### Manager (Monitoring)

1. Jalankan `node manager/main.js`
2. Sistem akan otomatis memantau semua alur pesanan
3. Menampilkan analisis waktu pemrosesan

---

## Verifikasi Data

Setelah menjalankan simulasi, Anda bisa memeriksa database MySQL Anda untuk melihat data yang telah tersimpan dan diperbarui.

**Akses MySQL Client:**

```bash
mysql -u root -p
```

(Masukkan password MySQL Anda saat diminta)

**Pilih Database:**

```sql
USE `lezat-rasa`;
```

**Lihat Data Pesanan Utama:**

```sql
SELECT * FROM pesanan;
```

Anda akan melihat pesanan yang masuk dengan status yang terus diperbarui seiring berjalannya alur Kafka. Kolom `timestamp_konfirmasi`, `timestamp_siap`, dan `timestamp_bayar` akan terisi.

**Lihat Data Detail Pesanan:**

```sql
SELECT * FROM detail_pesanan;
```

Tabel ini akan menampilkan setiap item makanan yang dipesan untuk setiap `id_pesanan`.

---

**Selamat, Anda telah berhasil menjalankan simulasi sistem pemesanan rumah makan terdistribusi dengan Kafka dan Node.js menggunakan Docker Compose dengan interface CLI interaktif!**
