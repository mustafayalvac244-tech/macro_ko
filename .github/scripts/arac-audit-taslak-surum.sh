#!/usr/bin/env bash
# Araç Audit APK'sını GitHub'da TASLAK SÜRÜME (draft release) koyar.
#
# NEDEN (28.09.2026): Actions "artifact" eki zip olarak iner (telefonda açmak
# zahmetli) ve geliştirme ortamının ağı artifact deposuna (blob.core.windows.net)
# kapalı. Sürüm eki ise doğrudan .apk iner ve geliştirme ortamından da
# indirilebiliyor — APK sohbete buradan getiriliyor.
#
# TASLAK HERKESE AÇIK DEĞİL: yalnız depoya yazma yetkisi olanlar görür; git
# etiketi (tag) oluşturmaz; "release" olayını dinleyen iş akışı yok
# (28.09.2026'da tüm iş akışlarının tetikleyicilerine bakıldı).
#
# Kullanım: arac-audit-taslak-surum.sh <apk-yolu> <commit-sha>
# Gerekenler: GH_TOKEN (contents: write), GH_REPO (sahip/depo).
set -euo pipefail

apk="$1"
sha="$2"
kisa="${sha:0:7}"
etiket="arac-audit-apk-${kisa}"

# Taslaklar etiket adıyla aranamıyor (releases/tags/… taslak döndürmüyor);
# o yüzden hep listeden ve kimlikle çalışılıyor.
taslak_kimlikleri() {
  gh api "repos/${GH_REPO}/releases?per_page=100" --jq "$1"
}

# Aynı commit'in eski taslağı varsa (yeniden koşu) sil, yoksa ikinci bir
# aynı adlı taslak oluşur.
taslak_kimlikleri ".[] | select(.draft and .tag_name == \"${etiket}\") | .id" \
  | while read -r id; do gh api -X DELETE "repos/${GH_REPO}/releases/${id}"; done

gh release create "$etiket" "$apk" --draft --target "$sha" \
  --title "Araç Audit APK ${kisa}" \
  --notes "Test APK'sı — telefona elle kurulur, Play Store'a yüklenemez (şablonun debug anahtarıyla imzalı). Kaynak commit: ${sha}"

# Taslaklar birikmesin: en yeni 3 Araç Audit taslağı kalır.
taslak_kimlikleri '[.[] | select(.draft and (.tag_name | startswith("arac-audit-apk-")))] | sort_by(.created_at) | reverse | .[3:] | .[].id' \
  | while read -r id; do gh api -X DELETE "repos/${GH_REPO}/releases/${id}"; done

# Sonucu kayda yaz: taslak gerçekten var mı, ekin boyutu ne.
taslak_kimlikleri ".[] | select(.tag_name == \"${etiket}\") | {name, draft, assets: [.assets[] | {name, size}]}"
