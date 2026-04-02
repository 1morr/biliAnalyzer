from app.services.sentiment.base import BaseSentimentAnalyzer, SentimentResult
from app.services.sentiment.snownlp_analyzer import SnowNLPAnalyzer

_ANALYZERS: dict[str, type[BaseSentimentAnalyzer]] = {
    "snownlp": SnowNLPAnalyzer,
}


def get_analyzer(name: str = "snownlp") -> BaseSentimentAnalyzer:
    cls = _ANALYZERS.get(name)
    if not cls:
        raise ValueError(f"Unknown analyzer: {name}. Available: {list(_ANALYZERS.keys())}")
    return cls()


__all__ = ["BaseSentimentAnalyzer", "SentimentResult", "get_analyzer"]
