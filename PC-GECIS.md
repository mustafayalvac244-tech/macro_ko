# Buluttan PC'ye geçiş (29.09.2026)

Bulut oturumu: `session_01WWBXHpFTU6H1aYuB8HtMVD` · dal:
`claude/legal-case-management-app-dipuvb` (her şey push edildi, açıkta iş yok).

Geçmiş kaybolmaz: `CLAUDE.md` → `AGENTS.md` + `DURUM.md` her oturumda
kendiliğinden yüklenir. Sohbetin tamamını da taşımak istersen 4. adım.

## 1. Kurulum (bir kez, Windows)

1. **Git for Windows**: https://git-scm.com/downloads/win (kur, hep "Next").
2. **Node.js 22 LTS**: https://nodejs.org (bulutta v22 ile çalışıldı).
3. **Claude Code** — PowerShell'i aç, yapıştır:

   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```

   Yeni PowerShell penceresi aç, `claude --version` bir sürüm yazmalı.
4. İsteğe bağlı ama önerilir — **GitHub CLI** (`gh`): iş akışlarını
   (derleme, OTA, göç, uç dağıtımı) PC'den tetiklemek için.

   ```powershell
   winget install GitHub.cli
   gh auth login
   ```

## 2. Depoyu indir

```powershell
cd $HOME
git clone https://github.com/mustafayalvac244-tech/macro_ko.git
cd macro_ko
npm install
```

## 3. Giriş

```powershell
claude
```

Tarayıcı açılır → **claude.ai hesabınla** gir (bulut oturumundaki hesabın
aynısı; API anahtarıyla DEĞİL — teleport claude.ai girişi ister).

## 4. Bu sohbeti PC'ye çek (isteğe bağlı)

`macro_ko` klasöründeyken:

```powershell
claude --teleport session_01WWBXHpFTU6H1aYuB8HtMVD
```

Dalı indirir, sohbet geçmişini yükler. Şartlar (resmi belge): aynı hesap,
aynı depo, commit edilmemiş değişiklik yok. Taşınan kopya yereldedir;
bulut oturumuna geri yansımaz.

Teleport istemezsen yeni sohbet de olur — DURUM.md her şeyi taşır. İlk
mesaj olarak şunu yapıştır:

> DURUM.md ve AGENTS.md'yi oku, `git log -10` ile doğrula. Buluttan PC'ye
> geçtim. Acil iş: RevenueCat webhook (DURUM §2 madde 00). Az soru sor.

## 5. Onay sorma meselesi

Depodaki `.claude/settings.json` `defaultMode: bypassPermissions` diyor.
Bulutta YOK SAYILIYORDU; PC'de uygulanır. İlk açılışta bir kez onay
isteyebilir. Mod değiştirmek için **Shift+Tab**.

## 6. Bulutta vardı, PC'de ayrıca bağlanması gerekebilir

| Ne | Bulutta | PC'de |
|---|---|---|
| Supabase (SQL, log) | claude.ai bağlayıcısı | claude.ai hesabıyla girince gelebilir; gelmezse `/mcp` ile ekle |
| GitHub (iş akışı, PR) | GitHub bağlayıcısı | `gh auth login` yeterli |
| Sırlar (Apple, Supabase, EAS) | GitHub Secrets'ta | Aynı yerde — PC'ye sır kopyalanmaz |

Derleme, OTA, göç ve uç dağıtımı zaten GitHub Actions'ta koşuyor
(`ios-dagit.yml`, `ota-yayinla.yml`, `migration-uygula.yml`,
`edge-dagit.yml`); PC yalnız tetikler.
