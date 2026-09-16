#!/usr/bin/env node
/**
 * iOS İMZA KİMLİKLERİNİ APPLE API'SİYLE ÜRET — 16.09.2026.
 *
 * NEDEN VAR. `eas credentials --platform ios` dağıtım sertifikasını üretmek
 * için Apple hesabına İNTERAKTİF giriş ister: Apple ID, şifre ve telefona
 * düşen iki adımlı doğrulama kodu. GitHub Actions bunu yapamaz ve ürün
 * sahibinin de bilgisayarında terminal açması gerekiyordu.
 *
 * ÖLÇÜLDÜ (eas-cli 24.6.0 kaynağı):
 *   build/credentials/ios/actions/SetUpDistributionCertificate.js:41
 *     runNonInteractiveAsync(_ctx, currentCertificate) {
 *       if (!currentCertificate) throw new MissingCredentialsNonInteractiveError();
 *   → EAS, sertifikayı etkileşimsiz modda ÜRETMİYOR; elde yoksa düşüyor.
 *   Provisioning profile'ı ise ASC anahtarıyla üretebiliyor (kaynaktaki
 *   hata metni EXPO_ASC_* değişkenlerini açıkça öneriyor).
 *
 * ÇÖZÜM. Sertifikayı ve profili Apple'ın kendi REST API'siyle biz üretip
 * EAS'ın önüne koyuyoruz. ASC API anahtarı zaten bir kimlik doğrulama
 * yöntemi — şifre ve iki adımlı doğrulama İSTEMİYOR. EAS tarafında
 * `credentialsSource: "local"` verildiğinde EAS kendi kimlik kurulumunu hiç
 * çalıştırmıyor (ölçüldü: build/credentials/credentialsJson/read.js).
 *
 * NE ÜRETİR
 *   <cikti>/dist.p12                  dağıtım sertifikası + özel anahtar
 *   <cikti>/profil.mobileprovision    App Store provisioning profile
 *   <cikti>/credentials.json          EAS'ın okuduğu dosya
 *
 * GEREKEN ORTAM DEĞİŞKENLERİ
 *   ASC_KEY_PATH    .p8 dosyasının yolu
 *   ASC_KEY_ID      anahtarın Key ID'si
 *   ASC_ISSUER_ID   Issuer ID
 *   BUNDLE_ID       örn. com.vekilpro.app
 *   CIKTI           çıktı klasörü (varsayılan: ./ios-imza)
 *   P12_PAROLA      .p12 parolası (verilmezse rastgele üretilir)
 *   ESKIYI_IPTAL    "evet" ise mevcut dağıtım sertifikalarını iptal eder
 *
 * SERTİFİKA SINIRI — BİLEREK OKU. Apple hesap başına en fazla 2 dağıtım
 * sertifikasına izin veriyor. Bu betik her koşuşta YENİ bir tane üretiyor,
 * çünkü özel anahtar koşu bitince kayboluyor ve eskisi bir daha
 * kullanılamıyor. Üçüncü koşuda sınıra çarpmamak için ESKIYI_IPTAL=evet
 * ile eskiler iptal edilir.
 *
 * İPTALİN NE ZAMAN TEHLİKELİ OLDUĞU: App Store'a yüklenen uygulamayı Apple
 * kendi yeniden imzaladığı için yayındaki sürüm etkilenmez. Ama Ad Hoc /
 * Enterprise dağıtımla kurulmuş uygulamalar sertifika iptal edilince açılmaz.
 * Bu depo yalnız App Store dağıtımı yapıyor; başka amaçla elle sertifika
 * ürettiysen ESKIYI_IPTAL'i AÇMA.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const API = 'https://api.appstoreconnect.apple.com/v1';

function gerekli(ad) {
  const v = process.env[ad];
  if (!v) {
    console.error(`HATA: ${ad} ortam değişkeni tanımlı değil.`);
    process.exit(1);
  }
  return v;
}

const KEY_PATH = gerekli('ASC_KEY_PATH');
const KEY_ID = gerekli('ASC_KEY_ID');
const ISSUER_ID = gerekli('ASC_ISSUER_ID');
const BUNDLE_ID = gerekli('BUNDLE_ID');
const CIKTI = path.resolve(process.env.CIKTI || './ios-imza');
const ESKIYI_IPTAL = (process.env.ESKIYI_IPTAL || '').toLowerCase() === 'evet';

// Parola verilmezse üret. 24 bayt rastgele, base64url — .p12 koşu bitince
// siliniyor, parola yalnız o koşu içinde yaşıyor.
const P12_PAROLA = process.env.P12_PAROLA || crypto.randomBytes(24).toString('base64url');

/**
 * ASC API, ES256 imzalı kısa ömürlü bir JWT istiyor.
 *
 * TUZAK: Node'un varsayılan ECDSA imza kodlaması DER'dir, JWT ise ham
 * r||s (IEEE P1363) ister. `dsaEncoding: 'ieee-p1363'` verilmezse Apple
 * her isteği 401 ile reddeder ve hata mesajı sebebi söylemez.
 */
