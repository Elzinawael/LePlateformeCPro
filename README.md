# ConduiPRO

Application SaaS de gestion pédagogique pour auto-écoles au Québec.

## Stack
- Next.js 15.5 / React 19 / TypeScript
- Supabase Auth, Postgres (RLS) et Storage privé
- GitHub Actions : ESLint + build de production

## Espaces
- Portail établissement : tableaux de bord, gestion des élèves, invitations, demandes et planification des cours théoriques.
- Portail élève : progression du programme SAAQ, séances de théorie, demandes pratiques, contrat, solde et dépôt privé du permis.
- Authentification : connexion, invitation, création du mot de passe et réinitialisation.

## SAAQ PESR — classe 5
Le programme par défaut comprend quatre phases, douze modules théoriques de deux heures et quinze sorties pratiques de 55 minutes. Le jalon de permis est rattaché à la réussite des modules 1 à 5 en phase 1, avant les sorties de phase 2.

Référence : [SAAQ — Cours de conduite automobile](https://saaq.gouv.qc.ca/permis-conduire/cours-conduite/automobile).

## Développement local
1. Copier `.env.example` vers `.env.local`.
2. Renseigner l'URL Supabase et la clé publishable.
3. Garder `SUPABASE_SECRET_KEY` côté serveur uniquement.
4. Installer puis lancer :

```bash
npm install
npm run dev
```

Consulter [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) pour la configuration Auth, SMTP, redirect URLs et déploiement.
