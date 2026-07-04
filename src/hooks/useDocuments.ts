import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { DOCUMENTS_BUCKET, supabase } from '@/lib/supabase';
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
  caseId: string;
  category: DocumentCategory;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ file, caseId, category }: UploadDocumentParams) => {
      const bytes = await new File(file.uri).arrayBuffer();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${ownerId}/${caseId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, bytes, { contentType: file.mimeType ?? 'application/octet-stream' });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('documents')
        .insert({
          owner_id: ownerId!,
          case_id: caseId,
          name: file.name,
          category,
          file_path: path,
          file_size: file.size,
          mime_type: file.mimeType,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CaseDocument;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: Pick<CaseDocument, 'id' | 'file_path'>) => {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}
