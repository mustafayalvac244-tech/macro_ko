import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { DOCUMENTS_BUCKET, MAX_DOSYA_BAYT, supabase } from '@/lib/supabase';
import { dosyaBuyukKodu } from '@/utils/hataKodu';
import { notifySaveError } from '@/lib/saveError';
import { useAuthStore } from '@/store/authStore';
import type { CaseDocument, DocumentCategory, DocumentWithCase } from '@/types/database';

const DOCUMENT_SELECT = '*, case:cases(id, title, case_number)';

export function useDocuments(caseId?: string) {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['documents', ownerId, caseId ?? 'all'],
    enabled: !!ownerId,
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select(DOCUMENT_SELECT)
        .eq('owner_id', ownerId!)
        .order('uploaded_at', { ascending: false });

      if (caseId) query = query.eq('case_id', caseId);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as DocumentWithCase[];
    },
  });
}

export function useSignedDocumentUrl() {
  return useMutation({
    onError: notifySaveError,
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 60 * 5);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string | null;
}

export async function pickDocumentFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0]!;
  return { uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? null };
}

export async function pickImageFile(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0]!;
  const name = asset.fileName ?? asset.uri.split('/').pop() ?? `photo-${Date.now()}.jpg`;
  return { uri: asset.uri, name, size: asset.fileSize ?? 0, mimeType: asset.mimeType ?? 'image/jpeg' };
}

export async function takePhotoFile(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0]!;
  const name = asset.fileName ?? asset.uri.split('/').pop() ?? `photo-${Date.now()}.jpg`;
  return { uri: asset.uri, name, size: asset.fileSize ?? 0, mimeType: asset.mimeType ?? 'image/jpeg' };
}

interface UploadDocumentParams {
  file: PickedFile;
  caseId: string | null;
  clientId?: string | null;
  category: DocumentCategory;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async ({ file, caseId, clientId, category }: UploadDocumentParams) => {
      /**
       * BOYUT ÖNCE KONTROL EDİLİR — dosyayı belleğe okumadan.
       *
       * Kovanın sınırı 25 MB (migration 0085) ama istemcide hiç kontrol yoktu:
       * 40 MB'lık taranmış bir dosya önce TAMAMEN belleğe okunuyor (büyük
       * dosyada uygulamayı düşürebilir), sonra dakikalarca yükleniyor, en
       * sonunda sunucu reddedince kullanıcı "kaydedilemedi" gibi hiçbir şey
       * anlatmayan bir hata görüyordu. Mesaj biçimi 'dosya_buyuk:<mb>' —
       * plan limitindeki ile aynı makine-okunur desen (bkz. saveError.ts).
       *
       * file.size 0 gelebiliyor (seçicinin bildirmediği durumlar). O zaman
       * kontrol atlanır ve son sözü sunucu söyler; uydurma bir sayıyla
       * kullanıcıyı engellemek yanlış olurdu.
       */
      if (file.size > 0 && file.size > MAX_DOSYA_BAYT) {
        throw new Error(dosyaBuyukKodu(Math.floor(MAX_DOSYA_BAYT / (1024 * 1024))));
      }

      const bytes = await new File(file.uri).arrayBuffer();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${ownerId}/${caseId ?? 'general'}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, bytes, { contentType: file.mimeType ?? 'application/octet-stream' });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('documents')
        .insert({
          owner_id: ownerId!,
          case_id: caseId,
          ...(clientId ? { client_id: clientId } : {}),
          name: file.name,
          category,
          file_path: path,
          file_size: file.size,
          mime_type: file.mimeType,
        })
        .select()
        .single();

      /**
       * SATIR YAZILAMAZSA YÜKLENEN DOSYA GERİ ALINIR.
       *
       * BULUNAN KUSUR — ve bu kusuru plan limitleri göçü (0087) yarattı.
       * Dosya önce depoya yükleniyor, sonra satır ekleniyor. Ücretsiz plandaki
       * bir avukat 5 belge sınırına dayandığında 6. yüklemede depo çağrısı
       * BAŞARIYLA tamamlanıyor, ardından tetikleyici satırı reddediyor. Sonuç:
       * kullanıcı doğru uyarıyı görüyor ("belge hakkınız doldu") ama dosya
       * depoda kalıyor — satırı olmadığı için uygulamadan ulaşılamaz, silinemez
       * ve kullanıcının depolama kotasını yiyor. Her limit denemesinde bir öksüz
       * daha birikiyordu.
       *
       * Aynı şey RLS hatası, ağ kopması ya da eksik sütun hatasında da geçerli.
       * Telafi silmesi başarısız olursa hata yine de kullanıcıya iletilir —
       * asıl hatayı öksüz dosya yüzünden yutmak daha kötü olurdu.
       */
      if (error) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => {});
        throw error;
      }
      return data as CaseDocument;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (doc: Pick<CaseDocument, 'id' | 'file_path'>) => {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}
