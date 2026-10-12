/** The chat filter itself, with no file access, so the browser bundle can carry it too (bots' lines in the attract scene, bot/social.ts). */
const BUILT_IN = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dick', 'pussy', 'whore', 'slut', 'bastard', 'retard', 'faggot', 'nazi', 'rape'];
const LOOKALIKES: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

const letters = (s: string) => [...s.toLowerCase()].map((ch) => LOOKALIKES[ch] ?? ch).filter((ch) => /\p{L}/u.test(ch)).join('');

export type Moderator = { isClean(text: string): boolean; mask(text: string): string };

export function makeModerator(extra: readonly string[] = []): Moderator {
  const blocked = [...new Set([...BUILT_IN, ...extra].map(letters).filter((w) => w.length >= 3))];
  const hit = (word: string) => { const l = letters(word); return blocked.some((b) => l.includes(b)); };
  return {
    isClean: (text) => !hit(text.replace(/\s+/g, '')) && !text.split(/\s+/).some(hit),
    mask: (text) => text.split(/(\s+)/).map((part) => (hit(part) ? '*'.repeat(part.length) : part)).join(''),
  };
}
