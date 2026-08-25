"""PyInstaller giriş noktası.

``ko_macro/__main__.py`` göreli import kullanıyor (``from .cli import main``);
PyInstaller giriş betiğini paketin parçası olarak değil, tek başına bir modül
olarak çalıştırdığı için o import kırılıyor. Bu dosya mutlak import yapar ve
exe'nin giriş noktası olur.

Kaynak koddan çalıştırırken ``python -m ko_macro`` da çalışmaya devam eder.
"""

import sys

from ko_macro.cli import main

if __name__ == "__main__":
    sys.exit(main())
