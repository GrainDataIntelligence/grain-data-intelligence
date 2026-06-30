import json
import re
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "content" / "education" / "raw"
LOCAL_DIR = ROOT / "content" / "education" / "articles"
PUBLIC_DIR = ROOT / "charting-react" / "public" / "data" / "education"

WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "article"


def title_from_filename(path):
    return path.stem.replace("_", " ").replace("-", " ").strip()


def clean_text(value):
    if not value:
        return ""
    text = str(value)
    if "â" in text or "Â" in text:
        try:
            text = text.encode("latin1").decode("utf-8")
        except UnicodeError:
            pass
    return text.strip()


def paragraph_style(paragraph):
    style = paragraph.find(".//w:pStyle", WORD_NS)
    if style is None:
        return "paragraph"
    value = style.attrib.get(f"{{{WORD_NS['w']}}}val", "")
    if value.lower().startswith("heading"):
        return "heading"
    if value.lower() in {"title", "subtitle"}:
        return value.lower()
    return "paragraph"


def read_docx(path):
    with ZipFile(path) as archive:
        xml = archive.read("word/document.xml")

    root = ET.fromstring(xml)
    blocks = []

    for paragraph in root.findall(".//w:p", WORD_NS):
        text = clean_text("".join(node.text or "" for node in paragraph.findall(".//w:t", WORD_NS)))
        if not text:
            continue
        blocks.append({"type": paragraph_style(paragraph), "text": text})

    title = title_from_filename(path)
    subtitle = ""

    if blocks and blocks[0]["type"] in {"title", "heading"}:
        title = blocks[0]["text"]
        blocks = blocks[1:]

    if blocks and blocks[0]["type"] == "subtitle":
        subtitle = blocks[0]["text"]
        blocks = blocks[1:]

    return {
        "id": slugify(title_from_filename(path)),
        "title": title,
        "subtitle": subtitle,
        "sourceFile": str(path),
        "updatedAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
        "blocks": blocks,
    }


def main():
    articles = [read_docx(path) for path in sorted(RAW_DIR.glob("*.docx"))]
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "articleCount": len(articles),
        "articles": articles,
    }

    for output_dir in [LOCAL_DIR, PUBLIC_DIR]:
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "articles.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote {len(articles)} education article(s)")
    for article in articles:
        print(f"- {article['title']} ({len(article['blocks'])} blocks)")


if __name__ == "__main__":
    main()
