# 📦 Barkod Okuma Uygulaması

Angular 20.3 ile geliştirilmiş modern bir barkod okuma ve stok yönetim uygulaması. Kablosuz barkod okuyucu ile gerçek zamanlı okuma, manuel giriş ve gelişmiş düzenleme özellikleri sunar.

## ✨ Özellikler

### 🎯 Ana Özellikler
- ✅ **Gerçek zamanlı barkod okuma** - Kablosuz barkod okuyucu desteği
- ✅ **Manuel barkod girişi** - Okunamayan barkodlar için elle giriş
- ✅ **Fiş bazlı oturum yönetimi** - Her fiş için ayrı kayıt
- ✅ **Hızlı düzenleme** - Inline cell editing ve +/- butonları
- ✅ **Geçmiş kayıtlar** - Bekleyen işlemleri görüntüleme ve yönetme
- ✅ **Offline destek** - LocalStorage ile çevrimdışı çalışma
- ✅ **Responsive tasarım** - Mobil, tablet ve masaüstü uyumlu

### 🔧 Teknik Özellikler
- Angular 20.3.0 (Standalone Components)
- Tailwind CSS 3.4.0
- Server-Side Rendering (SSR) desteği
- RxJS ile reaktif state yönetimi
- JWT tabanlı authentication
- HTTP interceptor ile token yönetimi

## 🚀 Kurulum

### Gereksinimler
- Node.js 18.x veya üzeri
- npm 9.x veya üzeri

### Adımlar

1. **Projeyi klonlayın:**
```bash
git clone https://github.com/yilmazmurad/barkod-app.git
cd barkod-app
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
```

3. **Geliştirme sunucusunu başlatın:**
```bash
npm start
```

4. **Tarayıcınızda açın:**
```
http://localhost:4200/
```

Uygulama otomatik olarak yeniden yüklenecektir.

## 📖 Kullanım

### Giriş Yapma
- Herhangi bir kullanıcı adı ve şifre ile giriş yapabilirsiniz (Mock authentication)
- Varsayılan: `admin` / `admin`

### Barkod Okutma
1. Fiş numarası ve tarih girin
2. "Okumaya Başla" butonuna tıklayın
3. Barkod okuyucunuzla ürünleri okutun
4. Manuel giriş için form alanını kullanın
5. Miktarları düzenlemek için:
   - Sayıya tıklayın (inline editing)
   - +/- butonlarını kullanın
   - Düzenle butonuna tıklayın

### Hızlı Düzenleme
- **Barkod:** Barkod numarasına tıklayarak değiştirin
- **Miktar:** Sayıya tıklayarak düzenleyin
- **Enter:** Kaydet
- **Esc:** İptal
- **+/-:** Hızlı miktar artır/azalt

### Kayıtları Yönetme
- **Kaydet:** İşlemi daha sonra göndermek üzere kaydedin
- **Gönder:** API'ye gönder (Mock)
- **Geçmiş:** Bekleyen kayıtları görüntüleyin

## 🏗️ Proje Yapısı

```
src/
├── app/
│   ├── components/
│   │   ├── barcode-scan/    # Ana barkod okuma sayfası
│   │   ├── history/          # Geçmiş kayıtlar
│   │   └── login/            # Giriş sayfası
│   ├── guards/
│   │   └── auth.guard.ts     # Route koruma
│   ├── interceptors/
│   │   └── auth.interceptor.ts  # HTTP interceptor
│   └── services/
│       ├── auth.service.ts      # Kimlik doğrulama
│       ├── barcode.service.ts   # Barkod yönetimi
│       └── api.service.ts       # HTTP istekleri
├── environments/
│   ├── environment.ts           # Production
│   └── environment.development.ts  # Development
└── styles.css                   # Global stil ve Tailwind
```

## 🛠️ Komutlar

### Geliştirme
```bash
npm start              # Dev sunucusu (port 4200)
npm run watch          # Watch mode ile build
```

### Build
```bash
npm run build          # Production build
npm run build:dev      # Development build
```

### Test
```bash
npm test               # Unit testleri çalıştır
```

### SSR
```bash
npm run serve:ssr      # SSR sunucusu (port 4000)
```

## 🎨 Tailwind CSS

Proje Tailwind CSS 3.4.0 kullanmaktadır. Özel stiller için:

```css
/* src/styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Yapılandırma: `tailwind.config.js`

## 🔐 Güvenlik

- JWT token tabanlı authentication
- Route guard ile sayfa koruması
- HTTP interceptor ile otomatik token enjeksiyonu
- SSR uyumlu localStorage yönetimi (isPlatformBrowser)

## 📱 Responsive Tasarım

- **Mobil:** 320px - 767px
- **Tablet:** 768px - 1023px
- **Masaüstü:** 1024px ve üzeri

## 🌐 Tarayıcı Desteği

- Chrome (son 2 versiyon)
- Firefox (son 2 versiyon)
- Safari (son 2 versiyon)
- Edge (son 2 versiyon)

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/yeniOzellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeniOzellik`)
5. Pull Request oluşturun

## 📞 İletişim

- **Geliştirici:** Murat Yılmaz
- **GitHub:** [@yilmazmurad](https://github.com/yilmazmurad)

## 🙏 Teşekkürler

- [Angular](https://angular.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [RxJS](https://rxjs.dev/)
