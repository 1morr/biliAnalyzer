# backend/app/services/wordcloud_svc.py
import json
from pathlib import Path
import jieba
from wordcloud import WordCloud
from app.core.config import settings

# Common Chinese stop words
STOP_WORDS = set("的了是在不有和人这中大为上个国我以要他时来用们生到作地于出会s可也你对就里如被从之好最所然机与知道说本长看那但c下自现前工么都很种多将学实手世美行无才同得当已最先过身什将而做家所开意把让面公关新但已等能没理事全体之大无才多想电长民接把关正在我们".split())
STOP_WORDS.update({"", " ", "\n", "\t", "哈哈", "啊", "了", "的", "是"})


def generate_wordcloud(texts: list[str], output_path: str, width: int = 800, height: int = 400) -> str:
    """Generate word cloud from texts, save as PNG, return file path."""
    combined = " ".join(texts)
    if not combined.strip():
        return ""

    words = jieba.cut(combined)
    filtered = [w for w in words if len(w) > 1 and w not in STOP_WORDS]
    text = " ".join(filtered)

    if not text.strip():
        return ""

    wc = WordCloud(
        width=width, height=height,
        background_color="white",
        font_path=_find_cjk_font(),
        max_words=100,
        collocations=False,
    )
    wc.generate(text)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    wc.to_file(output_path)
    return output_path


def _find_cjk_font() -> str | None:
    """Find a CJK font on the system for word cloud rendering."""
    candidates = [
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",  # Linux
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",  # Linux
        "C:/Windows/Fonts/msyh.ttc",  # Windows (Microsoft YaHei)
        "C:/Windows/Fonts/simhei.ttf",  # Windows (SimHei)
        "/System/Library/Fonts/PingFang.ttc",  # macOS
    ]
    for path in candidates:
        if Path(path).exists():
            return path
    return None
