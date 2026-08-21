# Gənclər Evləri Platforması — Layihə Konteksti

> Bu fayl layihənin ümumi mənzərəsini saxlayır. Yeni söhbətə başlayanda bunu oxu — köhnə chat tarixçəsinə ehtiyac yoxdur.
> Hər mərhələ bitəndə "Status" və "Növbəti addımlar" bölmələrini yenilə.

---

## 1. Layihə nədir

Azərbaycan Respublikası Gənclər və İdman Nazirliyi üçün **Gənclər Evləri Platforması** — mövcud veb saytın Capacitor ilə mobil tətbiqə çevrilmiş versiyası.

- Hədəf platformalar: **Google Play** və **App Store**
- İstifadəçi kütləsi: gənclər, Gənclər Evləri (mərkəzlər), təlimçilər, nazirlik admini
- 13 yaşdan kiçiklər valideyn razılığı olmadan istifadə edə bilməz; yuxarı yaş məhdudiyyəti yoxdur

## 2. Texnologiya yığını

| Sahə | Texnologiya |
|---|---|
| Frontend | React + Vite + TypeScript |
| Stil | Tailwind CSS |
| Backend / DB | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Mobil örtük | Capacitor (Android + iOS) |
| Native funksiyalar | QR skaner, kamera/şəkil yükləmə, geri düyməsi idarəsi |

## 3. İş mühiti (Ubuntu/Linux noutbuk)

```bash
JAVA_HOME=/snap/android-studio/current/jbr      # .bashrc-də
PATH += ~/Android/Sdk/platform-tools            # adb üçün, .bashrc-də
```

- Android Studio quraşdırılıb, `android/` qovluğu Capacitor ilə əlavə edilib
- Release keystore: `~/gencler-release.jks`, alias `gencler`
- `android/keystore.properties` + `build.gradle`-də `signingConfigs` konfiqurasiya olunub

### Tez-tez işlədilən əmrlər

```bash
npm run build                    # veb build
npx cap sync android             # build-i native layihəyə köçür
npx cap open android             # Android Studio-da aç
cd android && ./gradlew assembleDebug     # debug APK
cd android && ./gradlew bundleRelease     # release .aab (mağaza üçün)
adb install app-debug.apk        # telefona qur
adb logcat | grep -i capacitor   # log izlə
```

## 4. Supabase

- **Aktiv layihə:** `qqxhhsowugwmxureltuf` (Frankfurt, free plan) — istifadəçinin öz hesabında
- Köhnə baza `kaydrgqrtluuzahnwuvf` **istifadə olunmur** (sahiblik problemi vardı, tərk edildi)
- 13 migration tətbiq olunub (9 əsas + 4 backend mərhələləri üçün)
- Edge function: `register-platform-account`
- `.env` faylı yeni URL və anon key ilə yenilənib

### Vacib cədvəllər / məntiq

- `house_trainers` — mərkəz təlimçini komandasına əlavə edir; RLS `works_with_house` ilə təlimçi yalnız öz mərkəzində tədbir yarada bilir
- `user_qr_tokens` — gəncin şəxsi QR-ı, **5 dəqiqəlik token**; təlimçi/mərkəz skan edir → iştirak qeydə alınır + xal verilir
- Xal / səviyyə / nişan sistemi mövcuddur
- **Mükafat modulu tamamilə silinib** (cədvəllər, funksiyalar, UI) — xal sistemi qalır

### Qeydiyyat məntiqi

- Gənclər Evləri **özləri qeydiyyatdan keçir**, admin təsdiqindən sonra siyahıda görünür (admin əl ilə əlavə etmir)
- 35 rəsmi mərkəzin siyahısı `src/data/youthHouseList.ts` faylındadır — qeydiyyat formasındakı açılan siyahı üçün. RLS anonim sorğuya icazə vermədiyi üçün bazadan yox, app-dən oxunur
- Bu 35 mərkəz bazaya öncədən əlavə **edilməyəcək**

### Test hesabları

- Admin: `admin@mys.gov.az` (Supabase panelindən əl ilə yaradıldı)
- Test gənc: `ali.mammadov@mys.gov.az`

## 5. Həll olunmuş texniki problemlər

| Problem | Həll |
|---|---|
| Android WebView-də şaquli scroll işləmirdi | `index.css`-də `overflow-x: hidden` → `clip` |
| Geri düyməsi düzgün işləmirdi | `src/lib/backHandler.ts` (handler stack) + `native.ts` düzəlişi; 4 rol ekranına hook əlavə edildi |
| Admin paneldə saylar 0 görünürdü | Səbəb backend-in olmaması idi — 4-8-ci mərhələ backend-i yazıldı |

