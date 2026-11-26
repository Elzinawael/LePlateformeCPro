# ConduiPRO — matrice des tests RLS et rôles

## Acteurs de la version actuelle
- Administrateur plateforme : utilisateur présent dans `public.platform_admins`.
- Propriétaire École A : un membre actif avec `role='owner'`.
- Élève A1 : un utilisateur lié à un seul enregistrement `students`.
- École B / Élève B1 : à créer dans un environnement de test séparé pour les tests inter-écoles.

Aucun rôle Employé ou Instructeur n'est actif. Les moniteurs sont enregistrés par nom dans les leçons pratiques.

## Résultats vérifiés sur la base de démonstration
Au 26 novembre 2026, les tests SQL ont été exécutés avec `SET LOCAL ROLE authenticated` et le sujet JWT correspondant :

| Vérification | Propriétaire | Élève |
|---|---:|---:|
| Appartenance à l'école | Autorisée | Non applicable |
| Vérification du rôle owner | Vrai | Faux |
| Voir l'école liée | 1 | 1 |
| Voir les dossiers élèves de l'école | 1 | Son propre dossier seulement |
| Voir les demandes école | 2 | Ses 2 demandes seulement |
| Voir les adhésions du personnel | 4 | 0 |
| Voir les sorties pratiques | 15 | Ses 15 lignes de progression |
| Voir la progression théorique | 12 lignes | Ses 12 lignes |

Les identifiants visibles dans la base sont ceux du jeu de démonstration. Aucun autre établissement n'est actuellement présent, donc les tests croisés A/B sont encore requis.

## Tests métier effectués dans des transactions annulées
- Planifier puis valider une sortie pratique avec un nom de moniteur, sans compte instructeur.
- Passer une demande de théorie de `submitted` à `processing` en utilisant le propriétaire.
- Créer un contrat de 1 250 CAD, une facture, puis un paiement de 250 CAD.
- Vérifier le solde calculé : facture 1 250 CAD, payé 250 CAD, restant 1 000 CAD.
- Chaque scénario utilise `ROLLBACK` : aucun changement de test n'est conservé dans les données de démonstration.
- Les fonctions financières sont maintenant `SECURITY INVOKER` et restent soumises aux politiques RLS owner-only.

## Résultats attendus à valider avec deux écoles
| Test | Attendu |
|---|---|
| Owner A lit les élèves de A | Autorisé |
| Owner A lit les élèves de B | Refusé |
| Élève A lit son propre dossier | Autorisé |
| Élève A lit un élève B | Refusé |
| Élève A crée une demande pour un autre élève | Refusé |
| Élève écrit directement sa progression | Refusé |
| Élève consulte les factures d'un autre élève | Refusé |
| Propriétaire A modifie le contrat d'un élève B | Refusé |
| Compte École suspendu ouvre le portail | Refusé |
| Employé/Instructeur ancien compte sans adhésion active | Refusé |

## Notes d'exécution
- Le test avec `service_role` seul ne valide pas RLS, car ce rôle contourne les politiques.
- Vérifier les comptes et les identifiants de connexion par l'interface après le déploiement.
- Contrôler l'accès aux objets Storage, pas seulement les métadonnées SQL.
- Refaire une passe de test lorsque deux écoles de démonstration existent.
