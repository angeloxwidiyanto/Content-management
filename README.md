# Cadence — Content Management GKY KGD

Kalender editorial & folder proyek untuk produksi konten media sosial
(internal & eksternal): jadwal drag-and-drop, media library, komentar,
activity log, dan ringkasan performa.

Dipakai internal di **https://content-management.gkykgd.org** — di belakang
login portal `app.gkykgd.org` dan hanya untuk pengguna yang punya akses modul
**Konten**.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 + `motion` + `recharts` + `lucide-react`
- Data disimpan di `localStorage` browser (seed workspace otomatis saat pertama
  dibuka); sinkron antar-tab lewat `BroadcastChannel`
- Tidak ada backend sendiri: auth dicek nginx lewat `/api/auth/gate` milik
  `gky-internal`

## Menjalankan lokal

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # hasil di dist/
```

## Deploy

Prasyarat: SSH alias `gkykgd-vm`, network Docker `gky-kelapa-gading_default`,
dan container `gky-internal` (portal + auth gate) sudah jalan.

```bash
./deploy/deploy.sh          # sync + build + up + health check
./deploy/deploy.sh caddy    # cetak blok Caddy untuk content-management.gkykgd.org
```

Container `gky-content` listen di `127.0.0.1:8088` (smoke test) dan
`gky-content:80` di network Docker. Caddy yang menangani TLS.

### DNS

Tambahkan A record di GoDaddy:

```
content-management  A  103.52.114.168  TTL 600
```

Setelah DNS aktif, pasang blok `deploy/Caddyfile.content` ke
`/home/gkykgd-server/apps/gky-kelapa-gading/Caddyfile` lalu reload Caddy —
sertifikat Let's Encrypt terbit otomatis pada request pertama.

## Auth & akses

- Belum punya sesi → redirect ke `app.gkykgd.org/login?next=<url asal>`.
- Sudah login tapi belum punya modul `content` → halaman "Akses belum diberikan".
- Superadmin otomatis punya semua modul; user lain dicentang di
  **Pengguna & akses** pada portal.
- Cookie sesi `gky_session` memakai `Domain=.gkykgd.org`, jadi otomatis
  terkirim ke subdomain ini.

## Catatan

Data workspace tersimpan per browser (`localStorage`), belum tersinkron antar
perangkat/user. Kalau nanti butuh kolaborasi nyata, langkah berikutnya adalah
menambah API penyimpanan (Postgres) dan memindahkan `useWorkspaceStore` ke
server.
