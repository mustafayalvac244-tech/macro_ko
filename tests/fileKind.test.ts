import { describe, expect, it } from 'vitest';
import { categoryMismatch, detectFileKind } from '@/utils/fileKind';

describe('detectFileKind', () => {
  it('MIME türünden tanır', () => {
    expect(detectFileKind('image/jpeg', 'x')).toBe('image');
    expect(detectFileKind('application/pdf', 'x')).toBe('pdf');
    expect(detectFileKind('application/msword', 'x')).toBe('word');
  });

  it('MIME yoksa dosya adından tanır', () => {
    expect(detectFileKind(null, 'vekaletname.PDF')).toBe('pdf');
    expect(detectFileKind(null, 'dilekce.docx')).toBe('word');
    expect(detectFileKind(null, 'kimlik.HEIC')).toBe('image');
  });

  it('tanımadığını "other" sayar', () => {
    expect(detectFileKind(null, 'notlar.txt')).toBe('other');
    expect(detectFileKind('', '')).toBe('other');
  });
});

describe('categoryMismatch', () => {
  it('fotoğraf beklenen kategoriye belge yüklenirse uyarır', () => {
    expect(categoryMismatch('identification', 'pdf')).toEqual({ expected: 'photo' });
    expect(categoryMismatch('client_photo', 'word')).toEqual({ expected: 'photo' });
  });

  it('belge beklenen kategoriye fotoğraf yüklenirse uyarır', () => {
    expect(categoryMismatch('pleading', 'image')).toEqual({ expected: 'document' });
    expect(categoryMismatch('court_order', 'image')).toEqual({ expected: 'document' });
  });

  it('uyumlu yüklemede uyarmaz', () => {
    expect(categoryMismatch('identification', 'image')).toBeNull();
    expect(categoryMismatch('pleading', 'pdf')).toBeNull();
    expect(categoryMismatch('contract', 'word')).toBeNull();
  });

  it('serbest kategorilerde hiç uyarmaz', () => {
    // Delil, fatura, yazışma her türlü dosya olabilir.
    expect(categoryMismatch('evidence', 'image')).toBeNull();
    expect(categoryMismatch('evidence', 'pdf')).toBeNull();
  });
});
