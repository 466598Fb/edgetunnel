# Notlarim - Gercek Zamanli Not Uygulamasi

WebSocket ile gercek zamanli senkronize, Quill.js zengin metin editorlu, PIN korumali not uygulamasi.

## Tek Komutla Deploy

```bash
cd not-uygulamam
bash deploy.sh
```

Script otomatik olarak:
- GitHub'da private repo olusturur
- Railway'de proje olusturur, volume ekler, deploy eder
- Public link ve sifre verir

Tarayicida 2 kez giris yapmaniz istenecek (GitHub + Railway).

## Manuel Kurulum

```bash
npm install
APP_PASSWORD=sifrem123 npm start
```

## Ortam Degiskenleri

| Degisken | Aciklama | Varsayilan |
|----------|----------|------------|
| `APP_PASSWORD` | Giris sifresi | `changeme` |
| `PORT` | Sunucu portu | `3000` |
| `DATA_DIR` | SQLite klasoru | `/data` |
