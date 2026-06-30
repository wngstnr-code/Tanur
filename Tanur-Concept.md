# Tanur

**Tokenized Indonesian Nickel Revenue on Stellar**

> Real ore. Real revenue. On-chain yield in USDC — anchored on official data feeds, with an AI oracle that rejects bad data before it hits the chain.

*Dari bijih jadi yield.* — Untuk **APAC Stellar Hackathon 2026** (deadline 15 Juli · demo 18 Juli).

`STATUS: FINAL v1.0` · **Primary track:** Local Finance & Real-World Access ($20k) · **Secondary:** DeFi & Composability

**TL;DR:** Tokenisasi revenue nikel Indonesia (#1 dunia) jadi token `TANUR` di Stellar. Beli pakai USDC, yield dibayar USDC, likuid di SDEX. Datanya bersih & resmi (LME + HPM ESDM + Antam teraudit) — gap data yang dulu jadi kelemahan, di nikel jadi kekuatan. **2 kontrak Soroban + asset native**, **1 agen oracle wajib + 1 closed-loop stretch**, KYC native via authorization flag. AI memposisikan diri sebagai penjaga trust data, bukan headline.

---

## 0. Nama & Brand

**Tanur** = tungku peleburan / *smelter* dalam bahasa Indonesia. Smelter adalah simbol boom nikel & hilirisasi Indonesia (Morowali, IMIP) — tempat **bijih mentah berubah jadi nilai**. Metafora yang pas untuk protokol yang mengubah revenue tambang jadi yield on-chain. Berakar Indonesia (sejalan dengan brand sebelumnya, Sawit), pendek, gampang diucap global (TAH-noor), tidak bentrok brand besar.

- **Token:** `TANUR` (Stellar Asset, CEP-setara: SEP-41 / Stellar Asset Contract)
- **Tagline EN:** *"Own a fractional, yield-bearing claim on Indonesia's nickel revenue."*

---

## 1. Masalah

Indonesia adalah **produsen nikel #1 dunia (~50% pasokan global)** — komoditas paling kritis untuk baterai EV dan transisi energi. Tapi revenue-nya sepenuhnya off-chain dan tertutup bagi investor global maupun retail Indonesia:

- **Tidak ada akses fraksional.** Kamu tak bisa beli stake $100 atas revenue sebuah operasi tambang nikel.
- **Investor terkunci dari aset nasionalnya sendiri.** Orang Indonesia tak bisa ikut menikmati hasil komoditas negaranya secara langsung & likuid.
- **Trust gap RWA.** Tokenisasi RWA biasanya = "percaya operator": angka produksi, matematika yield, dan compliance semua di kotak hitam.

## 2. Solusi

**Tanur** mentokenisasi **revenue produksi nikel Indonesia** sebagai token `TANUR` di Stellar. Tiap token adalah klaim fraksional yang menghasilkan yield atas output nikel nyata — bukan sintetis, bukan price tracker. Yield dibayar dalam **USDC**, token-nya **likuid di SDEX**, dan setiap aksi operator **bisa diverifikasi on-chain**.

**Pembeda dari RWA biasa & dari proyek palm-oil sebelumnya:** datanya bersih dan resmi. Harga pakai feed exchange + harga acuan **resmi pemerintah**, produksi dari **laporan emiten bursa yang teraudit**. Inilah yang dulu jadi titik lemah; di nikel ini jadi kekuatan.

---

## 3. Kenapa Nikel + Indonesia (data = moat)

Pelajaran terpenting dari proyek RWA sebelumnya: **datanya yang menentukan, bukan komoditasnya.** Nikel menang di dua kriteria sekaligus:

1. **Indonesia dominan** — #1 dunia, bahkan lebih dominan daripada sawit, dan praktis mengontrol pasar lewat kebijakan hilirisasi/larangan ekspor bijih.
2. **Data accessible & resmi** — tiga feed yang bisa diverifikasi:

| Feed | Sumber | Sifat |
|---|---|---|
| Harga global | **LME Nickel** | Exchange, USD, real-time |
| Harga acuan resmi | **HPM (Harga Patokan Mineral), ESDM** | Diterbitkan rutin oleh pemerintah Indonesia |
| Produksi teraudit | **Antam (ANTM)** — laporan kuartalan IDX | Emiten terbuka → tonase dari **filing teraudit**, bukan PDF asosiasi |

**Pola yang menyelesaikan masalah data secara struktural:** tokenisasi revenue produsen yang **listed di bursa**, sehingga produksi datang dari laporan teraudit + harga acuan resmi + harga LME. Oracle Tanur benar-benar *"verifies real production"* — klaim yang jujur, bukan dilunakkan.

---

## 4. Kenapa Stellar

Hackathon ini menekankan **produk nyata, composability, dan integrasi ekonomi lokal** — dan Stellar pas untuk RWA emerging-market:

- **Asset issuance native** — nerbitin `TANUR` itu primitif bawaan, bukan smart contract rumit.
- **USDC native** (Circle resmi) → yield langsung stablecoin, **zero FX mismatch** (revenue nikel USD-denominated).
- **SDEX** (orderbook bawaan) + **path payments** → `TANUR` likuid, dan user bisa bayar pakai stablecoin apa pun (USDT→USDC konversi atomik).
- **Soroban (Rust)** untuk logika oracle/vault/yield — skill kontrak transferable.
- **Reflector** (oracle network Stellar, SEP-40) — composable; dipakai untuk FX **bila IDR tersedia** (default fallback: public FX API, display-only).
- **SEP-10/12** (auth + KYC) → gate compliance RWA pakai standar bawaan.
- **Tesis inklusi keuangan** Stellar = nyambung dengan "kasih akses modal global & retail ke komoditas Indonesia."

---

## 5. Keputusan Settlement: **USDC** (bukan IDR stablecoin)

**Settle dalam USDC.** Alasan:

- USDC native & live di Stellar (testnet + mainnet) → **real product, bukan sandbox**.
- Revenue nikel USD-denominated → end-to-end USD, **zero FX mismatch**.
- **De-risk build 15 hari** — menghilangkan integrasi anchor IDR yang paling rapuh dari critical path.

**Catatan riset:** *tidak ada* stablecoin/anchor IDR yang live di Stellar saat ini — XIDR (StraitsX) di Ethereum/Zilliqa/Polygon, IDRX di Polygon/Base. Jadi rail IDR bukan opsi cepat.

**Tetap terasa "Indonesia" tanpa anchor:**
- **Tampilkan harga & yield dalam Rupiah** di UI pakai **public FX API** (mis. `open.er-api.com`), tapi settle USDC. Reflector USD/IDR jadi bonus composability **kalau IDR tersedia** di feed-nya.
- **Terima stablecoin apa pun via path payment** (USDT→USDC atomik via SDEX) — flex fitur Stellar.
- **Anchor IDR (SEP-24) = roadmap v2** untuk on/off-ramp retail. Production path kredibel: StraitsX/IDRX sedang ekspansi APAC.

Cerita "Indonesia" ada di **aset**-nya (nikel, HPM, Antam), bukan di rail uangnya — jadi ini tetap 100% RWA Indonesia walau settle USD.

---

## 6. Arsitektur

**Ramping: 2 kontrak Soroban + 1 asset native** (turun dari 4 kontrak ala proyek sebelumnya — di Stellar, token = primitif native, bukan kontrak buatan tangan).

```
                         ┌──────────────────────────────────────────┐
ON-RAMP / BELI           │  User → Freighter/Lobstr                  │
  USDC (atau USDT        │     │ SEP-10 auth                          │
  →USDC via path payment)│     ▼  KYC = AUTH_REQUIRED trustline       │
        │                │  beli TANUR (USDC → TANUR di SDEX)         │
        ▼                └──────────────────────────────────────────┘
   ┌──────────────────────────┐        ┌──────────────────┐
   │ TanurVault (Soroban)      │◄───────│ Oracle Agent      │ LME + HPM(ESDM) + Antam
   │  • record_epoch (gated)   │ post   │ (Python, SEP-40   │ → cross-validate → Gemini gate
   │  • oracle reputation      │ SEP-40 │  publisher)       │ → post on-chain (rep. score)
   │  • mint dari state         │        └──────────────────┘
   │    terverifikasi (atomik) │
   └───────────┬───────────────┘
        mint via SAC admin
               ▼
   ┌──────────────────────────┐
   │ TANUR  (Stellar Asset +   │  native asset, tradeable di SDEX
   │ Stellar Asset Contract)   │  KYC gate = issuer authorize trustline
   └───────────┬───────────────┘
               ▼
   ┌──────────────────────────┐   revenue nikel → USDC
   │ TanurYield (Soroban)      │◄──── auto-trigger by price (cron/fungsi, bukan "agen")
   │  • fund epoch (USDC)      │
   │  • klaim KYC-gated         │── reads KYC dari Vault (cross-contract)
   └───────────┬───────────────┘
               ▼
   TANUR holders klaim USDC

Public FX API (Reflector opsional) ──► hanya untuk DISPLAY Rupiah di UI (no settlement risk)
```

### 6.1 Kontrak Soroban (Rust) — 2 kontrak + asset native

| Komponen | Fungsi |
|---|---|
| **TANUR** *(Stellar Asset + SAC)* | Token native — klaim yield-bearing atas revenue nikel. **Bukan kontrak tulis-tangan**: pakai primitif asset Stellar + Stellar Asset Contract. Tradeable di SDEX. **KYC = authorization flag** (`AUTH_REQUIRED`): hanya akun ter-KYC yang trustline-nya diotorisasi issuer boleh memegang TANUR. |
| **TanurVault** *(Soroban)* | Gabungan vault + minter. Simpan data nikel terverifikasi (tonase Ni, harga LME/HPM, operasi), **skor reputasi oracle rolling**, dan **mint TANUR langsung dari state terverifikasinya sendiri** (record + mint atomik → operator tak bisa palsukan jumlah, bahkan lebih kuat dari CPI terpisah). Oracle-gated `record_epoch` (tolak skor rendah, epoch duplikat, data nol). Jadi admin SAC. |
| **TanurYield** *(Soroban)* | Pegang revenue **USDC** per epoch; klaim **KYC-gated** (cek Vault cross-contract); window klaim + sweep. Dipisah karena memegang dana → isolasi risiko. |

> **Kenapa turun dari 4 → 2:** (1) Token Stellar = asset native, jadi "TanurToken (CEP-18)" hilang sebagai kontrak. (2) Minter digabung ke Vault — record & mint jadi atomik, trust story makin kuat. (3) Cross-contract tetap ada (Yield ↔ Vault untuk KYC). Surface area lebih kecil, waktu hemat dialihkan ke UX & composability yang dibayar track.

### 6.2 Oracle 3-feed (data integrity — pelajaran utama)

- **Harga nikel** dari **oracle agent kita sendiri**: ambil **LME** (real-time) + **HMA/HPM ESDM** (acuan resmi, ~2×/bulan), cross-validate (penalti divergensi), lalu **Gemini reasoning gate** (bisa veto anomali musiman/spike), baru post on-chain via interface SEP-40 yang kita implement.
- **Produksi** dari **Antam (ANTM)** laporan kuartalan teraudit (representative di MVP, dengan path jelas ke data feed resmi).
- **FX USD/IDR** (display Rupiah saja) — **public FX API** sebagai default (mis. `open.er-api.com`). **Reflector opsional**: IDR belum terkonfirmasi ada di fiat-rates feed-nya (cek `assets()` di hari-1). Karena ini display-only, tidak ada risiko trust.

> **Penting:** Reflector punya FX & crypto, **tidak punya komoditas** (tidak ada nikel) — dan IDR pun belum tentu ada. Jadi: harga nikel = **agent kita** (LME+HPM, inovasi), FX display = **public API** (Reflector hanya bonus kalau IDR tersedia). Settlement & trust sama sekali tidak bergantung pada FX feed.

**Cadence 3-feed (terverifikasi):**

| Feed | Sumber | Cadence | Sifat |
|---|---|---|---|
| Harga internasional | LME / proxy API | real-time | live |
| Acuan resmi | **HMA/HPM ESDM** (Kepmen 144.K/2026, berlaku 15 Apr 2026; terbit di `minerba.esdm.go.id` + APNI) | ~2×/bulan | resmi, terpublikasi |
| Produksi | Antam (ANTM) IDX | kuartalan | teraudit |

### 6.3 Agentic layer — **1 agen inti + 1 pembeda** (fokus, bukan 3)

Hackathon ini tidak punya track "agentic AI", jadi agen dipangkas ke yang benar-benar bercerita:

| Agen | Status | Peran | AI |
|---|---|---|---|
| **Oracle Agent** | ✅ **WAJIB** | Anchor harga LME + HPM, cross-validate, Gemini veto, post on-chain (update skor reputasi). Inti cerita "Real-World Access". | Gemini 2.5 Flash |
| **Market Analyst** | 🟡 **STRETCH** | Baca kontrak → analisis Gemini → **closed loop**: tune GORR on-chain (safety rails ±100 bps, band [1%,10%]). Pembeda "wow". | Gemini 2.5 Flash |
| ~~Yield Router~~ | 🔻 **Demosi** | Bukan agen sungguhan (rule-based). Jadikan **fungsi/cron auto-trigger** distribusi, jangan dipasarkan sebagai "agen ketiga". | — |

Closed-loop `READ chain → REASON (Gemini) → WRITE chain` tetap jadi pembeda agentic, tapi diposisikan **mendukung produk**, bukan seluruh cerita. Pasarkan jujur: **1 agen esensial + 1 pembeda**, bukan memaksakan "3 agen".

### 6.4 Peran & Justifikasi AI (kenapa dipertahankan, dan batasnya)

Hackathon ini **tidak punya track "agentic AI"**, jadi AI di Tanur diposisikan sebagai **infrastruktur trust yang (hampir) tak terlihat** — bukan fitur pamer. Reframe-nya:

> **Tanur bukan proyek AI. Tanur adalah RWA nikel yang oracle-nya pakai AI untuk menolak data buruk sebelum masuk chain.**

AI mempertegas *kepercayaan data* (yang dinilai track **primary**), bukan menjalankan protokol (track yang tak ada di sini). Tiga lapisan, beda nasib:

| Lapisan | Butuh AI? | Nasib |
|---|---|---|
| Oracle sebagai **data pipeline** (LME+HPM+Antam → on-chain) | Tidak (logika + cross-validate) | ✅ WAJIB — inti real-world access |
| **Gemini anomaly gate** (veto data aneh sebelum on-chain) | Ya | ✅ KEEP — **harus terbukti berguna** |
| **Closed-loop Market Analyst** (tune GORR otonom) | Ya | 🟡 STRETCH — **jangan live saat demo** |

**Kenapa tetap dipertahankan:** (1) biaya rendah — port ~1:1 dari proyek sebelumnya; (2) diferensiasi nyata di lautan entri RWA; (3) memperkuat track primary (oracle yang bisa *menolak* data buruk = bukti trust); (4) angle forward-looking membantu peluang follow-on grant / ambassador.

**Risiko & mitigasi (wajib dipatuhi saat build & demo):**

| Risiko | Mitigasi |
|---|---|
| Demo flaky — LLM call live bisa lambat/error/halusinasi | **Jangan taruh LLM call di critical path demo.** Pre-run / cache. Closed-loop ditunjukkan via rekaman terkontrol. |
| AI-washing — juri skeptis lihat AI tempelan | **Tunjukkan Gemini gate menangkap data buruk**: tanam 1 reading anomali (spike palsu) di demo, perlihatkan AI mem-veto. Value-add yang kelihatan. |
| Opportunity cost — jam AI = jam bukan UX | **Aturan emas: kalau waktu mepet, yang dipotong AI, bukan UX.** Track primary bayar accessibility. |

---

## 7. Composability Map (yang dinilai juri)

| Kebutuhan | Building block Stellar (jangan reinvent) |
|---|---|
| Token TANUR | **Stellar Asset + Stellar Asset Contract (SAC)** → programmable + tradeable SDEX |
| Likuiditas / beli-jual | **SDEX** + **path payments** (bayar stablecoin apa pun → USDC) |
| Yield stablecoin | **USDC native** |
| FX display Rupiah | **Public FX API** (default) · Reflector SEP-40 (opsional, jika IDR ada) |
| Auth & KYC | **SEP-10 (auth)** + **AUTH_REQUIRED trustline** (KYC native, tanpa registry kustom) |
| Logika oracle/vault/yield | **Soroban** (2 kontrak) |
| Wallet | **Freighter / Lobstr / xBull** |
| On/off-ramp IDR (v2) | **Anchor Platform (SEP-24)** — StraitsX/IDRX di production |

---

## 8. User Journey (inilah "real product")

```
1. Buka app → connect Freighter
2. KYC sekali → issuer otorisasi trustline TANUR (native, bukan SEP-12 berat)
3. Beli TANUR pakai USDC (atau USDT→USDC via path payment)
4. Lihat posisi & yield — ditampilkan dalam USD & Rupiah (public FX API)
5. Yield USDC mengalir tiap epoch (revenue nikel)
6. Klaim USDC, ATAU jual TANUR di SDEX kapan saja
7. (v2) Withdraw balik ke IDR via anchor SEP-24
   (Catatan: langkah 2 KYC = otorisasi trustline TANUR oleh issuer — native, bukan flow SEP-12 berat)
```

Loop lengkap **uang → aset → yield → likuid**. Bukan sekadar "connect wallet & claim."

---

## 9. Tokenomics

```
tanur_minted = nickel_tonnes × token_rate × (GORR_bps / 10,000)
```

- **token_rate** = jumlah TANUR per tonne Ni (configurable, mis. 1,000)
- **GORR** = Gross Overriding Royalty Rate — share revenue nikel yang dirutekan ke holder
- **Yield** dibayar dalam **USDC**

**Contoh epoch representatif (bulanan):**
- Operasi: 5,000 tonne Ni-content × harga LME ~$16,000/t = **~$80M gross revenue**
- GORR 100 bps (1%) → **~$800k/bulan** ke holder (USDC)
- Untuk raise $X, APY ≈ (yield bulanan × 12) / X — mis. raise $8M @ $800k/bln × 12 = **~120% gross**, dituning lewat GORR ke target APY realistis (mis. 12–15%) dengan GORR jauh lebih kecil.

> Angka produksi representatif di MVP (pending feed Antam live); **harga LME & HPM live**, dan formula + GORR transparan on-chain.

---

## 10. Compliance & Trust (RWA jujur)

- **Oracle tak bisa palsukan** — record epoch & mint atomik dalam Vault; tiap submission update skor reputasi publik.
- **Yield KYC-gated** — hanya akun ter-KYC yang trustline TANUR-nya diotorisasi issuer (`AUTH_REQUIRED`) yang bisa memegang token & klaim. Native Stellar, bukan registry kustom.
- **Multi-source validation** — data ditolak jika 3 sumber divergen > threshold / skor di bawah minimum.
- **AI safety rails** — perubahan GORR otonom dibatasi ±100 bps/siklus, band [1%,10%].
- **On-chain oracle reputation** — skor akurasi rolling, dapat dibaca siapa pun (`get_oracle_reputation`).

---

## 11. Strategi Track (Prize Pool 3×$20k)

Hadiah dibagi ke **3 track @ $20k** (1st $8k · 2nd $6k · 3rd 2×$3k). Tanur dibangun untuk **menang di satu track primary**, dengan desain yang cukup kuat agar juga kompetitif di satu secondary. **Jangan kejar consumer-payment** — fit lemah, hanya men-dilute fokus.

| Track ($20k) | Fit | Strategi |
|---|---|---|
| 🥇 **Local Finance & Real-World Access** | **PRIMARY — rumah Tanur** | RWA nikel = real-world system; akses fraksional retail = accessibility. Kartu terkuat: oracle data resmi (LME+HPM+Antam) + display Rupiah. |
| 💸 **DeFi & Composability** | **SECONDARY** | USDC + SDEX + path payment + native asset/SAC + auth-flag (+ Reflector opsional). Desain agar ikut dinilai di sini. |
| 📱 Payment Consumer Apps | ❌ Lewati | Bukan payment app. |

**Pemetaan ke yang dinilai:**

| Yang dinilai | Tanur |
|---|---|
| Real-world access (primary) | Koneksi *asli* ke revenue nikel via 3 feed resmi + skor reputasi oracle on-chain; akses fraksional + display Rupiah |
| Real utility, bukan prototype | Loop uang→aset→yield→likuid yang lengkap, USDC live (bukan sandbox) |
| **Composability** (secondary) | Native asset + SAC + SDEX + path payment + USDC + auth-flag KYC (+ Reflector opsional) |
| Connect users to local economies | Retail & global akses revenue nikel Indonesia |
| Local anchor (encouraged) | Roadmap v2 SEP-24 (StraitsX/IDRX) — diakui jujur |
| Pembeda ekstra | Agentic oracle closed-loop + on-chain oracle reputation |

---

## 12. Scope Build (deadline 15 Juli, mulai 30 Juni → ~15 hari)

**MVP (wajib):**
- [ ] **2 kontrak Soroban** (TanurVault + TanurYield) + **TANUR asset/SAC** — di Testnet
- [ ] KYC native via `AUTH_REQUIRED` trustline (issuer authorize)
- [ ] Oracle agent 3-feed (LME + HPM + Antam) posting on-chain via SEP-40
- [ ] Frontend Next.js: connect Freighter, beli TANUR (USDC), lihat posisi (USD+IDR via public FX API), klaim USDC
- [ ] Yield distribusi USDC, KYC-gated
- [ ] Full loop tereksekusi on-chain (record+mint → fund → claim) + tx hash di explorer

**Stretch (kalau sempat):**
- [ ] Listing TANUR di SDEX testnet + path payment (USDT→USDC)
- [ ] Agentic closed-loop (Market Analyst tune GORR on-chain)
- [ ] Stub anchor IDR SEP-24 (Anchor Platform sandbox)
- [ ] Demo video + pitch deck

**Aset transferable (percepat):**
- Odra/Rust → **Soroban/Rust** (konsep kontrak hampir sama)
- Agentic Python layer → **copy ~1:1** (ganti bridge ke Stellar SDK)
- Next.js frontend → **reusable**, swap wallet (CSPR.click → Freighter)

---

## 13. Roadmap

| Status | Item |
|---|---|
| 🔜 | **Anchor IDR (SEP-24)** — on/off-ramp Rupiah untuk retail (StraitsX/IDRX) |
| 🔜 | **Feed produksi Antam live** — dari laporan IDX teraudit ke oracle |
| 🔜 | **Mainnet + kemitraan operasi nikel nyata** (Antam/IMIP) |
| 🔜 | **Merkle-based claims** — distribusi gas-efficient di skala holder |
| 🔜 | **Listing & likuiditas SDEX** + integrasi DeFi Soroban (lending pakai TANUR sebagai collateral) |

---

## 14. Data Provenance — jujur sejak awal

- **Live:** harga LME, harga acuan HPM (ESDM), FX USD/IDR (public FX API, display-only).
- **Teraudit (representative di MVP):** tonase produksi dari laporan kuartalan Antam (IDX) — path jelas ke feed resmi.
- **Tidak ada yang dipalsukan downstream:** record epoch & mint terjadi atomik di dalam Vault — jumlah mint terkunci kriptografis ke state terverifikasi yang baru saja dicatat, operator tak bisa menyisipkan angka lain.

---

## 15. Temuan Validasi (terkunci) & Referensi Teknis

Hasil riset 3 risiko teknis — **tidak ada blocker fatal**, semua punya jalur jelas.

| Risiko | Status | Aksi |
|---|---|---|
| **USDC issuer** | ✅ Resolved | Pakai issuer testnet di bawah |
| **HPM nikel** | ✅ Resolved | Scrape ESDM/APNI atau input terverifikasi, cadence ~2×/bulan |
| **Reflector IDR** | ⚠️ Fallback ready | Display via public FX API; Reflector opsional (cek `assets()` hari-1) |
| **Kapasitas waktu** | 🟡 Disiplin | MVP dulu (USDC, no anchor); IDR/anchor = stretch/v2 |

### Referensi teknis terverifikasi

**USDC (Circle, asset code `USDC`):**
- Testnet issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- Mainnet issuer: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
- Dapat test USDC: Circle testnet faucet (`faucet.circle.com`); XLM gas dari friendbot

**Reflector (SEP-40 oracle, opsional — hanya jika IDR ada):**
- Fiat rates testnet: `CCSSOHTBL3LEWUCBBEB5NJFC2OKFRC74OWEIJIZLRJBGAAU4VMU5NV4W`
- FX terkonfirmasi: USD/EUR/GBP; **IDR belum** → fallback `open.er-api.com` (display-only)

**HPM/HMA Nikel (ESDM):**
- Regulasi: Kepmen ESDM No. 144.K/MB.01/MEM.B/2026 (formula baru, berlaku 15 Apr 2026)
- Terbit: `minerba.esdm.go.id` + APNI; cadence ~2 periode/bulan
- HPM = f(HMA bulanan [LME-derived] × kadar Ni [MC 30%/35%] × faktor koreksi)

---

*Tanur — APAC Stellar Hackathon 2026 · RWA · DeFi · Agentic AI · Nikel Indonesia*
