import { afterEach, describe, expect, it, vi } from 'vitest';

// Modül durumu (perde kalktı mı) her testte sıfırdan başlasın.
const yukle = async () => {
  vi.resetModules();
  return import('@/lib/acilisPerdesi');
};

afterEach(() => {
  vi.useRealTimers();
});

describe('açılış perdesi — bento girişi perdenin altında oynamasın', () => {
  it('perde kalkana kadar bekler, kalkınca bir kez çağırır', async () => {
    vi.useFakeTimers();
    const { perdeKalkti, perdeyiBekle } = await yukle();
    const f = vi.fn();
    perdeyiBekle(f);
    vi.advanceTimersByTime(1000);
    expect(f).not.toHaveBeenCalled();
    perdeKalkti();
    expect(f).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('perde haber vermezse kartlar görünmez KALMAZ: en geç 3,5 sn sonra başlar', async () => {
    vi.useFakeTimers();
    const { perdeyiBekle } = await yukle();
    const f = vi.fn();
    perdeyiBekle(f);
    vi.advanceTimersByTime(3499);
    expect(f).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('perde zaten kalktıysa hemen çağırır', async () => {
    const { perdeKalkti, perdeyiBekle } = await yukle();
    perdeKalkti();
    const f = vi.fn();
    perdeyiBekle(f);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('iptal edilen bekleyen çağrılmaz', async () => {
    vi.useFakeTimers();
    const { perdeKalkti, perdeyiBekle } = await yukle();
    const f = vi.fn();
    const iptal = perdeyiBekle(f);
    iptal();
    perdeKalkti();
    vi.advanceTimersByTime(10_000);
    expect(f).not.toHaveBeenCalled();
  });
});
