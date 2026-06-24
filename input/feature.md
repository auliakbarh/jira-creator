# Fitur: Notifikasi Email Perubahan Status Pesanan

Pelanggan ingin tahu progres pesanannya tanpa harus membuka aplikasi.

Saat status pesanan berubah (Diproses, Dikirim, Selesai, Dibatalkan), sistem mengirim
email otomatis ke alamat email pelanggan yang terdaftar. Email berisi nomor pesanan,
status baru, ringkasan item, dan tombol "Lacak Pesanan" yang membuka halaman detail.

Ketentuan:
- Email dikirim maksimal 1 menit setelah status berubah.
- Jika pengiriman email gagal, sistem mencoba ulang hingga 3 kali.
- Pelanggan bisa menonaktifkan notifikasi email dari halaman Pengaturan.
- Bahasa email mengikuti preferensi bahasa akun (ID/EN).
