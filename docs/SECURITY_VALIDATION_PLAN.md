# ConduiPRO — plan et statut de validation sécurité

## Statut au 26 novembre 2026
La base active applique les migrations de schéma, d'isolation tenant, de stockage privé, de rôles propriétaire, de helpers RLS privés, de contrats et de paiements.

Les points suivants sont déjà appliqués :
1. Les fonctions RLS internes sont dans `private`; les wrappers publics ne sont pas exécutables par les clients.
2. Les rôles scolaires actifs sont limités à `owner`; les anciennes politiques Employee/Instructor ont été retirées ou ramenées à owner-only.
3. Le compte plateforme utilise `platform_admins`, séparé des adhésions scolaires.
4. Les fonctions de contrat et paiement sont SECURITY INVOKER et soumises à RLS.
5. Les paiements sont atomiques, verrouillés par facture et limités au solde restant.
6. Le stockage des contrats/permis est privé et limité au chemin école/élève.
7. Les clés étrangères manquantes ont des index, et les principales politiques RLS évitent la réévaluation par ligne de `auth.uid()`.

## Tests déjà exécutés
- CI GitHub : audit dépendances, ESLint et build Next.js réussis sur les derniers commits validés.
- Simulations JWT owner/élève sur la base réelle de démonstration.
- Transactions annulées pour planification pratique, décision sur demande, contrat, facture et paiement partiel.
- Vérification que les anciens comptes secondaires n'ont plus d'adhésion active.

## À compléter avant la production commerciale
- Tester deux écoles indépendantes pour valider tous les scénarios cross-tenant.
- Utiliser un vrai navigateur pour tester les parcours école et élève, les mots de passe temporaires, la récupération de mot de passe et les erreurs de formulaire.
- Envoyer et recevoir les courriels réels via SMTP pour les propriétaires et la récupération de mot de passe.
- Tester upload, lecture signée, rejet et resoumission de permis dans le bucket privé.
- Activer la protection contre les mots de passe compromis dans Supabase Auth si le plan le permet.
- Effectuer une revue de conformité et de conservation des dossiers avant d'utiliser des données personnelles réelles d'élèves.

## Limites connues
- La base ne contient actuellement qu'un établissement de démonstration.
- Le Security Advisor mentionne deux tables internes en RLS sans politique : le verrou historique de bootstrap et la table d'affectations instructeur retirée de l'usage client. Elles n'accordent aucun accès aux rôles applicatifs.
- La protection des mots de passe compromis est désactivée dans la configuration Auth actuelle.
