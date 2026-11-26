# ConduiPRO

Application SaaS de gestion des auto-écoles au Québec.

## Stack
- Next.js 15.5 / React 19 / TypeScript
- Supabase Auth, PostgreSQL avec RLS et Storage privé
- GitHub Actions : audit npm, ESLint et build de production

## Modèle d'accès
- **Administrateur ConduiPRO** : crée, consulte, suspend et réactive les écoles depuis `/admin`.
- **Propriétaire d'école** : un compte de direction par établissement. Il gère les élèves, leurs contrats et paiements, les séances théoriques, les demandes, les permis et les leçons pratiques.
- **Élève** : compte créé automatiquement par l'école. Connexion avec code école + numéro de contrat, puis changement obligatoire du mot de passe initial.

Aucun compte Employé ou Instructeur n'est nécessaire. Le nom du moniteur responsable est enregistré lors de la planification d'une sortie pratique.

## Fonctions opérationnelles
- Provisionnement serveur d'une école et de son propriétaire avec identifiants temporaires affichés une seule fois.
- Création d'un dossier élève et d'un compte Auth lié, avec initialisation du suivi pédagogique.
- Connexion séparée École / Élève.
- Suivi des 4 phases, 12 modules théoriques et 15 leçons pratiques du PESR classe 5.
- Demandes de cours théoriques sur les séances futures avec places disponibles.
- Demandes de leçons pratiques avec disponibilité textuelle.
- Planification des séances par l'école, avec contrôle des conflits de 55 minutes.
- Validation des modules, avancement de phase, dépôt et revue du permis d'apprenti.
- Contrats, factures, paiements partiels et solde restant.
- Stockage privé des permis et contrats PDF, limité au dossier concerné.
- Suspension d'une école et blocage de l'accès de ses utilisateurs.

## SAAQ PESR — classe 5
Le programme par défaut contient quatre phases, douze modules théoriques de deux heures et quinze sorties pratiques de 55 minutes. Le jalon de permis est lié à la réussite des modules 1 à 5 en phase 1.

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

Consulter [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md), [docs/SECURITY.md](docs/SECURITY.md) et [docs/RLS_ROLE_TEST_MATRIX.md](docs/RLS_ROLE_TEST_MATRIX.md).
