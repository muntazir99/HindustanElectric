"""Telling an upload's real type from its first bytes: the browser's label and the file name are not trusted."""

HEIC_BRANDS = {b"heic", b"heix", b"hevc", b"heim", b"heis", b"mif1", b"msf1"}


def attachment_kind(upload):
    """The file's real type from its first bytes (".pdf", ".jpg"...), or None. The browser's label is not trusted."""
    head = upload.read(16)
    upload.seek(0)
    if head.startswith(b"%PDF-"):
        return ".pdf"
    if head.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ".webp"
    if head[4:8] == b"ftyp" and head[8:12] in HEIC_BRANDS:
        return ".heic"
    return None
