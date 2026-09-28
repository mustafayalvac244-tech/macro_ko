import { describe, expect, it } from 'vitest';

import { excelUret, htmlRapor } from '../arac-audit-app/src/cekirdek/rapor';
import { Denetim, Hata } from '../arac-audit-app/src/cekirdek/tipler';

// Ekip liderinin kullanılabilirlik sınaması (28.09.2026):
//  - yarım ve bitmiş denetimin Excel'i hücre hücre aynıydı (durum yoktu);
//  - İngilizce dosyanın Summary sayfası Türkçe kalıyordu, parçalarda taraf yoktu;
//  - fitToWidth="1" yazılıydı ama fitToPage bayrağı olmadığı için işlemezdi.

const hata = (id: string, parcaId: string): Hata => ({
  id, parcaId, hataTipiId: 'cizik', derece: '2', kabulEdilebilir: false, sorunTipi: 'Part', sorumlu: '',
  adet: 1, konum: '', aciklama: '', zaman: `2026-09-28T08:3${id.length}:00`, fotograflar: [], durum: 'acik',
});

const denetim = (o: Partial<Denetim>): Denetim => ({
  id: 'd', aracId: 'i20', vin: 'NLHB51ABPDH1234S6', plaka: '', raporNo: 'R-1', denetci: 'Denetçi A', hat: '', vardiya: '',
  denetimTipi: 'HMC Audit', faz: 'LP2', ekip: 'QE Team 2', spec: '', km: null,
  baslangic: '2026-09-28T08:30:00', bitis: null, durum: 'devam',
  hatalar: [hata('h1', 'sol_on_kapi'), hata('h22', 'kaput')], ...o,
});

// XLSX sıkıştırmasız ("store") ZIP; XML metni baytların içinde düz durur.
const excelMetni = (d: Denetim) => new TextDecoder('utf-8').decode(excelUret(d, new Map(), { dil: 'en' }));

describe('rapor — durum', () => {
  it('devam eden denetim "In progress" yazar', () => {
    const x = excelMetni(denetim({}));
    expect(x).toContain('Status');
    expect(x).toContain('In progress');
    expect(x).not.toContain('Completed');
  });

  it('bitmiş denetim "Completed" ve bitiş zamanını yazar', () => {
    const x = excelMetni(denetim({ durum: 'tamam', bitis: '2026-09-28T09:40:00' }));
    expect(x).toContain('Completed 28.09.2026 09:40');
    expect(htmlRapor(denetim({ durum: 'tamam', bitis: '2026-09-28T09:40:00' }), new Map(), { dil: 'en' }))
      .toContain('Completed 28.09.2026 09:40');
  });
});

describe('rapor — İngilizce özet ve yazdırma', () => {
  it('Summary sayfası İngilizce ve parça tarafıyla', () => {
    const x = excelMetni(denetim({}));
    expect(x).toContain('LH front door');
    expect(x).toContain('Exterior · LH side');
    expect(x).not.toContain('Dış · Sol yan');
  });

  it('tek sayfa genişliği gerçekten açık, başlık satırı her sayfada', () => {
    const x = excelMetni(denetim({}));
    expect(x).toContain('<pageSetUpPr fitToPage="1"/>');
    expect(x).toContain('_xlnm.Print_Titles');
  });
});
