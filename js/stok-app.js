/* =========================================================
   stok-app.js - logika Vue untuk stok.html
   Data awal disalin dari dataBahanAjar.js (data dummy tutor).
   Halaman ini hanya memakai upbjjList, kategoriList, dan stok.

   Isi file:
   1. Konstanta & fungsi bantu
   2. data      : data dummy + state antarmuka
   3. computed  : rantai filter -> sort, ringkasan, validasi form
   4. methods   : aksi yang dipicu event (klik, submit)
   5. watch     : simpan otomatis, dependent filter, kode kapital, tema
   6. created   : memuat data tersimpan dari localStorage
   ========================================================= */

/* ---------- 1. Konstanta & fungsi bantu ---------- */
var KUNCI_STOK = 'sitta-vue-stok';
var KUNCI_TEMA = 'sitta-vue-tema';

// Ubah ke false untuk mematikan log computed di console
var DEBUG_COMPUTED = true;
function catatHitung(nama) {
  if (DEBUG_COMPUTED) console.count('[computed] ' + nama + ' dihitung ulang');
}

function formKosong() {
  return {
    kode: '', judul: '', kategori: '', upbjj: '', lokasiRak: '',
    harga: null, qty: null, safety: null, catatanHTML: ''
  };
}

function bilanganBulat(n) {
  return typeof n === 'number' && Number.isInteger(n);
}

/* Tema dibaca langsung saat data dibuat, bukan di created(), karena
   watcher tema (immediate: true) berjalan sebelum created() dan akan
   menimpa pilihan tersimpan dengan nilai awal 'light'. */
function temaTersimpan() {
  try { return localStorage.getItem(KUNCI_TEMA) || 'light'; } catch (e) { return 'light'; }
}

