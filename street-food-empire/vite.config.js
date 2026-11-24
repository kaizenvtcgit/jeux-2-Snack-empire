import { defineConfig } from 'vite';

// base: './' → le build fonctionne dans n'importe quel sous-dossier (itch.io, CrazyGames, Poki).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
