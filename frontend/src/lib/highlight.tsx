/** 圈起原文裡的那個詞 —— 朱批，不是螢光筆。 */
export function circleWord(text: string, word: string) {
  if (!word) return text;
  const parts = text.split(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "g"));
  return parts.map((part, i) =>
    part === word ? (
      <b
        key={i}
        className="font-semibold text-mark underline decoration-mark/60 decoration-1 underline-offset-[0.2em]"
      >
        {part}
      </b>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
