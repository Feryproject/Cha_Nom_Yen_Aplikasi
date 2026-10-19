// Service worker sederhana: hanya agar aplikasi bisa dipasang ke layar utama HP.
// Sengaja TIDAK menyimpan cache apa pun, jadi setiap pembaruan aplikasi langsung terlihat
// dan tidak mengganggu koneksi ke Firebase.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
    // tidak mengubah permintaan apa pun; browser menanganinya seperti biasa
});