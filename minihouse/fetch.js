// build-manifest.js
const fs = require('fs');
const path = require('path');

const textureDir = './texture';
const manifest = { items: [] };

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      walk(full);
    } else {
      const rel = full.replace(/\\/g, '/');

      const m = e.name.match(/^(\d+)-(\d+)(.+)\.(png|jpg|gif|webp)$/i);

      if (!m) continue;

      const parts = rel.split('/');

      if (parts.length < 4) continue;

      const catIndex = parseInt(parts[1]) - 1;
      const subIndex = parseInt(parts[2]) - 1;

      manifest.items.push({
        catIndex,
        subIndex,
        page: parseInt(m[1]),
        order: parseInt(m[2]),
        name: m[3],
        src: rel
      });
    }
  }
}

walk(textureDir);

fs.writeFileSync(
  './texture/manifest.json',
  JSON.stringify(manifest, null, 2)
);

console.log('manifest generated');