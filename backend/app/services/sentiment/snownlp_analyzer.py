from snownlp import SnowNLP
from app.services.sentiment.base import BaseSentimentAnalyzer, SentimentResult


class SnowNLPAnalyzer(BaseSentimentAnalyzer):
    """SnowNLP-based sentiment analyzer (synchronous, run via executor)."""

    name: str = "snownlp"

    def analyze_batch(self, texts: list[str]) -> list[SentimentResult]:
        results = []
        for text in texts:
            if not text or not text.strip():
                results.append(SentimentResult(text=text, score=0.5, label="neutral", confidence=0.0))
                continue
            try:
                score = SnowNLP(text).sentiments
            except Exception:
                score = 0.5
            label, confidence = self.classify(score, text)
            results.append(SentimentResult(
                text=text, score=round(score, 4),
                label=label, confidence=confidence,
            ))
        return results
