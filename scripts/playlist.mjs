// Builds public/music/playlist.json from the audio files in public/music.
// Runs automatically before `npm start` and `npm run build`; you only drop files into the folder.
// File names become titles: "Artist - Title.opus" -> { artist: "Artist", title: "Title" }. A leading "01 " or "01. " sets the order.
import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const dir = join(import.meta.dirname, '..', 'public', 'music');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const exts = new Set(['.opus', '.ogg', '.mp3', '.m4a', '.aac', '.webm', '.flac', '.wav']);
const files = readdirSync(dir)
  .filter((f) => exts.has(extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
const tracks = files.map((file) => {
  let name = basename(file, extname(file))
    .replace(/^\d+\s*[.\-_)]?\s*/, '')
    .replace(/_/g, ' ')
    .trim();
  const dash = name.indexOf(' - ');
  const artist = dash > 0 ? name.slice(0, dash).trim() : '';
  const title = dash > 0 ? name.slice(dash + 3).trim() : name;
  return { file: encodeURIComponent(file), title, artist };
});
writeFileSync(
  join(dir, 'playlist.json'),
  JSON.stringify({ station: 'Ноктюрн FM', freq: '13.02', tracks }, null, 2) + '\n',
);
console.log(`playlist.json: ${tracks.length} track(s)`);