function jwtUret() {
  const anahtar = fs.readFileSync(KEY_PATH, 'utf8');
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const simdi = Math.floor(Date.now() / 1000);
  const govde = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({
    iss: ISSUER_ID,
    iat: simdi,
    // Apple en fazla 20 dakika kabul ediyor; 15 dk hem yeterli hem güvenli.
    exp: simdi + 900,
    aud: 'appstoreconnect-v1',
  })}`;
  const imza = crypto.sign('sha256', Buffer.from(govde), {
    key: anahtar,
    dsaEncoding: 'ieee-p1363',
  });
  return `${govde}.${imza.toString('base64url')}`;
}

let TOKEN = null;
async function api(yol, secenek = {}) {
  TOKEN ??= jwtUret();
  const cevap = await fetch(`${API}${yol}`, {
    ...secenek,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(secenek.headers || {}),
    },
  });
  if (cevap.status === 204) return null;
  const metin = await cevap.text();
  let veri = null;
  try {
    veri = metin ? JSON.parse(metin) : null;
  } catch {
    // Apple bazen HTML döndürüyor (ör. 5xx). Ham metni göstermek, "undefined"
    // demekten çok daha faydalı.
  }
  if (!cevap.ok) {
    const detay = veri?.errors
      ? veri.errors.map((e) => `${e.status} ${e.code}: ${e.title} — ${e.detail}`).join('\n  ')
      : metin.slice(0, 500);
    throw new Error(`Apple API ${cevap.status} ${secenek.method || 'GET'} ${yol}\n  ${detay}`);
  }
  return veri;
}

function kabuk(komut, argumanlar, girdi) {
  return execFileSync(komut, argumanlar, {
    input: girdi,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** base64 DER → PEM (Apple sertifikayı ham DER'in base64'ü olarak veriyor). */
function derPem(base64, etiket) {
  const satirlar = base64.replace(/\s+/g, '').match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${etiket}-----\n${satirlar}\n-----END ${etiket}-----\n`;
}

