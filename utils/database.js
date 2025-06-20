import mysql from "mysql2/promise";

// Konfigurasi koneksi database
const db = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "lezat-rasa",
});

export default db; 