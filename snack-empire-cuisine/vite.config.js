import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Outil de développement uniquement (jamais dans le jeu publié) : le jeu peut envoyer une image ou une vidéo
 * au serveur de test, qui l'enregistre dans le dossier « marketing » (couvertures et vidéos pour CrazyGames).
 */
const saveMarketing = {
  name: 'save-marketing',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__save', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      const name = path.basename(new URL(req.url, 'http://x').searchParams.get('name') || 'capture.png');
      const dir = path.resolve(__dirname, '..', 'marketing');
      fs.mkdirSync(dir, { recursive: true });
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
        res.end(JSON.stringify({ saved: path.join(dir, name), bytes: Buffer.concat(chunks).length }));
      });
    });
  },
};

// base: './' → le build fonctionne dans n'importe quel sous-dossier (itch.io, CrazyGames, Poki).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  plugins: [saveMarketing],
});