/* ---------- 2. Instance Vue ---------- */
var app = new Vue({
  el: '#app',

  data: {
    // --- data dummy dari dataBahanAjar.js ---
    upbjjList: ["Jakarta", "Surabaya", "Makassar", "Padang", "Denpasar"],
    kategoriList: ["MK Wajib", "MK Pilihan", "Praktikum", "Problem-Based"],
    stok: [
      {
        kode: "EKMA4116",
        judul: "Pengantar Manajemen",
        kategori: "MK Wajib",
        upbjj: "Jakarta",
        lokasiRak: "R1-A3",
        harga: 65000,
        qty: 28,
        safety: 20,
        catatanHTML: "<em>Edisi 2024, cetak ulang</em>"
      },
      {
        kode: "EKMA4115",
        judul: "Pengantar Akuntansi",
        kategori: "MK Wajib",
        upbjj: "Jakarta",
        lokasiRak: "R1-A4",
        harga: 60000,
        qty: 7,
        safety: 15,
        catatanHTML: "<strong>Cover baru</strong>"
      },
      {
        kode: "BIOL4201",
        judul: "Biologi Umum (Praktikum)",
        kategori: "Praktikum",
        upbjj: "Surabaya",
        lokasiRak: "R3-B2",
        harga: 80000,
        qty: 12,
        safety: 10,
        catatanHTML: "Butuh <u>pendingin</u> untuk kit basah"
      },
      {
        kode: "FISIP4001",
        judul: "Dasar-Dasar Sosiologi",
        kategori: "MK Pilihan",
        upbjj: "Makassar",
        lokasiRak: "R2-C1",
        harga: 55000,
        qty: 2,
        safety: 8,
        catatanHTML: "Stok <i>menipis</i>, prioritaskan reorder"
      }
    ],

    // --- state antarmuka ---
    tema: temaTersimpan(),
    filter: { keyword: '', upbjj: '', kategori: '', reorder: false },
    sortKey: 'judul',
    sortArah: 'asc',
    opsiSort: [
      { nilai: 'judul', label: 'Judul (A-Z)' },
      { nilai: 'qty', label: 'Jumlah stok' },
      { nilai: 'harga', label: 'Harga' }
    ],

    modal: { buka: false, mode: 'tambah', indeks: -1 },
    form: formKosong(),
    tersentuh: {},          // kolom yang sudah pernah ditinggalkan (blur)
    sudahDicoba: false,     // true setelah tombol Simpan pertama kali ditekan
    sorotKunci: '',         // baris yang baru disimpan diberi animasi sorot
    notif: { tampil: false, teks: '', jenis: 'ok' },
    terakhirDisimpan: ''
  },

  /* ---------- 3. Computed ----------
     Filter dipecah menjadi beberapa tahap. Vue meng-cache setiap
     computed dan hanya menghitung ulang tahap yang dependensinya
     berubah. Contoh: mengganti urutan hanya menjalankan stokTampil,
     sedangkan stokPerDaerah dan stokPerKategori memakai hasil cache. */
  computed: {
    // Tahap 1: filter UT-Daerah
    stokPerDaerah() {
      catatHitung('stokPerDaerah');
      var daerah = this.filter.upbjj;
      if (!daerah) return this.stok;
      return this.stok.filter(function (s) { return s.upbjj === daerah; });
    },

    // Dependent options: jumlah judul per kategori di UT-Daerah terpilih
    kategoriTersedia() {
      var daftar = this.stokPerDaerah;
      return this.kategoriList.map(function (k) {
        var jumlah = daftar.filter(function (s) { return s.kategori === k; }).length;
        return { nama: k, jumlah: jumlah };
      });
    },

    // Tahap 2: filter kategori
    stokPerKategori() {
      catatHitung('stokPerKategori');
      var kat = this.filter.kategori;
      if (!kat) return this.stokPerDaerah;
      return this.stokPerDaerah.filter(function (s) { return s.kategori === kat; });
    },

    // Tahap 3: pencarian kode / judul
    stokCari() {
      catatHitung('stokCari');
      var kata = this.filter.keyword.trim().toLowerCase();
      if (!kata) return this.stokPerKategori;
      return this.stokPerKategori.filter(function (s) {
        return s.kode.toLowerCase().indexOf(kata) !== -1 ||
               s.judul.toLowerCase().indexOf(kata) !== -1;
      });
    },

    // Tahap 4: hanya yang perlu re-order (qty < safety atau qty = 0)
    stokReorder() {
      catatHitung('stokReorder');
      if (!this.filter.reorder) return this.stokCari;
      return this.stokCari.filter(function (s) {
        return s.qty < s.safety || s.qty === 0;
      });
    },

    // Tahap 5: pengurutan. slice() supaya array asli tidak ikut terurut
    stokTampil() {
      catatHitung('stokTampil');
      var kunci = this.sortKey;
      var arah = this.sortArah === 'asc' ? 1 : -1;
      return this.stokReorder.slice().sort(function (a, b) {
        if (kunci === 'judul') return a.judul.localeCompare(b.judul, 'id') * arah;
        return (a[kunci] - b[kunci]) * arah;
      });
    },

    // Ringkasan mengikuti UT-Daerah yang dipilih
    ringkasan() {
      var hasil = { judul: 0, eksemplar: 0, aman: 0, tipis: 0, kosong: 0 };
      var self = this;
      this.stokPerDaerah.forEach(function (s) {
        hasil.judul += 1;
        hasil.eksemplar += s.qty;
        hasil[self.statusStok(s)] += 1;
      });
      return hasil;
    },

    labelDaerah() {
      return this.filter.upbjj ? 'UT-Daerah ' + this.filter.upbjj : 'seluruh UT-Daerah';
    },

    filterAktif() {
      var f = this.filter;
      return f.keyword !== '' || f.upbjj !== '' || f.kategori !== '' || f.reorder ||
             this.sortKey !== 'judul' || this.sortArah !== 'asc';
    },

    // Validasi form dihitung dari isi form. Kosong = form valid.
    galat() {
      var f = this.form;
      var g = {};
      var kode = (f.kode || '').trim();
      var indeksEdit = this.modal.indeks;

      if (!kode) g.kode = 'Kode mata kuliah wajib diisi.';
      else if (!/^[A-Z]{3,5}\d{4}$/.test(kode)) g.kode = 'Format: 3-5 huruf lalu 4 angka, contoh EKMA4116.';
      else if (f.upbjj && this.stok.some(function (s, i) {
        return i !== indeksEdit && s.kode === kode && s.upbjj === f.upbjj;
      })) g.kode = 'Kode ' + kode + ' sudah tercatat di UT-Daerah ' + f.upbjj + '.';

      var judul = (f.judul || '').trim();
      if (!judul) g.judul = 'Judul mata kuliah wajib diisi.';
      else if (judul.length < 3) g.judul = 'Judul minimal 3 karakter.';
      else if (judul.length > 80) g.judul = 'Judul maksimal 80 karakter.';

      if (!f.kategori) g.kategori = 'Pilih kategori mata kuliah.';
      if (!f.upbjj) g.upbjj = 'Pilih UT-Daerah.';

      var rak = (f.lokasiRak || '').trim();
      if (!rak) g.lokasiRak = 'Lokasi rak wajib diisi.';
      else if (!/^R\d{1,2}-[A-Z]\d{1,2}$/i.test(rak)) g.lokasiRak = 'Format rak: R<angka>-<huruf><angka>, contoh R1-A3.';

      if (f.harga === null || f.harga === '') g.harga = 'Harga wajib diisi.';
      else if (!bilanganBulat(f.harga) || f.harga < 1000) g.harga = 'Harga berupa bilangan bulat minimal 1.000.';
      else if (f.harga > 10000000) g.harga = 'Harga maksimal Rp10.000.000.';

      if (f.qty === null || f.qty === '') g.qty = 'Jumlah stok wajib diisi.';
      else if (!bilanganBulat(f.qty) || f.qty < 0) g.qty = 'Stok berupa bilangan bulat 0 atau lebih.';
      else if (f.qty > 100000) g.qty = 'Stok maksimal 100.000.';

      if (f.safety === null || f.safety === '') g.safety = 'Safety stock wajib diisi.';
      else if (!bilanganBulat(f.safety) || f.safety < 1) g.safety = 'Safety stock berupa bilangan bulat minimal 1.';

      if ((f.catatanHTML || '').length > 200) g.catatanHTML = 'Catatan maksimal 200 karakter.';

      return g;
    },

    formValid() {
      return Object.keys(this.galat).length === 0;
    },

    // Pratinjau catatan memakai versi yang sudah dibersihkan
    pratinjauCatatan() {
      return this.bersihkanHTML(this.form.catatanHTML);
    },

    // Status yang akan didapat data di form, untuk pratinjau di modal
    statusForm() {
      var f = this.form;
      if (!bilanganBulat(f.qty) || !bilanganBulat(f.safety)) return '';
      return this.statusStok(f);
    }
  },

  /* ---------- 4. Methods ----------
     Dipakai untuk fungsi yang butuh argumen (statusStok(item),
     formatRupiah(n)) dan aksi yang dijalankan saat event. */
  methods: {
    statusStok(item) {
      if (item.qty === 0) return 'kosong';
      if (item.qty < item.safety) return 'tipis';
      return 'aman';
    },

    formatRupiah(angka) {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0
      }).format(angka);
    },

    // Lebar bar stok: 100% berarti stok sudah 2x safety stock
    lebarBar(item) {
      if (!item.safety) return 100;
      return Math.min(100, Math.round(item.qty / (item.safety * 2) * 100));
    },

    warnaBar(item) {
      var st = this.statusStok(item);
      if (st === 'kosong') return 'var(--kosong)';
      if (st === 'tipis') return 'var(--tipis)';
      return 'var(--aman)';
    },

    kunciBaris(item) {
      return item.kode + '@' + item.upbjj;
    },

    urutkan(kunci) {
      // klik kolom yang sama membalik arah urutan
      if (this.sortKey === kunci) {
        this.sortArah = this.sortArah === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = kunci;
        this.sortArah = 'asc';
      }
    },

    panahSort(kunci) {
      if (this.sortKey !== kunci) return '';
      return this.sortArah === 'asc' ? '▲' : '▼';
    },

    resetFilter() {
      this.filter = { keyword: '', upbjj: '', kategori: '', reorder: false };
      this.sortKey = 'judul';
      this.sortArah = 'asc';
      this.tampilNotif('Filter dan urutan dikembalikan ke awal.');
    },

    tampilkanReorder() {
      this.filter.reorder = !this.filter.reorder;
    },

    // --- form tambah / edit ---
    bukaTambah() {
      this.form = formKosong();
      // isi otomatis UT-Daerah jika filter daerah sedang dipakai
      if (this.filter.upbjj) this.form.upbjj = this.filter.upbjj;
      this.modal = { buka: true, mode: 'tambah', indeks: -1 };
      this.tersentuh = {};
      this.sudahDicoba = false;
      this.fokusKe('f-kode');
    },

    bukaEdit(item) {
      this.form = Object.assign({}, item);
      this.modal = { buka: true, mode: 'edit', indeks: this.stok.indexOf(item) };
      this.tersentuh = {};
      this.sudahDicoba = false;
      this.fokusKe('f-qty');
    },

    tutupModal() {
      this.modal.buka = false;
    },

    fokusKe(id) {
      // tunggu sampai modal (v-if) selesai dirender
      this.$nextTick(function () {
        var el = document.getElementById(id);
        if (el) el.focus();
      });
    },

    tandai(kolom) {
      this.$set(this.tersentuh, kolom, true);
    },

    // pesan error hanya muncul setelah kolom disentuh atau Simpan ditekan
    pesanGalat(kolom) {
      if (this.tersentuh[kolom] || this.sudahDicoba) return this.galat[kolom] || '';
      return '';
    },

    simpan() {
      this.sudahDicoba = true;
      if (!this.formValid) {
        var pertama = Object.keys(this.galat)[0];
        this.fokusKe('f-' + pertama);
        this.tampilNotif('Masih ada ' + Object.keys(this.galat).length + ' isian yang perlu diperbaiki.', 'error');
        return;
      }

      var f = this.form;
      var data = {
        kode: f.kode.trim(),
        judul: f.judul.trim(),
        kategori: f.kategori,
        upbjj: f.upbjj,
        lokasiRak: f.lokasiRak.trim().toUpperCase(),
        harga: f.harga,
        qty: f.qty,
        safety: f.safety,
        catatanHTML: this.modal.mode === 'tambah'
          ? this.bersihkanHTML(f.catatanHTML)
          : (f.catatanHTML === this.stok[this.modal.indeks].catatanHTML
              ? f.catatanHTML                       // catatan lama tidak diubah
              : this.bersihkanHTML(f.catatanHTML))  // catatan diketik ulang -> dibersihkan
      };

      if (this.modal.mode === 'tambah') {
        this.stok.push(data);
        this.tampilNotif(data.judul + ' ditambahkan ke ' + data.upbjj + '.');
      } else {
        // splice dipakai agar perubahan elemen array terdeteksi Vue 2
        this.stok.splice(this.modal.indeks, 1, data);
        this.tampilNotif('Data ' + data.kode + ' diperbarui.');
      }
      this.sorotKunci = this.kunciBaris(data);
      var self = this;
      setTimeout(function () { self.sorotKunci = ''; }, 2500);
      this.modal.buka = false;
    },

    ubahQty(item, selisih) {
      var baru = item.qty + selisih;
      if (baru < 0) return;
      item.qty = baru;
      if (baru === 0) this.tampilNotif(item.judul + ' sekarang KOSONG.', 'error');
    },

    hapus(item) {
      if (!window.confirm('Hapus ' + item.kode + ' - ' + item.judul + ' (' + item.upbjj + ')?')) return;
      this.stok.splice(this.stok.indexOf(item), 1);
      this.tampilNotif(item.kode + ' dihapus dari daftar.');
    },

    kembalikanDataAwal() {
      if (!window.confirm('Semua perubahan akan dibuang dan data kembali seperti dataBahanAjar.js. Lanjutkan?')) return;
      this.stok = JSON.parse(JSON.stringify(this.stokAwal));
      this.tampilNotif('Data stok dikembalikan ke data awal.');
    },

    /* Catatan dari pengguna ditampilkan dengan v-html, jadi harus
       dibersihkan dulu agar tidak bisa menyisipkan script (XSS).
       Semua karakter HTML di-escape, lalu hanya tag format sederhana
       tanpa atribut yang dikembalikan. */
    bersihkanHTML(teks) {
      var aman = String(teks || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      return aman.replace(/&lt;(\/?)(em|strong|i|u|b)&gt;/gi, '<$1$2>');
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
    // (1) Setiap perubahan isi stok (tambah, edit, +/- qty, hapus)
    //     langsung disimpan ke localStorage. deep: true diperlukan
    //     karena yang berubah sering kali properti di dalam objek.
    stok: {
      deep: true,
      handler(baru) {
        try {
          localStorage.setItem(KUNCI_STOK, JSON.stringify(baru));
          this.terakhirDisimpan = new Date().toLocaleTimeString('id-ID');
        } catch (e) { /* mode privat: abaikan */ }
      }
    },

    // (2) Dependent filter: kategori bergantung pada UT-Daerah.
    //     Jika daerah dikosongkan, atau kategori terpilih tidak ada
    //     di daerah baru, filter kategori dikosongkan.
    'filter.upbjj'(baru, lama) {
      if (!baru) {
        this.filter.kategori = '';
        return;
      }
      var kat = this.filter.kategori;
      var masihAda = this.kategoriTersedia.some(function (k) { return k.nama === kat && k.jumlah > 0; });
      if (kat && !masihAda) {
        this.filter.kategori = '';
        this.tampilNotif('Kategori "' + kat + '" tidak ada di ' + baru + ', filter kategori dikosongkan.');
      }
    },

    // (3) Kode mata kuliah otomatis kapital dan tanpa spasi saat diketik
    'form.kode'(baru) {
      var bersih = (baru || '').toUpperCase().replace(/\s+/g, '');
      if (bersih !== baru) this.form.kode = bersih;
    },

    // (4) Tema: ubah atribut data-theme di <html> (efek samping ke DOM)
    //     immediate: true supaya langsung dijalankan saat halaman dibuka
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
    // salinan data asli untuk tombol "Kembalikan data awal"
    // (sengaja tidak didaftarkan di data karena tidak perlu reaktif)
    this.stokAwal = JSON.parse(JSON.stringify(this.stok));
    this.timerNotif = null;

    try {
      var tersimpan = localStorage.getItem(KUNCI_STOK);
      if (tersimpan) this.stok = JSON.parse(tersimpan);
    } catch (e) { /* data rusak atau storage diblokir: pakai data awal */ }
  }
});