async function main() {
  fs.mkdirSync(CIKTI, { recursive: true });

  // ── 1. Mevcut sertifikalar ────────────────────────────────────────────
  // Sınıra çarpmadan önce durumu GÖR. Sessizce iptal etmek, kullanıcının
  // elle ürettiği bir sertifikayı habersiz öldürebilir.
  const dagitimTipleri = new Set(['DISTRIBUTION', 'IOS_DISTRIBUTION']);
  const mevcut = (await api('/certificates?limit=200')).data.filter((c) =>
    dagitimTipleri.has(c.attributes.certificateType),
  );

  console.log(`Hesapta ${mevcut.length} dağıtım sertifikası var:`);
  for (const c of mevcut) {
    console.log(
      `  - ${c.attributes.certificateType} · seri ${c.attributes.serialNumber} · ` +
        `bitiş ${c.attributes.expirationDate} · id ${c.id}`,
    );
  }

  if (mevcut.length > 0) {
    if (!ESKIYI_IPTAL) {
      console.error(
        '\nHATA: Zaten dağıtım sertifikası var ama özel anahtarları bizde yok,\n' +
          'yani kullanılamazlar. Apple hesap başına en fazla 2 tanesine izin veriyor.\n' +
          'Devam etmek için ESKIYI_IPTAL=evet ver — yukarıdakiler İPTAL EDİLİR.\n' +
          'Elle ürettiğin bir sertifika varsa ÖNCE onu kontrol et.',
      );
      process.exit(1);
    }
    for (const c of mevcut) {
      await api(`/certificates/${c.id}`, { method: 'DELETE' });
      console.log(`İptal edildi: ${c.attributes.serialNumber}`);
    }
  }

  // ── 2. Özel anahtar + CSR ─────────────────────────────────────────────
  // Özel anahtar BURADA doğuyor ve Apple'a hiç gitmiyor; Apple yalnız CSR'ı
  // görüyor. İmzalamayı mümkün kılan şey bu anahtar, o yüzden .p12'nin
  // içine onunla birlikte paketleniyor.
  const anahtarYolu = path.join(CIKTI, 'ozel.key');
  const csrYolu = path.join(CIKTI, 'istek.csr');
  kabuk('openssl', ['genrsa', '-out', anahtarYolu, '2048']);
  kabuk('openssl', [
    'req', '-new', '-key', anahtarYolu, '-out', csrYolu,
    '-subj', `/CN=${BUNDLE_ID}/O=Vekil Pro/C=TR`,
  ]);
  const csr = fs.readFileSync(csrYolu, 'utf8');

  // ── 3. Sertifikayı Apple'a ürettir ────────────────────────────────────
  // "DISTRIBUTION" = Apple Distribution (iOS+macOS ortak, güncel olan).
  // Eski hesaplarda yalnız IOS_DISTRIBUTION kabul edilebiliyor; ikisini de
  // dene ki hata "hangi enum" tahminine dönüşmesin.
  let sertifika = null;
  let sonHata = null;
  for (const tip of ['DISTRIBUTION', 'IOS_DISTRIBUTION']) {
    try {
      const c = await api('/certificates', {
        method: 'POST',
        body: JSON.stringify({
          data: { type: 'certificates', attributes: { certificateType: tip, csrContent: csr } },
        }),
      });
      sertifika = c.data;
      console.log(`Sertifika üretildi (${tip}): seri ${sertifika.attributes.serialNumber}`);
      break;
    } catch (e) {
      sonHata = e;
      console.log(`  ${tip} kabul edilmedi, sıradaki deneniyor.`);
    }
  }
  if (!sertifika) throw sonHata;

  // ── 4. .p12 paketi ────────────────────────────────────────────────────
  const cerYolu = path.join(CIKTI, 'sertifika.pem');
  fs.writeFileSync(cerYolu, derPem(sertifika.attributes.certificateContent, 'CERTIFICATE'));
  const p12Yolu = path.join(CIKTI, 'dist.p12');

  // OpenSSL 3 varsayılanı AES-256-CBC + SHA256 ile paketliyor; .p12'yi
  // okuyan bazı araçlar (node-forge tabanlı olanlar dâhil) yalnız eski
  // 3DES/SHA1 kalıbını çözebiliyor. Önce eski kalıbı dene, olmazsa
  // varsayılana düş — sessizce okunamayan bir .p12 üretmektense.
  const p12Ortak = [
    'pkcs12', '-export', '-inkey', anahtarYolu, '-in', cerYolu,
    '-out', p12Yolu, '-passout', `pass:${P12_PAROLA}`,
  ];
  try {
    kabuk('openssl', [
      ...p12Ortak,
      '-legacy', '-keypbe', 'PBE-SHA1-3DES', '-certpbe', 'PBE-SHA1-3DES', '-macalg', 'sha1',
    ]);
    console.log('.p12 eski (3DES/SHA1) kalıbıyla paketlendi.');
  } catch {
    kabuk('openssl', p12Ortak);
    console.log('.p12 OpenSSL varsayılanıyla paketlendi (-legacy desteklenmedi).');
  }

  // ── 5. Bundle ID'yi bul ───────────────────────────────────────────────
  const bundle = await api(`/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=200`);
  const kayit = bundle.data.find((b) => b.attributes.identifier === BUNDLE_ID);
  if (!kayit) {
    throw new Error(
      `Apple hesabında ${BUNDLE_ID} kayıtlı değil.\n` +
        'developer.apple.com → Identifiers → App IDs altından kaydedilmeli (YAYIN-SIRASI.md B1).',
    );
  }
  console.log(`Bundle ID bulundu: ${kayit.id}`);

  // ── 6. Provisioning profile ───────────────────────────────────────────
  // Aynı adda profil varsa Apple ikincisini reddediyor; önce temizle.
  const profilAdi = `vekilpro-ci-${Date.now()}`;
  const profiller = await api('/profiles?limit=200');
  for (const p of profiller.data.filter((p) => p.attributes.name.startsWith('vekilpro-ci-'))) {
    await api(`/profiles/${p.id}`, { method: 'DELETE' });
    console.log(`Eski profil silindi: ${p.attributes.name}`);
  }

  const profil = await api('/profiles', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'profiles',
        attributes: { name: profilAdi, profileType: 'IOS_APP_STORE' },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: kayit.id } },
          certificates: { data: [{ type: 'certificates', id: sertifika.id }] },
        },
      },
    }),
  });
  const profilYolu = path.join(CIKTI, 'profil.mobileprovision');
  fs.writeFileSync(profilYolu, Buffer.from(profil.data.attributes.profileContent, 'base64'));
  console.log(`Profil üretildi: ${profilAdi}`);

  // ── 7. credentials.json ───────────────────────────────────────────────
  // Alan adları eas-cli kaynağından doğrulandı:
  // build/credentials/credentialsJson/read.js:53-54
  const credYolu = path.join(CIKTI, 'credentials.json');
  fs.writeFileSync(
    credYolu,
    `${JSON.stringify(
      {
        ios: {
          provisioningProfilePath: path.relative(process.cwd(), profilYolu),
          distributionCertificate: {
            path: path.relative(process.cwd(), p12Yolu),
            password: P12_PAROLA,
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  // Ara dosyaları sil: özel anahtar artık .p12'nin içinde, CSR'ın işi bitti.
  fs.rmSync(anahtarYolu, { force: true });
  fs.rmSync(csrYolu, { force: true });
  fs.rmSync(cerYolu, { force: true });

  console.log(`\nHazır → ${credYolu}`);
  console.log('PAROLA YAZDIRILMADI. credentials.json içinde ve koşu bitince siliniyor.');
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
