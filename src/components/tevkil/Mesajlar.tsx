import { YalnizWeb } from './YalnizWeb';
import { useT } from '@/i18n';

/**
 * Mesajlar'nun NATIVE SÜRÜMÜ — bilerek işlevsiz.
 *
 * Metro platform uzantısıyla çözüyor: web'de `Mesajlar.web.tsx`, Android/iOS'ta
 * bu dosya. Yani panonun ve yazışmanın gerçek kodu native pakete HİÇ
 * girmiyor — menüden gizlemek değil, gerçekten bulunmamak. Gerekçe ve Play
 * içerik anketi bağlantısı için bkz. YalnizWeb.tsx.
 */
export default function MesajlarNative() {
  const t = useT();
  return <YalnizWeb baslik={t('chat.title')} />;
}
