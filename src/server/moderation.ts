import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeModerator, type Moderator } from './chatfilter.ts';

export { makeModerator, type Moderator };

/** Operators extend the built-in list with one word per line in <dataDir>/blocklist.txt. */
export async function loadModerator(dataDir: string): Promise<Moderator> {
  try {
    const words = (await readFile(join(dataDir, 'blocklist.txt'), 'utf8')).split('\n').map((w) => w.trim()).filter(Boolean);
    return makeModerator(words);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return makeModerator();
  }
}
