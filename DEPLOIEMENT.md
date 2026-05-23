# 🚀 Guide de déploiement — Athlete Routine

Suis ces étapes dans l'ordre. Comptez environ **45–60 min** pour tout mettre en ligne.

---

## ÉTAPE 1 — Créer un compte GitHub

1. Va sur **github.com** → clique "Sign up"
2. Choisis un username (ex: `nicolascoach`)
3. Confirme ton email

---

## ÉTAPE 2 — Mettre le projet sur GitHub

1. Connecte-toi à GitHub
2. Clique le **+** en haut à droite → "New repository"
3. Nom : `athlete-routine` → clique "Create repository"
4. Télécharge et installe **GitHub Desktop** : desktop.github.com
5. Dans GitHub Desktop : "Add existing repository" → sélectionne le dossier du projet
6. Clique "Publish repository"

---

## ÉTAPE 3 — Créer le projet Supabase

1. Va sur **supabase.com** → "Start your project" → connecte-toi avec GitHub
2. Clique "New project"
   - Nom : `athlete-routine`
   - Mot de passe DB : génères-en un fort et **note-le**
   - Région : `West EU (Ireland)`
3. Attends ~2 min que le projet démarre
4. Va dans **Project Settings > API** et note :
   - `Project URL` → ressemble à `https://xxxxx.supabase.co`
   - `anon public key` → longue chaîne de caractères
   - `service_role key` → à garder secret !

---

## ÉTAPE 4 — Créer la base de données

1. Dans Supabase, va dans **SQL Editor** (icône base de données à gauche)
2. Clique "New query"
3. Ouvre le fichier `supabase-schema.sql` du projet, **copie tout** et colle-le
4. Clique **Run** → tu dois voir "Success"

---

## ÉTAPE 5 — Activer Google Auth (optionnel mais recommandé)

1. Dans Supabase : **Authentication > Providers > Google**
2. Active le toggle
3. Va sur **console.cloud.google.com** → crée un projet → APIs & Services > Credentials
4. Crée un "OAuth 2.0 Client ID" (type: Web application)
5. Colle les Client ID et Secret dans Supabase
6. Dans les "Authorized redirect URIs" de Google, ajoute :
   `https://xxxxx.supabase.co/auth/v1/callback`

---

## ÉTAPE 6 — Déployer sur Vercel

1. Va sur **vercel.com** → "Sign up with GitHub"
2. Clique "Add New Project"
3. Sélectionne ton repo `athlete-routine`
4. Dans la section **Environment Variables**, ajoute :

| Nom | Valeur |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ton Project URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ta anon key Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ta service_role key |
| `NEXT_PUBLIC_COACH_EMAIL` | ton adresse email (celle que tu utiliseras pour te connecter comme coach) |

5. Clique **Deploy** → attends ~2 min

🎉 **Ton app est en ligne !** Vercel te donne une URL comme `athlete-routine.vercel.app`

---

## ÉTAPE 7 — Ajouter ton domaine personnalisé (optionnel)

1. Achète un domaine sur **OVH** ou **Namecheap** (~10€/an)
   Ex : `athleteroutine.fr` ou `ma-routine.app`
2. Dans Vercel : Settings > Domains > ajoute ton domaine
3. Suis les instructions DNS (5 min)

---

## ÉTAPE 8 — Configurer les puces NFC

1. Installe **NFC Tools** sur ton téléphone (gratuit)
2. Pour chaque puce :
   - 🌙 **Puce Night** → URL : `https://ton-domaine.app/?tab=night`
   - ☀️ **Puce Morning** → URL : `https://ton-domaine.app/?tab=morning`
   - 📓 **Puce Journal** → URL : `https://ton-domaine.app/?tab=journal`
3. Approche la puce de ton téléphone → écris l'URL → Done !

---

## ÉTAPE 9 — Te connecter comme coach

1. Va sur ton URL Vercel
2. Crée un compte avec **l'email que tu as mis dans `NEXT_PUBLIC_COACH_EMAIL`**
3. Tu atterris automatiquement sur le **Dashboard Coach** 🏆

---

## Résumé des coûts

| Service | Coût |
|---------|------|
| GitHub | Gratuit |
| Supabase (jusqu'à 50k users) | Gratuit |
| Vercel (jusqu'à 100GB bandwidth) | Gratuit |
| Domaine personnalisé | ~10€/an |
| Puces NFC (x10) | ~5–10€ |
| **TOTAL démarrage** | **~15–20€** |

---

## En cas de problème

- **Erreur de build Vercel** → vérifie que toutes les variables d'environnement sont bien remplies
- **Connexion Google ne marche pas** → vérifie l'URL de callback dans Google Console
- **Les données ne se sauvegardent pas** → va dans Supabase > Table Editor pour vérifier que les tables `entries` et `profiles` existent

Tu peux m'envoyer les erreurs directement, je t'aide à les résoudre 💪
