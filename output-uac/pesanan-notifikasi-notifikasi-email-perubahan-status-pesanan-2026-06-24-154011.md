# [Pesanan][Notifikasi] Notifikasi Email Perubahan Status Pesanan

## Description
- Overview: Sistem akan mengirimkan notifikasi email otomatis kepada pelanggan setiap kali status pesanan mereka berubah (Diproses, Dikirim, Selesai, Dibatalkan). Email akan berisi detail pesanan, ringkasan item, dan tautan untuk melacak pesanan, dengan bahasa yang disesuaikan preferensi akun.
- Figma: TBD
- PRD / Confluence: TBD
- Postman: TBD
- API contract & path: TBD

## User Acceptance Criteria (UAC)

# 1. SCENARIO: NOTIFIKASI EMAIL TERKIRIM SAAT STATUS PESANAN BERUBAH KE 'DIPROSES' (BAHASA INDONESIA)

GIVEN seorang pelanggan memiliki pesanan aktif dengan ID "ORD123",
AND notifikasi email diaktifkan untuk akun pelanggan tersebut,
AND preferensi bahasa akun pelanggan adalah Bahasa Indonesia,
AND pesanan "ORD123" memiliki item "Produk A (Qty: 1)" dan "Produk B (Qty: 2)",

WHEN status pesanan "ORD123" diubah menjadi "Diproses" oleh sistem atau admin,

THEN sebuah email notifikasi akan dikirim ke alamat email pelanggan yang terdaftar,
AND email tersebut akan diterima dalam waktu maksimal 1 menit setelah perubahan status,
AND subjek email akan berisi "Status Pesanan Anda Telah Berubah - ORD123",
AND isi email akan menampilkan nomor pesanan "ORD123",
AND isi email akan menampilkan status baru "Diproses",
AND isi email akan menampilkan ringkasan item "Produk A (Qty: 1)" dan "Produk B (Qty: 2)",
AND email akan menyertakan tombol "Lacak Pesanan" yang mengarah ke halaman detail pesanan "ORD123",
AND semua teks dalam email akan menggunakan Bahasa Indonesia.

| EN | ID |
|---|---|
| Your Order Status Has Changed - ORD123 | Status Pesanan Anda Telah Berubah - ORD123 |
| Order Number: | Nomor Pesanan: |
| New Status: | Status Baru: |
| Item Summary: | Ringkasan Item: |
| Track Order | Lacak Pesanan |

