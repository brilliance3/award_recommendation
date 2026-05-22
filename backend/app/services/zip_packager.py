"""표창 건 전체 문서를 하나의 ZIP으로 묶는 서비스"""
from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Iterable

from ..config import GENERATED_DIR


def package_files(zip_name: str, files: Iterable[Path]) -> Path:
    out = GENERATED_DIR / zip_name
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            if Path(f).exists():
                zf.write(f, arcname=Path(f).name)
    return out
