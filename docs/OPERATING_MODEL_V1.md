# ConduiPRO — modèle opérationnel V1

## Rôles pris en charge

ConduiPRO V1 utilise trois profils d'accès seulement :

1. **Administrateur de la plateforme** — compte géré par ConduiPRO. Il crée, suspend et réactive les écoles clientes.
2. **Propriétaire d'école** — un compte propriétaire actif par établissement. Il gère tous les dossiers élèves, les séances, les demandes, la progression, les documents et les finances pédagogiques de son école.
3. **Élève** — compte créé automatiquement par son école à la création du dossier. Il accède uniquement à son propre dossier.

Il n'existe pas de compte Employé ni de compte Instructeur dans cette version. Une sortie pratique est planifiée et validée directement par le propriétaire de l'école. Le nom ou l'identifiant d'un formateur n'est pas requis pour utiliser ConduiPRO.

## Parcours d'administration

### Administrateur ConduiPRO

- Se connecte à l'espace Administration.
- Crée une école avec le nom de l'établissement et les coordonnées de son propriétaire.
- Le serveur crée le compte Auth du propriétaire, son profil, l'établissement, son code école et son adhésion propriétaire.
- Un mot de passe temporaire est affiché une seule fois. Le propriétaire doit le remplacer à la première connexion.
- L'administrateur peut suspendre ou réactiver un établissement.

### Propriétaire d'école

- Se connecte avec l'adresse courriel et son mot de passe.
- Crée manuellement un dossier élève à partir du numéro de contrat et des renseignements nécessaires.
- La création génère le compte Auth de l'élève, le profil, la fiche, la phase 1 et les lignes de progression de la formation dans une opération de provisioning contrôlée.
- Le propriétaire remet le code école, le numéro de contrat et le mot de passe temporaire à l'élève par un canal sûr.
- Le propriétaire gère la formation, les séances et les demandes. Les règles de progression sont revalidées par PostgreSQL.

### Élève

- Choisit l'espace Élève.
- Saisit le code école, le numéro de contrat et son mot de passe.
- Change obligatoirement son mot de passe temporaire au premier accès.
- Consulte son contrat, son solde, son permis, ses modules, ses sorties, ses cours et ses demandes.
- Peut envoyer une demande théorique pour un module manquant de sa phase actuelle, ou une demande pratique en texte libre de disponibilités.
- Peut téléverser son permis après la réussite des cinq modules de la phase 1. Le téléversement ne vaut pas approbation.

## Parcours pédagogique

- Programme classe 5 : 12 modules théoriques et 15 sorties pratiques.
- Durées minimales des phases : 28, 28, 56 et 56 jours.
- Le module 5 est l'évaluation de l'école après les modules 1 à 4.
- Le passage à la phase suivante exige la durée minimale et les éléments pédagogiques requis.
- Les séances pratiques durent 55 minutes. Le serveur bloque deux sorties qui se chevauchent pour un même élève.
- Les cours théoriques sont proposés par l'école avec une capacité. Une demande approuvée réserve une place.

## Principes de sécurité

- Pas d'inscription publique.
- La clé Supabase secrète est utilisée exclusivement côté serveur.
- Les lectures et écritures sont limitées à l'école et à l'élève de la session.
- Les documents sont stockés dans le bucket privé `student-documents`; les liens de consultation sont temporaires.
- Le changement de mot de passe initial est vérifié côté serveur via `app_metadata`.
- Les RPC métier vérifient le propriétaire actif dans la base, pas uniquement dans l'interface.
- Les comptes de démonstration dont les anciennes adhésions sont désactivées ne peuvent pas ouvrir l'espace école.

## Retrait du bootstrap temporaire

Le bootstrap one-shot qui créait une école de démonstration est retiré. Les nouvelles écoles doivent être créées par l'administrateur authentifié depuis `/admin`. La route historique renvoie HTTP 410 et l'ancienne page d'installation redirige vers la connexion.
