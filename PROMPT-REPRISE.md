# Prompt de reprise — Snack Empire

> Copie tout ce qui est sous la ligne ci-dessous et colle-le comme premier message dans Claude Code (VS Code),
> ouvert sur le dossier `jeux 2 - tycoon clic`.

---

Tu reprends le développement de **Snack Empire**, un jeu de gestion « tycoon » 3D pour navigateur (Three.js), destiné à être publié sur **CrazyGames** pour rapporter de l'argent avec les pubs. Je suis débutant en programmation : explique-moi les choses simplement, **réponds toujours en français**, et vérifie tes modifications toi-même (lancer le jeu, tester, build) avant de me dire que c'est fini.

## Le projet

- Dossier : `jeux 2 - tycoon clic/` (dépôt Git, branche `main`). Le jeu est dans `snack-empire/`.
- Technique : Three.js 0.160 + Vite 5, modules ES, JavaScript sans framework. Modèles 3D faits avec Blender (`public/models/*.glb`, scripts dans `tools/blender/`).
- Lancer : `npm --prefix snack-empire install` (une fois), puis `npm --prefix snack-empire run dev` → http://localhost:5173. Version finale : `npm --prefix snack-empire run build` → `snack-empire/dist/`.
- Git est installé dans `C:\Program Files\Git\cmd\git.exe` (pas forcément dans le PATH du terminal : utilise le chemin complet si `git` n'est pas trouvé). Messages de commit en français.
- Le jeu en console : `window.sfe = { game, world, ui, quality, visuals, audio, sfx }`.

## Le jeu (ce qui existe)

Style **semi-réaliste** (pas low poly). On sert des clients dans 5 niveaux qui s'ouvrent l'un après l'autre, sans rien perdre :
1. **Camions** (parking, 4 food trucks) — 2. **Marché couvert** (6 étals) — 3. **Port de pêche** (8 boutiques, criée, pontons, digue et phare ; événement « arrivage du pêcheur » ventes ×3) — 4. **Plage** (8 paillotes à gauche de la fête ; événement « canicule » ×3) — 5. **Fête foraine** (8 stands éparpillés sur une pelouse usée, grande roue au bout d'un ponton, carrousel, auto-tamponneuses, chaises volantes, montagne russe ; événement « nuit » ×3).

Déjà fait : recettes / améliorations / vendeurs, sauvegarde auto + gains hors ligne, clients articulés qui font la queue (pas de dépassement), s'assoient à table (genoux pliés), trajets calculés (A* dans `nav.js`) à la fête et à la plage ; vendeurs animés selon leur stand (`chefanim.js`) + petites machines animées (`standfx.js`) ; caméra libre (glisser, molette, clic droit, ZQSD/flèches) et le menu de zone qui suit la caméra ; son synthétisé Web Audio (`audio.js`, réglages effets/musique + bouton 🔇) ; interface adaptée téléphone/tablette (≤ 900 px : bouton « 📺 Bonus », boutique en panneau du bas) ; tutoriel 7 étapes (`tutorial.js`) ; logo `public/logo.svg` + écran de chargement ; **équilibrage** calibré par simulation (partie complète ≈ 11 h, voir l'en-tête de `STAND_COST` dans `economy.js`) avec un multiplicateur d'**affluence** dans `game.js` (le nombre de clients visibles est plafonné, chaque vente compte pour la foule théorique) ; **SDK CrazyGames v3** branché (`platform.js`, `ads.js`, `save.js`) : pubs récompensées (bonus 📺), pub de mi-partie seulement à l'ouverture d'un nouveau niveau, pause + écran bloqué pendant une pub, son coupé au démarrage de la pub, réglage « muteAudio » du site respecté, bloqueur de pubs géré (boutons masqués + message), sauvegarde dans le compte du joueur (module data) avec reprise de la sauvegarde locale.

## Fichiers clés (`snack-empire/src/`)

`main.js` (démarrage, boucle, branchement des sons) · `game.js` (logique, clients, événements, affluence) · `economy.js` (TOUS les prix et constantes) · `stand.js` (emplacements, orientation, file, tables) · `ui.js` (HUD, boutique, zones) · `visuals.js` (décors qui apparaissent avec les améliorations) · `world.js` (scène, caméra, quai) · `market.js` / `port.js` / `beach.js` / `fair.js` (décors et stands de chaque niveau) · `fairnav.js` + `nav.js` (chemins) · `people.js` + `models.js` (clients) · `platform.js` / `ads.js` / `save.js` (CrazyGames) · `tutorial.js` · `audio.js`.

## Langues (important)

Le jeu est **en anglais par défaut** (exigé par CrazyGames) et en français si le navigateur du joueur est en français ; le joueur peut changer dans ⚙️ (le jeu se recharge). Tout nouveau texte visible doit avoir ses deux versions : `L('texte français', 'English text')` (import depuis `./i18n.js`) ; les sommes d'argent passent par `money(n)` (« 12 M $ » / « $12 M »). Les textes de `index.html` sont en anglais avec la version française dans un attribut `data-fr`.

## Pièges connus (important)

- **Ne jamais changer la clé de sauvegarde** `street-food-empire-save-v1` (ancien nom du jeu) : ça effacerait les parties des joueurs. Toute modification de la structure de sauvegarde doit convertir les anciennes (exemple : `levelSwap45` dans le constructeur de `Game`).
- Emplacements : 0-3 camions, 4-9 marché, 10-17 port, 18-25 plage, 26-33 fête (`economy.js` → `ZONES`). L'ordre de déblocage suit ces numéros.
- **Tester sans abîmer ma partie** : avant un test qui modifie l'état, copie `localStorage['street-food-empire-save-v1']` dans `sfe-user-backup`, remplace `game.save` par une fonction vide, teste, puis remets la sauvegarde et recharge.
- Avec Vite, après des modifications à chaud, un `import('/src/economy.js')` depuis la console peut donner une **autre copie** du module que celle du jeu : utilise l'URL réellement chargée (`performance.getEntriesByType('resource')`) si tu modifies des valeurs en direct.
- Sous PowerShell, attention aux remplacements de texte en lot : un tableau d'une seule paire `@( @('a','b') )` est aplati (il faut `@(, @('a','b'))`), ce qui a déjà abîmé un fichier. Préfère l'outil d'édition de fichier.
- Règles CrazyGames à respecter : pubs de mi-partie jamais pendant le jeu ni sur un bouton de navigation ; récompense seulement sur `adFinished` ; le jeu doit rester jouable avec un bloqueur de pubs ; pas de bouton de bonus cliquable sans effet ; pas de liens externes.

## Ce qui reste à faire (dans l'ordre)

1. **Commande de paquet** : ajouter `npm run package` qui fait le build puis un `.zip` de `snack-empire/dist/` (index.html à la racine du zip), prêt à déposer sur le portail CrazyGames.
2. **Images de couverture** obligatoires : 1920×1080, 800×1200 et 800×800 (sans bordure, sans texte autre que le titre, rien de flou) — à partir du logo et de belles vues du jeu. Et une **vidéo** de 15-20 s sans son (1080p paysage + 1080p portrait 2:3).
3. **Test sur un vrai téléphone** (`npm --prefix snack-empire run dev -- --host`, puis l'adresse « Network » sur le téléphone, même Wi-Fi).
4. Tester sur l'outil de prévisualisation CrazyGames (crazygames.com/preview), puis **publier** : compte développeur sur https://developer.crazygames.com/ (remplir *Account → Billing*, sinon impossible d'envoyer un jeu), « Submit a game », cocher l'option **Progress Save** (sinon la sauvegarde dans le compte est désactivée). Les pubs ne tournent qu'en **Full Launch**.
5. Pour chaque mise à jour : modifier → build → nouveau zip → l'envoyer sur le portail (pas de lien automatique avec Git).
6. Plus tard : copie de secours sur GitHub, nouveaux niveaux/événements, éventuellement Poki.

Commence par lire `snack-empire/src/main.js`, `game.js` et `economy.js`, lance le jeu pour vérifier qu'il tourne, puis dis-moi où on en est et propose-moi de faire l'étape 1.