## 6. Modulların vəziyyəti

**Bitib (real backend-ə bağlıdır):**
- Admin dashboard (RPC ilə statistikalar)
- Gənclər Evi paneli + giriş-çıxış jurnalı
- QR ziyarət axını
- Tədbirlər + tədbir check-in
- Reytinq
- Xəbərlər / məzmun
- Bildirişlər və rəy
- Gəncin göstəriciləri (xal, səviyyə, nişan)
- Təlimçi paneli (4 tab ilə yenidən yazıldı)
- Hesab silmə (Profil → Hesabı sil)

**Silinib:** mükafat modulu

## 7. Mağaza statusu

### Ümumi
- **D-U-N-S nömrəsi: 565405487** (nazirlik artıq D&B bazasında qeydiyyatdadır — yeni müraciətə ehtiyac yoxdur)
- D&B-dəki qeyd adı: "AZERBAYCAN RESPUBLIKASI GENCLƏR VE IDMAN NAZIRLIYI"
- Eyni D-U-N-S bütün platformalar üçün keçərlidir (Google, Apple, Samsung, Microsoft)
- Hesablar nazirliyin adına: `apps@mys.gov.az` (görünən ad: Gənclər və İdman Nazirliyi)
- Google əlaqə e-poçtu: `elvin.muradzada@mys.gov.az`
- Rəsmi işlək telefon: **012 599 01 87** (saytdakı digər nömrələr işləmir)
- Ünvan: AZ1072, Bakı, Olimpiya küç. 4
- VÖEN: 1500171121

### Google Play Console
- ✅ Ödəniş profili yaradıldı, D-U-N-S bağlandı
- ✅ Təşkilat/developer profili, kateqoriya (dövlət qurumu), əlaqə məlumatları
- ✅ Vergilər Nazirliyinin Qeydiyyat Şəhadətnaməsi yükləndi → "Юридическое лицо: Отправлено"
- ✅ "Уполномоченный представитель" mərhələsi göndərildi
- ⏳ İnsan yoxlaması gözlənilir
- ⚠️ **Giriş problemi:** hesabın əsl sahibi `elvinmuradzada@gmail.com` kimi qeydə düşüb; `apps@mys.gov.az`-a giriş passkey (2FA) ilə şəxsi Gmail-ə yönləndirir. Həll olaraq `elvin.muradzada@mys.gov.az`-a "Администратор (все разрешения)" dəvəti göndərilib — cavab gözlənilir
- ❌ Son "Условия" ekranı və **$25 ödəniş** hələ edilməyib

### Apple
- Apple Account `apps@mys.gov.az` ilə yaradıldı (Brave brauzerində alınmadı, başqa brauzerdə keçdi)

### Hüquqi səhifələr — BİTİB
Google Sites-də dərc olunub (nazirliyin IT şöbəsindən asılı olmadan):
- Məxfilik siyasəti: https://sites.google.com/view/gencler-evleri-platformasi/məxfilik-siyasəti
- Hesabın silinməsi: https://sites.google.com/view/gencler-evleri-platformasi/hesabın-silinməsi

### Mağaza materialları
- Mətnlər hazırdır (`magaza-materiallari.md`): başlıq "Gənclər Evləri Platforması", qısa və tam təsvir
- ❌ **Vizuallar hələ hazır deyil:** ikon 512×512, feature graphic 1024×500, ekran şəkilləri (min 2, tövsiyə 4-8, 1080×1920)

## 8. Növbəti addımlar

1. Play Console-a admin girişini bərpa etmək (dəvətin qəbulu)
2. $25 developer ödənişi + "Условия" ekranı
3. Ekran şəkillərini çəkmək və feature graphic hazırlamaq
4. Play Console-un "Privacy policy" sahəsinə Google Sites linkini əlavə etmək
5. `.aab`-ı yükləyib daxili test (internal testing) buraxılışı yaratmaq
6. iOS tərəfi: Xcode layihəsi, App Store Connect

---

## Bu faylı necə istifadə etməli

- **Claude Code:** faylı layihə kökündə saxla — hər sessiyada avtomatik oxunur
- **Adi chat:** yeni söhbətə başlayanda bu faylı yüklə, bütün chat tarixçəsini yapışdırmağa ehtiyac yoxdur
- **Yenilə:** hər mərhələ bitəndə müvafiq sətri dəyiş — fayl 200-250 sətrdən artıq böyüməsin
