/* =========================================================
   tracking-app.js - logika Vue untuk tracking.html
   Data awal disalin dari dataBahanAjar.js (data dummy tutor).
   Halaman ini memakai upbjjList, pengirimanList, paket, stok
   (untuk menampilkan judul isi paket), dan tracking.

   Isi file:
   1. Konstanta & fungsi bantu
   2. data      : data dummy + state antarmuka
   3. computed  : nomor DO otomatis, daftar DO, detail paket, validasi
   4. methods   : cari DO, simpan DO, update status, format tampilan
   5. watch     : simpan otomatis, total dari paket, NIM angka saja,
                  nomor cari kapital, tema
   6. created   : memuat data tersimpan dari localStorage
   ========================================================= */

/* ---------- 1. Konstanta & fungsi bantu ---------- */
var KUNCI_TRACKING = 'sitta-vue-tracking';
var KUNCI_TEMA = 'sitta-vue-tema';
var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
                  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function duaDigit(n) {
  return String(n).padStart(2, '0');
}

/* Tanggal lokal format YYYY-MM-DD. Tidak memakai toISOString()
   karena hasilnya UTC: antara pukul 00.00-07.00 WIB tanggalnya
   akan mundur satu hari. */
function tanggalLokal(d) {
  return d.getFullYear() + '-' + duaDigit(d.getMonth() + 1) + '-' + duaDigit(d.getDate());
}

function waktuLokal(d) {
  return tanggalLokal(d) + ' ' + duaDigit(d.getHours()) + ':' + duaDigit(d.getMinutes()) + ':' + duaDigit(d.getSeconds());
}

/* Tema dibaca langsung saat data dibuat, bukan di created(), karena
   watcher tema (immediate: true) berjalan sebelum created() dan akan
   menimpa pilihan tersimpan dengan nilai awal 'light'. */
function temaTersimpan() {
  try { return localStorage.getItem(KUNCI_TEMA) || 'light'; } catch (e) { return 'light'; }
}

function formDOKosong() {
  return {
    nim: '', nama: '', upbjj: '', ekspedisi: '', paket: '',
    tanggalKirim: tanggalLokal(new Date()), total: 0
  };
}

