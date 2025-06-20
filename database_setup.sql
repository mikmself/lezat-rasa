-- Database setup untuk aplikasi Lezat Rasa
-- Jalankan perintah ini di MySQL untuk menyiapkan database

-- 1. Buat database jika belum ada
CREATE DATABASE IF NOT EXISTS `lezat-rasa`;

-- 2. Gunakan database
USE `lezat-rasa`;

-- 3. Buat tabel pesanan dengan struktur lengkap
CREATE TABLE IF NOT EXISTS `pesanan` (
    `id` varchar(50) NOT NULL,
    `nama_customer` varchar(100) DEFAULT NULL,
    `tanggal` timestamp NOT NULL DEFAULT current_timestamp(),
    `status` varchar(50) NOT NULL,
    `nomor_meja` int(11) NOT NULL,
    `total_harga` decimal(10, 2) NOT NULL,
    `timestamp_konfirmasi` TIMESTAMP NULL,
    `timestamp_siap` TIMESTAMP NULL,
    `timestamp_bayar` TIMESTAMP NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = latin1 COLLATE = latin1_swedish_ci;

-- 4. Buat tabel detail_pesanan
CREATE TABLE IF NOT EXISTS `detail_pesanan` (
    `id` VARCHAR(50) NOT NULL,
    `id_pesanan` VARCHAR(50) NOT NULL,
    `nama_makanan` VARCHAR(100) NOT NULL,
    `jumlah` INT(11) NOT NULL,
    `harga_satuan` DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_id_pesanan` (`id_pesanan`),
    CONSTRAINT `fk_id_pesanan` FOREIGN KEY (`id_pesanan`) REFERENCES `pesanan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = latin1 COLLATE = latin1_swedish_ci;

-- 5. Jika tabel sudah ada tapi kolom timestamp belum ada, tambahkan
ALTER TABLE `pesanan`
ADD COLUMN IF NOT EXISTS `timestamp_konfirmasi` TIMESTAMP NULL AFTER `status`,
ADD COLUMN IF NOT EXISTS `timestamp_siap` TIMESTAMP NULL AFTER `timestamp_konfirmasi`,
ADD COLUMN IF NOT EXISTS `timestamp_bayar` TIMESTAMP NULL AFTER `timestamp_siap`;