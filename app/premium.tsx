import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import { MONTHLY_PRICE_TRY, AI_PRICE_TRY, AI_SORU_HAKKI, AI_MUTALAA_HAKKI, DENEME_SORU_HAKKI } from '@/hooks/useTrialStatus';
import { UCRETSIZ_LIMIT } from '@/config/planlar';
import { useAiSaglik } from '@/hooks/useAiSaglik';
import {
  AI_ENTITLEMENT_ID,
  buyPackage,
  getCurrentOffering,
  getOffering,
  restorePurchases,
} from '@/lib/purchases';
import {
  AI_BELGE_ENABLED,
  AI_DILEKCE_ENABLED,
  AI_ENABLED,
  AI_MUTALAA_ENABLED,
} from '@/config/features';
import { useT } from '@/i18n';
import { fonts, radius, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * Üyelik ekranı — ÜÇ katman: Ücretsiz → Vekil Pro (399 ₺) → + Yapay Zekâ (1.999 ₺).
 *
 * ÜRÜN KARARI: içtihat araması ÜCRETSİZDİR ve öyle kalacaktır; ücret, büro
 * yönetimini büyütmek (sınırsız dava/müvekkil/belge, finans, yedekleme) ya da
 * yapay zekâyı kullanmak isteyenden alınır. Ücretsiz katman ekranda AÇIKÇA
 * gösterilir: önceden yalnız iki ücretli kart vardı ve kullanıcı neyi bedava
 * aldığını da, 399 ₺'nin neyi açtığını da göremiyordu.
 *
 * "Aboneliğe Geç" artık RevenueCat üzerinden GERÇEK satın alma başlatır
 * (bkz. src/lib/purchases.ts). RevenueCat henüz kurulmadıysa (API anahtarı
 * yok) ya da web'deyse teklif hiç yüklenmez ve buton eskisi gibi "çok
 * yakında" der — sahte ödeme YOK, ücretsiz premium da VERİLMEZ. Satın alma
 * başarılı olsa bile son söz sunucudadır: gerçek premium durumu, RevenueCat'in
 * gönderdiği webhook profiles.is_premium'u güncelleyince açılır (bkz.
 * supabase/functions/revenuecat-webhook) — bu yüzden başarılı satın almadan
 * sonra profil kısa süre sonra yeniden okunur.
 *
 * DENEME SÜRESİ YOKTUR. Bu ekranda "7 GÜN ÜCRETSİZ" rozeti, geri sayım ve
 * "deneme bitmeden iptal ederseniz ücret alınmaz" ince yazısı vardı; hiçbiri
 * gerçek değildi (bkz. useTrialStatus'taki açıklama: sunucudaki limit
 * tetikleyicisinde deneme diye bir kavram yok, App Store'da da tanımlı bir
 * tanıtım teklifi yok). Yerine gerçek şart yazıyor: ücretsiz katman kalıcı,
 * abonelik aylık ve otomatik yenileniyor.
 */
