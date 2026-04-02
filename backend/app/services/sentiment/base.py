from dataclasses import dataclass


@dataclass
class SentimentResult:
    text: str
    score: float       # 0.0 (negative) to 1.0 (positive)
    label: str         # "positive" | "neutral" | "negative"
    confidence: float  # 0.0 to 1.0


class BaseSentimentAnalyzer:
    """Abstract base for pluggable sentiment analyzers."""

    name: str = "base"

    def analyze_batch(self, texts: list[str]) -> list[SentimentResult]:
        raise NotImplementedError

    @staticmethod
    def classify(score: float, text: str) -> tuple[str, float]:
        """Classify score into label + confidence.

        Short texts (<20 chars, typical danmaku) use wider neutral zone
        0.3-0.7 to reduce noise; longer texts use 0.4-0.6.
        """
        is_short = len(text) < 20
        neg_threshold = 0.3 if is_short else 0.4
        pos_threshold = 0.7 if is_short else 0.6

        if score >= pos_threshold:
            confidence = (score - pos_threshold) / (1.0 - pos_threshold)
            return "positive", round(min(confidence, 1.0), 3)
        elif score <= neg_threshold:
            confidence = (neg_threshold - score) / neg_threshold
            return "negative", round(min(confidence, 1.0), 3)
        else:
            mid = (neg_threshold + pos_threshold) / 2
            half_width = (pos_threshold - neg_threshold) / 2
            confidence = 1.0 - abs(score - mid) / half_width
            return "neutral", round(min(confidence, 1.0), 3)