/* ---------- 2. Instance Vue ---------- */
var app = new Vue({
  el: '#app',

  data: {
    // --- data dummy dari dataBahanAjar.js ---
    upbjjList: ["Jakarta", "Surabaya", "Makassar", "Padang", "Denpasar"],
    pengirimanList: [
      { kode: "REG", nama: "Reguler (3-5 hari)" },
      { kode: "EXP", nama: "Ekspres (1-2 hari)" }
    ],
    paket: [
      { kode: "PAKET-UT-001", nama: "PAKET IPS Dasar", isi: ["EKMA4116", "EKMA4115"], harga: 120000 },
      { kode: "PAKET-UT-002", nama: "PAKET IPA Dasar", isi: ["BIOL4201", "FISIP4001"], harga: 140000 }
    ],
    stok: [
      { kode: "EKMA4116", judul: "Pengantar Manajemen", kategori: "MK Wajib", upbjj: "Jakarta", lokasiRak: "R1-A3", harga: 65000, qty: 28, safety: 20, catatanHTML: "<em>Edisi 2024, cetak ulang</em>" },
      { kode: "EKMA4115", judul: "Pengantar Akuntansi", kategori: "MK Wajib", upbjj: "Jakarta", lokasiRak: "R1-A4", harga: 60000, qty: 7, safety: 15, catatanHTML: "<strong>Cover baru</strong>" },
      { kode: "BIOL4201", judul: "Biologi Umum (Praktikum)", kategori: "Praktikum", upbjj: "Surabaya", lokasiRak: "R3-B2", harga: 80000, qty: 12, safety: 10, catatanHTML: "Butuh <u>pendingin</u> untuk kit basah" },
      { kode: "FISIP4001", judul: "Dasar-Dasar Sosiologi", kategori: "MK Pilihan", upbjj: "Makassar", lokasiRak: "R2-C1", harga: 55000, qty: 2, safety: 8, catatanHTML: "Stok <i>menipis</i>, prioritaskan reorder" }
    ],
    tracking: {
      "DO2025-0001": {
        nim: "123456789",
        nama: "Rina Wulandari",
        status: "Dalam Perjalanan",
        ekspedisi: "JNE",
        tanggalKirim: "2025-08-25",
        paket: "PAKET-UT-001",
        total: 120000,
        perjalanan: [
          { waktu: "2025-08-25 10:12:20", keterangan: "Penerimaan di Loket: TANGSEL" },
          { waktu: "2025-08-25 14:07:56", keterangan: "Tiba di Hub: JAKSEL" },
          { waktu: "2025-08-26 08:44:01", keterangan: "Diteruskan ke Kantor Tujuan" }
        ]
      }
    },

    // --- state antarmuka ---
    tema: temaTersimpan(),
    tahun: new Date().getFullYear(),
    tahapStatus: ['Diproses', 'Dalam Perjalanan', 'Terkirim'],

    cari: { nomor: '', aktif: '', galat: '' },
    riwayatBaru: { status: '', keterangan: '', galat: '' },

    form: formDOKosong(),
    tersentuh: {},
    sudahDicoba: false,
    sorotNomor: '',
    notif: { tampil: false, teks: '', jenis: 'ok' }
  },

  /* ---------- 3. Computed ---------- */
  computed: {
    /* Nomor DO otomatis: "DO" + tahun berjalan + "-" + urutan 3 digit.
       Urutan = nomor terbesar pada tahun yang sama + 1, sehingga
       DO pertama tahun ini menjadi DO2026-001, lalu DO2026-002, dst. */
    nomorDOBaru() {
      var awalan = 'DO' + this.tahun + '-';
      var maks = 0;
      Object.keys(this.tracking).forEach(function (no) {
        if (no.indexOf(awalan) === 0) {
          var urut = parseInt(no.slice(awalan.length), 10);
          if (urut > maks) maks = urut;
        }
      });
      return awalan + String(maks + 1).padStart(3, '0');
    },

    // Objek tracking diubah menjadi array agar bisa di-loop dan diurutkan
    daftarDO() {
      var data = this.tracking;
      return Object.keys(data)
        .map(function (no) { return Object.assign({ nomor: no }, data[no]); })
        .sort(function (a, b) { return b.nomor.localeCompare(a.nomor); });
    },

    doAktif() {
      return this.cari.aktif ? this.tracking[this.cari.aktif] : null;
    },

    // posisi status pada stepper (0, 1, 2)
    indeksStatus() {
      if (!this.doAktif) return -1;
      return this.tahapStatus.indexOf(this.doAktif.status);
    },

    persenProgres() {
      if (this.indeksStatus < 0) return 0;
      return Math.round(this.indeksStatus / (this.tahapStatus.length - 1) * 100);
    },

    // status yang masih bisa dipilih: hanya tahap setelah status sekarang
    statusLanjutan() {
      return this.tahapStatus.slice(this.indeksStatus + 1);
    },

    paketTerpilih() {
      var kode = this.form.paket;
      return this.paket.find(function (p) { return p.kode === kode; }) || null;
    },

    galat() {
      var f = this.form;
      var g = {};

      if (!f.nim) g.nim = 'NIM wajib diisi.';
      else if (!/^\d{9}$/.test(f.nim)) g.nim = 'NIM terdiri dari 9 angka (saat ini ' + f.nim.length + ').';

      var nama = f.nama.trim();
      if (!nama) g.nama = 'Nama wajib diisi.';
      else if (nama.length < 3) g.nama = 'Nama minimal 3 huruf.';
      else if (!/^[A-Za-z\s.,'-]+$/.test(nama)) g.nama = 'Nama hanya boleh berisi huruf, spasi, titik, koma, apostrof, atau tanda hubung.';

      if (!f.upbjj) g.upbjj = 'Pilih UT-Daerah pengirim.';
      if (!f.ekspedisi) g.ekspedisi = 'Pilih jenis ekspedisi.';
      if (!f.paket) g.paket = 'Pilih paket bahan ajar.';

      if (!f.tanggalKirim) {
        g.tanggalKirim = 'Tanggal kirim wajib diisi.';
      } else {
        var batasAtas = new Date();
        batasAtas.setDate(batasAtas.getDate() + 30);
        if (f.tanggalKirim < this.tahun + '-01-01') g.tanggalKirim = 'Tanggal kirim tidak boleh sebelum 1 Januari ' + this.tahun + '.';
        else if (f.tanggalKirim > tanggalLokal(batasAtas)) g.tanggalKirim = 'Tanggal kirim paling lambat 30 hari dari hari ini.';
      }
      return g;
    },

    jumlahGalat() {
      return Object.keys(this.galat).length;
    }
  },

  /* ---------- 4. Methods ---------- */
  methods: {
    cariDO() {
      var no = this.cari.nomor.trim();
      if (!no) {
        this.cari.galat = 'Masukkan nomor DO terlebih dahulu.';
        return;
      }
      if (!/^DO\d{4}-\d{3,4}$/.test(no)) {
        this.cari.galat = 'Format nomor DO: DO<tahun>-<urutan>, contoh DO2025-0001.';
        return;
      }
      if (!this.tracking[no]) {
        this.cari.galat = 'Nomor ' + no + ' tidak ditemukan. Coba pilih dari daftar di bawah.';
        this.cari.aktif = '';
        return;
      }
      this.cari.galat = '';
      this.cari.aktif = no;
      this.riwayatBaru = { status: '', keterangan: '', galat: '' };
    },

    pilihDO(no) {
      this.cari.nomor = no;
      this.cariDO();
      var el = document.getElementById('hasil-lacak');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    tutupHasil() {
      this.cari.aktif = '';
    },

    formatRupiah(angka) {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0
      }).format(angka);
    },

    // "2025-08-25" -> "25 Agustus 2025"
    formatTanggal(teks) {
      if (!teks) return '-';
      var b = teks.split('-');
      return parseInt(b[2], 10) + ' ' + NAMA_BULAN[parseInt(b[1], 10) - 1] + ' ' + b[0];
    },

    // "2025-08-25 10:12:20" -> "25 Agustus 2025, 10.12"
    formatWaktu(teks) {
      var bagian = teks.split(' ');
      var jam = (bagian[1] || '').slice(0, 5).replace(':', '.');
      return this.formatTanggal(bagian[0]) + (jam ? ', ' + jam : '');
    },

    judulMK(kode) {
      var item = this.stok.find(function (s) { return s.kode === kode; });
      return item ? item.judul : '(judul belum terdaftar)';
    },

    infoPaket(kode) {
      return this.paket.find(function (p) { return p.kode === kode; }) || null;
    },

    labelEkspedisi(kode) {
      var e = this.pengirimanList.find(function (p) { return p.kode === kode; });
      return e ? 'JNE ' + e.nama : kode;
    },

    isiHariIni() {
      this.form.tanggalKirim = tanggalLokal(new Date());
    },

    tandai(kolom) {
      this.$set(this.tersentuh, kolom, true);
    },

    pesanGalat(kolom) {
      if (this.tersentuh[kolom] || this.sudahDicoba) return this.galat[kolom] || '';
      return '';
    },

    simpanDO() {
      this.sudahDicoba = true;
      if (this.jumlahGalat > 0) {
        var pertama = Object.keys(this.galat)[0];
        var el = document.getElementById('d-' + pertama);
        if (el) el.focus();
        this.tampilNotif('Masih ada ' + this.jumlahGalat + ' isian yang perlu diperbaiki.', 'error');
        return;
      }

      var f = this.form;
      var nomor = this.nomorDOBaru;
      var sekarang = new Date();
      var dataDO = {
        nim: f.nim,
        nama: f.nama.trim().replace(/\s+/g, ' '),
        status: 'Diproses',
        ekspedisi: this.labelEkspedisi(f.ekspedisi),
        upbjj: f.upbjj,
        tanggalKirim: f.tanggalKirim,
        paket: f.paket,
        total: f.total,
        perjalanan: [
          { waktu: waktuLokal(sekarang), keterangan: 'DO dibuat di UT-Daerah ' + f.upbjj + ', menunggu penyerahan ke ekspedisi' }
        ]
      };

      // Vue 2 tidak mendeteksi properti baru pada objek, jadi pakai $set
      this.$set(this.tracking, nomor, dataDO);

      this.tampilNotif(nomor + ' atas nama ' + dataDO.nama + ' berhasil dibuat.');
      this.sorotNomor = nomor;
      var self = this;
      setTimeout(function () { self.sorotNomor = ''; }, 2500);
      this.resetForm();
      this.pilihDO(nomor);
    },

    resetForm() {
      this.form = formDOKosong();
      this.tersentuh = {};
      this.sudahDicoba = false;
    },

    tambahRiwayat() {
      var r = this.riwayatBaru;
      var ket = r.keterangan.trim();
      if (!r.status) { r.galat = 'Pilih status terbaru.'; return; }
      if (ket.length < 5) { r.galat = 'Keterangan minimal 5 karakter, misal "Tiba di Hub: SBY".'; return; }

      var data = this.tracking[this.cari.aktif];
      data.perjalanan.push({ waktu: waktuLokal(new Date()), keterangan: ket });
      data.status = r.status;
      this.riwayatBaru = { status: '', keterangan: '', galat: '' };
      this.tampilNotif('Status ' + this.cari.aktif + ' diperbarui menjadi "' + data.status + '".');
    },

    kembalikanDataAwal() {
      if (!window.confirm('Semua DO yang ditambahkan akan dihapus dan data kembali seperti dataBahanAjar.js. Lanjutkan?')) return;
      this.tracking = JSON.parse(JSON.stringify(this.trackingAwal));
      this.cari = { nomor: '', aktif: '', galat: '' };
      this.tampilNotif('Data tracking dikembalikan ke data awal.');
    },

    tampilNotif(teks, jenis) {
      var self = this;
      this.notif = { tampil: true, teks: teks, jenis: jenis || 'ok' };
      clearTimeout(this.timerNotif);
      this.timerNotif = setTimeout(function () { self.notif.tampil = false; }, 3200);
    },

    gantiTema() {
      this.tema = this.tema === 'dark' ? 'light' : 'dark';
    }
  },

  /* ---------- 5. Watchers ---------- */
  watch: {
    // (1) DO baru dan riwayat baru langsung disimpan ke localStorage
    tracking: {
      deep: true,
      handler(baru) {
        try { localStorage.setItem(KUNCI_TRACKING, JSON.stringify(baru)); } catch (e) { /* abaikan */ }
      }
    },

    // (2) Begitu paket dipilih, total harga diisi dari paket.harga
    'form.paket'(kodeBaru) {
      var p = this.infoPaket(kodeBaru);
      this.form.total = p ? p.harga : 0;
    },

    // (3) NIM hanya angka, maksimal 9 digit. Huruf/spasi yang diketik langsung dibuang
    'form.nim'(baru) {
      var bersih = (baru || '').replace(/\D/g, '').slice(0, 9);
      if (bersih !== baru) this.form.nim = bersih;
    },

    // (4) Nomor DO yang diketik dijadikan kapital, pesan error lama dihapus
    'cari.nomor'(baru) {
      var kapital = (baru || '').toUpperCase();
      if (kapital !== baru) this.cari.nomor = kapital;
      this.cari.galat = '';
    },

    // (5) Tema: ubah atribut data-theme di <html>
    tema: {
      immediate: true,
      handler(baru) {
        document.documentElement.setAttribute('data-theme', baru);
        try { localStorage.setItem(KUNCI_TEMA, baru); } catch (e) { /* abaikan */ }
      }
    }
  },

  /* ---------- 6. Lifecycle ---------- */
  created() {
    this.trackingAwal = JSON.parse(JSON.stringify(this.tracking));
    this.timerNotif = null;

    try {
      var tersimpan = localStorage.getItem(KUNCI_TRACKING);
      if (tersimpan) this.tracking = JSON.parse(tersimpan);
    } catch (e) { /* pakai data awal */ }

    // dukung tautan langsung: tracking.html?do=DO2025-0001
    var param = new URLSearchParams(window.location.search).get('do');
    if (param) {
      this.cari.nomor = param.toUpperCase();
      this.cariDO();
    }
  }
});
