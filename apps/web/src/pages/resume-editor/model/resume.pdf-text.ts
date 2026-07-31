const breakableCharacterPattern =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Number}]/u;

export function createPdfTextBreaks(word: string): string[] {
  if (!breakableCharacterPattern.test(word)) return [word];

  const segments: string[] = [];
  for (const character of Array.from(word)) {
    const previous = segments.at(-1);
    if (
      previous &&
      !breakableCharacterPattern.test(character) &&
      !breakableCharacterPattern.test(previous)
    ) {
      segments[segments.length - 1] += character;
    } else {
      segments.push(character);
    }
  }

  return segments.flatMap((segment) => [segment, '']);
}