export default function PremiumScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  /**
   * ABONELİK DURUMU ARTIK PROFİLDEN OKUNUYOR — purchases tablosundan DEĞİL.
   *
   * BULUNAN HATA. Burada `purchases` tablosunda BİR SATIR VARSA kullanıcı
   * "abone" sayılıyordu. Ama purchases bir GEÇMİŞ kaydıdır: revenuecat_olay_isle
   * her olayda oraya YENİ SATIR EKLER ve hiçbir zaman silmez. Yetkiyi taşıyan
   * alan profiles.is_premium / profiles.ai_tier'dır ve süre dolunca webhook
   * onları geri alır (`is_premium = (p_expires_at > now())`).
   *
   * Sonuç: aboneliği biten kullanıcı ekranda SONSUZA KADAR "Aboneliğiniz
   * aktif" görüyordu. Üstelik satın alma düğmesi gizlendiği için YENİDEN ABONE
   * OLAMIYORDU — doğrudan gelir kaybı. Sunucu ise onu ücretsiz katman sayıp
   * "5 dava hakkınız doldu" diyordu; kullanıcı "ben abonelim" diye destek
   * yazardı.
   *
   * Artık tek kaynak sunucudur. Satın almadan sonraki gecikmeyi profilYenidenOku
   * zaten kapatıyor (webhook birkaç saniye sürebilir).
   */
  const profile = useAuthStore((s) => s.profile);
  const isPremium = !!profile?.is_premium;
  const isAiActive = profile?.ai_tier === 'ai';
  const [offeringPkg, setOfferingPkg] = useState<PurchasesPackage | null>(null);
  const [aiOfferingPkg, setAiOfferingPkg] = useState<PurchasesPackage | null>(null);
  const [busyPlan, setBusyPlan] = useState<'temel' | 'ai' | 'restore' | null>(null);


  // RevenueCat henüz kurulmadıysa (API anahtarı yok) ya da web'deyse null
  // döner — bu durumda alttaki onSubscribe eski "çok yakında" davranışına
  // düşer, hiçbir şey kırılmaz. "ai" katmanı AYRI bir Offering'den okunur
  // (bkz. IAP_KURULUM.md — RevenueCat panelinde "ai" adıyla kurulmalı).
  useEffect(() => {
    getCurrentOffering().then((offering) => setOfferingPkg(offering?.monthly ?? offering?.availablePackages[0] ?? null));
    getOffering(AI_ENTITLEMENT_ID).then((offering) => setAiOfferingPkg(offering?.monthly ?? offering?.availablePackages[0] ?? null));
  }, []);

  const subscribed = isPremium;

  /**
   * AI PAKETİ, ARKA UÇ HİZMET VEREMEZKEN SATILMAMALI.
   *
   * Ölçülen durum: ücretli hat Claude'a KİLİTLİ ve ANTHROPIC_API_KEY yoksa uç
   * 503 'not_configured' döner (index.ts'teki genKey kontrolü) — sessizce ucuz
   * modele düşmez, ki bu doğrusudur. Ama sonucu şu: anahtar tanımlı değilken
   * 1.999 ₺'lik paketi satın alan kullanıcının HER AI isteği hata alır.
   *
   * Bugün canlı bir risk yok çünkü RevenueCat hiç kurulmadı ve teklif null
   * geliyor. Kurulduğu gün bu kapı kendiliğinden açılırdı; kilidi şimdi
   * koyuyoruz. Yalnız "kesin biliyoruz ki çalışmıyor" (false) durumunda
   * engellenir — sağlık yoklaması ağ hatasıyla dönerse (undefined) satın alma
   * engellenmez, aksi hâlde geçici bir kesinti satışı durdururdu.
   */
  const saglik = useAiSaglik(!isAiActive);
  const aiHizmetKapali = saglik.data?.ucretliAyakta === false;

  /**
   * Sunucu (webhook) profiles.is_premium'u işleyene kadar birkaç saniye
   * sürebilir — satın alma başarılı olduktan hemen sonra tek seferlik profil
   * okumak genelde eskiyi görür. Birkaç kez, artan aralıklarla tekrar dener.
   */
  const profilYenidenOku = () => {
    let deneme = 0;
    const dene = () => {
      refreshProfile().catch(() => {});
      deneme++;
      if (deneme < 4) setTimeout(dene, deneme * 2000);
    };
    dene();
  };

  const onSubscribe = async (plan: 'temel' | 'ai') => {
    AsyncStorage.setItem('vekil-plan-intent', plan).catch(() => {});
    // AI paketi: arka uç hizmet veremiyorsa satın almayı hiç başlatma.
    if (plan === 'ai' && aiHizmetKapali) {
      Alert.alert(t('premium.aiUnavailableTitle'), t('premium.aiUnavailableBody'));
      return;
    }
    const pkg = plan === 'ai' ? aiOfferingPkg : offeringPkg;
    // Bu katmanın Offering'i RevenueCat panelinde henüz kurulmadıysa (ya da
    // web'deyse) pkg null gelir — eski "çok yakında" davranışına düşülür,
    // hiçbir şey kırılmaz.
    if (Platform.OS === 'web' || !pkg) {
      Alert.alert(
        t('premium.soonTitle'),
        t('premium.soonBody', { plan: plan === 'ai' ? t('premium.aiName') : t('premium.oneName') })
      );
      return;
    }
    setBusyPlan(plan);
    try {
      const sonuc = await buyPackage(pkg);
      if (sonuc.kind === 'success') {
        // Yetkiyi RevenueCat'in yanıtından DEĞİL, profilden okuruz: son söz
        // sunucudadır. Webhook birkaç saniye sürebildiği için profil birkaç kez
        // yeniden okunur.
        profilYenidenOku();
        Alert.alert(t('premium.purchaseSuccessTitle'), t('premium.purchaseSuccessBody'));
      } else if (sonuc.kind === 'error') {
        Alert.alert(t('premium.purchaseFailedTitle'), sonuc.message);
      }
      // 'cancelled' ve 'unavailable' sessizce geçilir — kullanıcı zaten
      // vazgeçmiş ya da hiç teklif sunulmamıştır.
    } finally {
      setBusyPlan(null);
    }
  };

  const onRestore = async () => {
    setBusyPlan('restore');
    try {
      const sonuc = await restorePurchases();
      if (sonuc.kind === 'success') {
        // Yetkiyi RevenueCat'in yanıtından DEĞİL, profilden okuruz: son söz
        // sunucudadır. Webhook birkaç saniye sürebildiği için profil birkaç kez
        // yeniden okunur.
        profilYenidenOku();
        Alert.alert(t('premium.restoreDoneTitle'), t('premium.restoreDoneBody'));
      } else if (sonuc.kind === 'error') {
        Alert.alert(t('premium.purchaseFailedTitle'), sonuc.message);
      } else {
        Alert.alert(t('premium.restoreDoneTitle'), t('premium.restoreNoneBody'));
      }
    } finally {
      setBusyPlan(null);
    }
  };

  /**
   * AI paketinin özellik listesi BAYRAKLARDAN türetilir.
   *
   * BULUNAN KUSUR (mağaza incelemesi ve tüketici hukuku açısından ciddi): liste
   * sabit yazılmıştı ve kapalı özellikleri satıyordu. Kart "12 hukuki mütalaa
   * dahil" ve "Mütalaa: derin inceleme" diyordu ama AI_MUTALAA_ENABLED=false;
   * "Vekil AI asistanı" ve "İçtihat araması ve karar özetleme" diyordu ama
   * AI_ENABLED=false. Yani abonelik satın alan kullanıcı, parasını ödediği
   * ekranlarda "Çok Yakında" görecekti. Apple/Google incelemesi bunu doğrudan
   * reddeder; Türkiye'de de ayıplı hizmet sayılır.
   *
   * Artık bir özellik ancak AÇIKSA reklam edilir. Bayrak açıldığında satır
   * kendiliğinden geri gelir — listeyi elle güncellemeyi unutmak imkânsız.
   */
  const aiFeatures = [
    // Kota satırı yalnız gerçekten kullanılabilen hakları sayar.
    AI_MUTALAA_ENABLED
      ? t('premium.f.aiQuota', { soru: String(AI_SORU_HAKKI), mutalaa: String(AI_MUTALAA_HAKKI) })
      : t('premium.f.aiQuotaSoruOnly', { soru: String(AI_SORU_HAKKI) }),
    AI_ENABLED ? t('premium.f.aiAssistant') : null,
    AI_MUTALAA_ENABLED ? t('premium.f.aiMutalaa') : null,
    AI_DILEKCE_ENABLED ? t('premium.f.aiDilekce') : null,
    AI_BELGE_ENABLED ? t('premium.f.aiDocReview') : null,
    AI_ENABLED ? t('premium.f.aiIctihat') : null,
    t('premium.f.aiGrounded'),
  ].filter((f): f is string => f !== null);

  /**
   * ÜCRETSİZ KATMAN ARTIK EKRANDA GÖRÜNÜYOR.
   *
   * Eskiden ekran yalnız iki ücretli kart gösteriyordu ve ücretsiz katmandan
   * hiç söz etmiyordu — oysa uygulamanın büyük kısmı ücretsiz. Bunu saklamak
   * iki yönden yanlıştı: kullanıcı neyi bedava aldığını bilmiyordu, ve 399 ₺'lik
   * planın karşılığı da anlaşılmıyordu ("zaten her şey açık, ne için ödüyorum?").
   * Farkı göstermenin yolu, ücretsiz sütunu dürüstçe yazmaktır.
   */
  const freeFeatures = [
    t('premium.f.freeIctihat'),
    t('premium.f.freeMevzuat'),
    t('premium.f.freeAjanda'),
    t('premium.f.freeLimits', {
      dava: String(UCRETSIZ_LIMIT.dava),
      muvekkil: String(UCRETSIZ_LIMIT.muvekkil),
      belge: String(UCRETSIZ_LIMIT.belge),
    }),
    t('premium.f.freeDeneme', { n: String(DENEME_SORU_HAKKI) }),
  ];

  const features = [
    // NE SATILDIĞI ÖLÇÜLDÜ, LİSTE ONA GÖRE KISALDI. Burada beş madde vardı;
    // ikisi (akıllı hatırlatmalar, şablon/hesaplayıcılar) ÜCRETSİZ katmanda da
    // sınırsız açık — Pro'nun getirdiği şeymiş gibi listelenmeleri 399 ₺'nin
    // karşılığını şişiriyordu. Biri ("Otomatik güvenli yedekleme") ise HİÇ
    // YOKTU: uygulamada tek satır kodu bulunmuyor ve Supabase projesi Free
    // planda olduğu için yönetilen günlük yedek/PITR de yok (bkz. YEDEKLEME.md).
    // Var olmayan bir özelliği ücretli pakete yazmak, parası alınan bir vaat.
    // Geriye is_premium'un GERÇEKTEN açtığı iki şey kaldı (migration 0087):
    // satır sınırlarının kalkması ve finans modülü.
    t('premium.f.freeAll'),
    t('premium.f.allCases'),
    t('premium.f.financeFull'),
    // TEMEL PAKETTE AI YOKTUR. Buradaki eski satır "Yapay zekâ özellikleri —
    // çok yakında üyeliğe dahil" diyordu; bu, 399 ₺'lik temel aboneliği alan
    // kullanıcıya AI'ın da geleceğini VAAT ediyordu. Oysa AI ayrı ve 1.999 ₺'lik
    // bir pakettir. Yanlış beklenti yaratan bir satırı satış ekranında tutmak,
    // sonradan "ben AI için ödedim" itirazını doğurur.
    t('premium.f.aiSeparate'),
  ];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('premium.plansTitle')} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t('premium.leadFreeFirst')}</Text>

        {/* İÇTİHAT ÜCRETSİZ — en üstte ve vurgulu. Ürünün en güçlü tarafı bu ve
            para istemiyoruz; satış ekranının ilk söylediği şey bu olmalı. */}
        <View style={styles.freeBanner}>
          <Ionicons name="library-outline" size={18} color={colors.success} />
          <Text style={styles.freeBannerText}>{t('premium.ictihatFreeNote')}</Text>
        </View>

        {subscribed && (
          <View style={styles.activeChip}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.activeChipText}>{t('premium.activeBadge')}</Text>
          </View>
        )}

        {/* ───────── ÜCRETSİZ ───────── */}
        <View style={styles.freeCard}>
          <Text style={styles.tierName}>{t('premium.freeName')}</Text>
          <Text style={styles.tierTag}>{t('premium.freeTag')}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.freePrice}>{t('premium.freePrice')}</Text>
          </View>
          <View style={styles.features}>
            {freeFeatures.map((f) => (
              <View key={f} style={styles.featRow}>
                <Ionicons name="checkmark" size={16} color={colors.success} style={styles.featCheck} />
                <Text style={styles.featText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.badge}>
            <Ionicons name="star" size={11} color={onGold(colors.gold)} />
            <Text style={[styles.badgeText, { color: onGold(colors.gold) }]}>{t('premium.proBadge')}</Text>
          </View>

          <Text style={styles.tierName}>{t('premium.oneName')}</Text>
          <Text style={styles.tierTag}>{t('premium.oneTag')}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₺{MONTHLY_PRICE_TRY}</Text>
            <Text style={styles.per}>{t('premium.perMonth')}</Text>
          </View>

          <View style={styles.features}>
            {features.map((f) => (
              <View key={f} style={styles.featRow}>
                <Ionicons name="checkmark" size={16} color={colors.success} style={styles.featCheck} />
                <Text style={styles.featText}>{f}</Text>
              </View>
            ))}
          </View>

          {!subscribed && (
            <Pressable
              onPress={() => onSubscribe('temel')}
              disabled={busyPlan !== null}
              style={({ pressed }) => [
                styles.cta,
                styles.ctaHi,
                (pressed || busyPlan !== null) && { opacity: 0.85 },
              ]}
            >
              {busyPlan === 'temel' ? (
                <ActivityIndicator color={onGold(colors.gold)} />
              ) : (
                <Text style={[styles.ctaText, { color: onGold(colors.gold) }]}>{t('premium.subscribeCta')}</Text>
              )}
            </Pressable>
          )}

          {!subscribed && (
            <Text style={styles.finePrint}>{t('premium.autoRenewNote', { price: String(MONTHLY_PRICE_TRY) })}</Text>
          )}
        </View>

        {/* ───────── AI katmanı ───────── */}
        <View style={styles.aiCard}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
            <Text style={styles.aiBadgeText}>{t('premium.aiBadge')}</Text>
          </View>

          <Text style={styles.tierName}>{t('premium.aiName')}</Text>
          <Text style={styles.tierTag}>{t('premium.aiTag')}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₺{AI_PRICE_TRY.toLocaleString('tr-TR')}</Text>
            <Text style={styles.per}>{t('premium.perMonth')}</Text>
          </View>

          <View style={styles.includesRow}>
            <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
            <Text style={styles.includesText}>{t('premium.includes', { plan: t('premium.oneName') })}</Text>
          </View>

          {isAiActive && (
            <View style={styles.activeChip}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <Text style={styles.activeChipText}>{t('premium.activeBadge')}</Text>
            </View>
          )}

          <View style={styles.features}>
            {aiFeatures.map((f) => (
              <View key={f} style={styles.featRow}>
                <Ionicons name="checkmark" size={16} color={colors.success} style={styles.featCheck} />
                <Text style={styles.featText}>{f}</Text>
              </View>
            ))}
          </View>

          {!isAiActive && (
            <Pressable
              onPress={() => onSubscribe('ai')}
              disabled={busyPlan !== null}
              style={({ pressed }) => [
                styles.cta,
                styles.ctaAi,
                (pressed || busyPlan !== null) && { opacity: 0.85 },
              ]}
            >
              {busyPlan === 'ai' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>{t('premium.aiCta')}</Text>
              )}
            </Pressable>
          )}

          {/* Apple, otomatik yenilenen abonelikte satın alma ANINDA görünen bir
              yenileme/iptal açıklaması ister (App Store Review 3.1.2). Temel
              paketin karşılığı trialFinePrint; AI katmanında denemesi olmadığı
              için ayrı bir ibare gerekiyordu ve YOKTU. */}
          <Text style={styles.finePrint}>{t('premium.autoRenewNote', { price: AI_PRICE_TRY.toLocaleString('tr-TR') })}</Text>
        </View>

        <View style={styles.noteRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
          <Text style={styles.noteText}>{t('premium.storeNote')}</Text>
        </View>

        {/* Apple, abonelik satan uygulamada Kullanım Koşulları (EULA) ve
            Gizlilik Politikası bağlantılarının UYGULAMA İÇİNDE bulunmasını
            zorunlu tutar. Gizlilik vardı, Kullanım Koşulları hiç yoktu. */}
        <View style={styles.legalRow}>
          <Text style={styles.legalLink} onPress={() => router.push('/terms' as Parameters<typeof router.push>[0])}>
            {t('legal.termsTitle')}
          </Text>
          <Text style={styles.legalSep}>·</Text>
          <Text style={styles.legalLink} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
            {t('settings.privacy')}
          </Text>
        </View>

        {/* Apple/Google incelemesi bunu ZORUNLU tutar: daha önce satın alınmış
            bir aboneliği (ör. cihaz değişimi sonrası) yeniden bağlama yolu. */}
        <Pressable onPress={onRestore} disabled={busyPlan !== null} style={styles.restoreRow} hitSlop={8}>
          {busyPlan === 'restore' ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={styles.restoreText}>{t('premium.restoreCta')}</Text>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

/** Altın zemin üzerindeki yazı: parlak altında koyu, koyu altında beyaz. */
function onGold(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#14213D' : '#FFFFFF';
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  lead: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeChipText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.success,
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.gold,
    ...shadow.card,
  },
  badge: {
    position: 'absolute',
    top: -11,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tierName: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  tierTag: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: spacing.md,
  },
  price: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 34,
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  per: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  features: {
    gap: 10,
    marginTop: spacing.lg,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featCheck: {
    marginTop: 1,
  },
  featText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    flex: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  ctaHi: {
    backgroundColor: colors.gold,
  },
  ctaAi: {
    backgroundColor: colors.primary,
  },
  aiCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadow.card,
  },
  aiBadge: {
    position: 'absolute',
    top: -11,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // Soluk primarySoft, açık gri sayfa zemininde yeterince kontrast
    // vermiyordu — kartın sınırına "oturmuş" değil havada asılı/kaymış
    // görünüyordu (konumu altın rozetle birebir aynı, sorun kontrasttı).
    // Dolgun renk, alttaki "AI Katmanına Geç" butonuyla (ctaAi) aynı ilke.
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  aiBadgeText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  includesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  includesText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.primary,
    flexShrink: 1,
  },
  ctaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  finePrint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  freeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  freeBannerText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  freeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  freePrice: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.textSecondary,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  legalLink: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  legalSep: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  noteText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    flexShrink: 1,
  },
  restoreRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: 32,
  },
  restoreText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 13,
    color: colors.primary,
  },
});
