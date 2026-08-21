/**
 * Azərbaycanda rəsmi "Gənclər evi" sosial xidmət müəssisələri (35 ədəd).
 *
 * Qeydiyyat forması giriş etməmiş istifadəçiyə göstərildiyi üçün bu siyahı
 * bazadan deyil, birbaşa app-in içindən oxunur — RLS anonim sorğulara
 * `youth_houses` cədvəlini bağlayır.
 *
 * Siyahı dəyişəndə bu faylı yeniləmək kifayətdir.
 */

export type YouthHouseOption = {
  /** Formada saxlanılan dəyər — `profiles.youth_house_name` sahəsinə yazılır. */
  name: string;
  /** Ərazi — seçim siyahısında adın yanında göstərilir. */
  area: string;
};

export const YOUTH_HOUSES: YouthHouseOption[] = [
  { name: 'Suraxanı Gənclər evi', area: 'Bakı – Suraxanı' },
  { name: 'Xəzər Gənclər evi', area: 'Bakı – Xəzər' },
  { name: 'Sabunçu Gənclər evi', area: 'Bakı – Sabunçu' },
  { name: 'Qaradağ Gənclər evi', area: 'Bakı – Qaradağ' },
  { name: 'Binəqədi Gənclər evi', area: 'Bakı – Binəqədi' },
  { name: 'Tovuz Gənclər evi', area: 'Tovuz' },
  { name: 'Gəncə Gənclər evi', area: 'Gəncə' },
  { name: 'Şirvan Gənclər evi', area: 'Şirvan' },
  { name: 'Sumqayıt Gənclər evi', area: 'Sumqayıt' },
  { name: 'Mingəçevir Gənclər evi', area: 'Mingəçevir' },
  { name: 'Saatlı Gənclər evi', area: 'Saatlı' },
  { name: 'Balakən Gənclər evi', area: 'Balakən' },
  { name: 'Bakı Gənclər evi', area: 'Bakı' },
  { name: 'Masallı Gənclər evi', area: 'Masallı' },
  { name: 'Ucar Gənclər evi', area: 'Ucar' },
  { name: 'Yevlax Gənclər evi', area: 'Yevlax' },
  { name: 'Şəmkir Gənclər evi', area: 'Şəmkir' },
  { name: 'Qazax Gənclər evi', area: 'Qazax' },
  { name: 'Qobustan Gənclər evi', area: 'Qobustan' },
  { name: 'Göyçay Gənclər evi', area: 'Göyçay' },
  { name: 'Göygöl Gənclər evi', area: 'Göygöl' },
  { name: 'Beyləqan Gənclər evi', area: 'Beyləqan' },
  { name: 'Ağstafa Gənclər evi', area: 'Ağstafa' },
  { name: 'Biləsuvar Gənclər evi', area: 'Biləsuvar' },
  { name: 'Zərdab Gənclər evi', area: 'Zərdab' },
  { name: 'Tərtər Gənclər evi', area: 'Tərtər' },
  { name: 'Goranboy Gənclər evi', area: 'Goranboy' },
  { name: 'Siyəzən Gənclər evi', area: 'Siyəzən' },
  { name: 'Astara Gənclər evi', area: 'Astara' },
  { name: 'Quba Gənclər evi', area: 'Quba' },
  { name: 'Füzuli Gənclər evi', area: 'Füzuli' },
  { name: 'Sabirabad Gənclər evi', area: 'Sabirabad' },
  { name: 'Kürdəmir Gənclər evi', area: 'Kürdəmir' },
  { name: 'Lənkəran Gənclər evi', area: 'Lənkəran' },
  { name: 'Pirallahı Gənclər evi', area: 'Bakı – Pirallahı' },
];

/** Şəhər/rayon adları — "Şəhər/Rayon" sahəsi üçün istifadə oluna bilər. */
export const YOUTH_HOUSE_AREAS = Array.from(
  new Set(YOUTH_HOUSES.map(h => h.area)),
).sort((a, b) => a.localeCompare(b, 'az'));
