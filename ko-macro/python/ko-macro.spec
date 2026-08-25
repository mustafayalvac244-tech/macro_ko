# PyInstaller yapılandırması — tek dosyalık ko-macro.exe üretir.
#
# Derlemek için:  pyinstaller ko-macro.spec --noconfirm
# (ya da kolayı: derle.bat)
#
# Not: PyInstaller çapraz derleme yapmaz. Windows exe'si Windows'ta
# derlenmek zorunda. Bilgisayarında Windows yoksa .github/workflows/
# build-exe.yml GitHub'ın Windows makinesinde derler.

block_cipher = None

# Profiller ve örnek config exe'nin içine gömülür; program çalışırken
# ko_macro/paths.py bunları sys._MEIPASS altında bulur.
datas = [
    ("profiles", "profiles"),
    ("config.example.yaml", "."),
]

# PyInstaller'ın statik analizle bulamadığı, çalışma anında import edilen
# paketler. Kurulu değillerse zaten atlanır (aşağıdaki filtreye bak).
optional_imports = [
    "serial",
    "serial.tools.list_ports",
    "yaml",
    "rich",
    "mss",
    "keyboard",
    "pydirectinput",
]


def _installed(names):
    """Sadece gerçekten kurulu olanları hiddenimports'a koy."""
    import importlib.util

    found = []
    for name in names:
        try:
            if importlib.util.find_spec(name) is not None:
                found.append(name)
        except (ImportError, ValueError):
            continue
    return found


a = Analysis(
    # ko_macro/__main__.py göreli import kullandığı için giriş noktası olamaz;
    # main.py mutlak import yapan ince bir sarmalayıcı.
    ["main.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=_installed(optional_imports),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "PIL", "pytest"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="ko-macro",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,          # konsol arayüzü — pano burada çiziliyor
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
