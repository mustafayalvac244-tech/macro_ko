import { YalnizWeb } from './YalnizWeb';
import { useT } from '@/i18n';

/**
 * Yazisma'nun NATIVE SÜRÜMÜ — bilerek işlevsiz.
 *
 * Metro platform uzantısıyla çözüyor: web'de `Yazisma.web.tsx`, Android/iOS'ta
 * bu dosya. Yani panonun ve yazışmanın gerçek kodu native pakete HİÇ
 * girmiyor — menüden gizlemek değil, gerçekten bulunmamak. Gerekçe ve Play
 * içerik anketi bağlantısı için bkz. YalnizWeb.tsx.
 */
export default function YazismaNative() {
  const t = useT();
  return <YalnizWeb baslik={t('chat.title')} />;
}