[image-or-design-ui-from-figma](https://example-image.com)

# 2. SCENARIO: NOTIFIKASI EMAIL TERKIRIM SAAT STATUS PESANAN BERUBAH KE 'DIBATALKAN' (BAHASA INGGRIS)

GIVEN seorang pelanggan memiliki pesanan aktif dengan ID "ORD456",
AND notifikasi email diaktifkan untuk akun pelanggan tersebut,
AND preferensi bahasa akun pelanggan adalah Bahasa Inggris,
AND pesanan "ORD456" memiliki item "Product C (Qty: 1)",

WHEN status pesanan "ORD456" diubah menjadi "Dibatalkan" oleh sistem atau admin,

THEN sebuah email notifikasi akan dikirim ke alamat email pelanggan yang terdaftar,
AND email tersebut akan diterima dalam waktu maksimal 1 menit setelah perubahan status,
AND subjek email akan berisi "Your Order Status Has Changed - ORD456",
AND isi email akan menampilkan nomor pesanan "ORD456",
AND isi email akan menampilkan status baru "Cancelled",
AND isi email akan menampilkan ringkasan item "Product C (Qty: 1)",
AND email akan menyertakan tombol "Track Order" yang mengarah ke halaman detail pesanan "ORD456",
AND semua teks dalam email akan menggunakan Bahasa Inggris.

| EN | ID |
|---|---|
| Your Order Status Has Changed - ORD456 | Status Pesanan Anda Telah Berubah - ORD456 |
| Order Number: | Nomor Pesanan: |
| New Status: | Status Baru: |
| Item Summary: | Ringkasan Item: |
| Track Order | Lacak Pesanan |

[image-or-design-ui-from-figma](https://example-image.com)

# 3. SCENARIO: TIDAK ADA EMAIL TERKIRIM JIKA NOTIFIKASI DINONAKTIFKAN

GIVEN seorang pelanggan memiliki pesanan aktif dengan ID "ORD789",
AND notifikasi email dinonaktifkan untuk akun pelanggan tersebut,

WHEN status pesanan "ORD789" diubah menjadi "Selesai" oleh sistem atau admin,

THEN tidak ada email notifikasi yang akan dikirim ke alamat email pelanggan yang terdaftar.

# 4. SCENARIO: SISTEM MELAKUKAN RETRY SAAT PENGIRIMAN EMAIL GAGAL UNTUK PERTAMA KALI

GIVEN seorang pelanggan memiliki pesanan aktif dengan ID "ORD012",
AND notifikasi email diaktifkan untuk akun pelanggan tersebut,
AND preferensi bahasa akun pelanggan adalah Bahasa Indonesia,
AND sistem pengiriman email mengalami kegagalan sementara pada percobaan pertama,

WHEN status pesanan "ORD012" diubah menjadi "Dikirim" oleh sistem atau admin,

THEN sistem akan mencoba mengirim ulang email notifikasi,
AND email notifikasi akan berhasil terkirim pada percobaan kedua atau ketiga,
AND email yang diterima akan memiliki konten dan bahasa yang benar sesuai pesanan "ORD012".

# 5. SCENARIO: SISTEM GAGAL MENGIRIM EMAIL SETELAH MAKSIMAL RETRY

GIVEN seorang pelanggan memiliki pesanan aktif dengan ID "ORD345",
AND notifikasi email diaktifkan untuk akun pelanggan tersebut,
AND sistem pengiriman email mengalami kegagalan persisten untuk 3 kali percobaan berturut-turut,

WHEN status pesanan "ORD345" diubah menjadi "Diproses" oleh sistem atau admin,

THEN sistem akan mencoba mengirim ulang email notifikasi sebanyak 3 kali,
AND setelah 3 kali percobaan gagal, sistem akan berhenti mencoba mengirim email,
AND tidak ada email notifikasi yang akan diterima oleh pelanggan,
AND sistem akan mencatat kegagalan pengiriman email secara permanen untuk pesanan "ORD345".

# 6. SCENARIO: PELANGGAN DAPAT MENONAKTIFKAN NOTIFIKASI EMAIL DARI HALAMAN PENGATURAN

GIVEN seorang pelanggan masuk ke akunnya,
AND pelanggan berada di halaman "Pengaturan Akun",
AND opsi "Notifikasi Email Perubahan Status Pesanan" saat ini diaktifkan,

WHEN pelanggan menonaktifkan opsi "Notifikasi Email Perubahan Status Pesanan",
AND pelanggan menyimpan perubahan pengaturan,

THEN opsi "Notifikasi Email Perubahan Status Pesanan" akan disimpan sebagai dinonaktifkan,
AND sistem akan menghentikan pengiriman notifikasi email perubahan status pesanan untuk akun pelanggan ini.

| EN | ID |
|---|---|
| Account Settings | Pengaturan Akun |
| Order Status Email Notifications | Notifikasi Email Perubahan Status Pesanan |
| Save Changes | Simpan Perubahan |

[image-or-design-ui-from-figma](https://example-image.com)

# 7. SCENARIO: PELANGGAN DAPAT MENGAKTIFKAN NOTIFIKASI EMAIL DARI HALAMAN PENGATURAN

GIVEN seorang pelanggan masuk ke akunnya,
AND pelanggan berada di halaman "Pengaturan Akun",
AND opsi "Notifikasi Email Perubahan Status Pesanan" saat ini dinonaktifkan,

WHEN pelanggan mengaktifkan opsi "Notifikasi Email Perubahan Status Pesanan",
AND pelanggan menyimpan perubahan pengaturan,

THEN opsi "Notifikasi Email Perubahan Status Pesanan" akan disimpan sebagai diaktifkan,
AND sistem akan melanjutkan pengiriman notifikasi email perubahan status pesanan untuk akun pelanggan ini.

| EN | ID |
|---|---|
| Account Settings | Pengaturan Akun |
| Order Status Email Notifications | Notifikasi Email Perubahan Status Pesanan |
| Save Changes | Simpan Perubahan |

[image-or-design-ui-from-figma](https://example-image.com)
