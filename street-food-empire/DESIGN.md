# Street Food Empire — mini document de design

## Pitch
Jeu de gestion idle en 3D, au style **semi-réaliste stylisé**, jouable dans le navigateur.
Tu démarres avec un food truck sur un parking. Tu sers des clients, tu améliores tes recettes,
tu embauches et tu ouvres de nouveaux stands jusqu'à posséder le parking entier (puis la ville).

## Boucle principale (toutes les 5 à 30 secondes)
1. Les clients arrivent et font la queue devant un stand.
2. Le premier client commande une recette parmi celles débloquées.
3. Le cuisinier prépare la commande (barre de progression), puis le client paie (« +12 $ » flotte au-dessus).
4. Le client repart, ou s'assoit à une table.
5. Le joueur dépense l'argent en améliorations, puis le cycle recommence en plus rapide et plus rentable.

Si la queue est pleine, les nouveaux clients s'en vont. Ça pousse le joueur à améliorer la vitesse
de service ou à ouvrir un nouveau stand.

## Recettes (débloquées une à une)
| Recette | Prix de base | Déblocage |
|---|---|---|
| 🍔 Burger | 5 $ | dès le départ |
| 🍟 Frites | 8 $ | 150 $ |
| 🌮 Tacos | 20 $ | 1 200 $ |
| 🌭 Hot-dog | 55 $ | 8 000 $ |
| 🧋 Bubble tea | 150 $ | 45 000 $ |

- Chaque niveau de recette rapporte **+20 % sur le prix de base**, plus un bonus ×2 tous les 10 niveaux.
- Coût d'une amélioration : `coût de base × 1,15^niveau`.

## Améliorations globales
- **Vitesse du grill** : le temps de préparation est multiplié par 0,92 à chaque niveau (2,8 s au départ, minimum 0,35 s).
- **Publicité** : les clients arrivent plus souvent (intervalle × 0,9 par niveau).
- **Taille de la file** : +1 place par niveau (3 places au départ).

## Stands
- On démarre avec le stand n°1. Les emplacements verrouillés (contour en pointillés) se débloquent avec de l'argent :
  5 000 $, puis 60 000 $, puis 750 000 $.
- Chaque stand a sa propre file et peut employer jusqu'à 3 cuisiniers (chaque cuisinier ajoute une commande en parallèle).

## Rétention et monétisation
- **Gains hors-ligne** : au retour du joueur, il reçoit 50 % de son revenu moyen par seconde × le temps d'absence
  (8 h maximum). Bouton « ×2 avec une pub ».
- **Pubs récompensées** (facultatives, toujours au choix du joueur) :
  - « Coup de feu » : tous les gains ×2 pendant 3 minutes.
  - « Livraison de clients » : 10 clients arrivent d'un coup.
  - Doubler les gains hors-ligne.
- **Pubs intercalaires** : uniquement au déblocage d'un nouveau stand, jamais pendant le jeu.
- Les pubs passent par un adaptateur (`ads.js`) : simulation en développement, puis SDK CrazyGames ou Poki à la publication.

## Plus tard (après le prototype)
- **Prestige** : « Franchiser » sa ville contre des étoiles qui donnent un bonus permanent.
- Nouveaux lieux (plage, centre-ville, festival), événements (pluie, concert), missions quotidiennes.
- Modèles 3D détaillés faits dans Blender, sons, musique.

## Technique
- Three.js + Vite : le build produit un dossier statique (le format attendu par itch.io, CrazyGames et Poki).
- Sauvegarde automatique dans `localStorage` toutes les 5 secondes, et à la fermeture de la page.
- Cible : 60 images/s sur un PC moyen, avec des ombres à qualité réglable.
