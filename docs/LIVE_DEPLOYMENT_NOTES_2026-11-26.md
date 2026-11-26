# ConduiPRO — état du déploiement et de la base (2026-11-26)

## Application
- Dépôt : `Elzinawael/LePlateformeCPro`.
- Hébergement : Hostinger, Next.js standalone, Node.js 22.
- Projet Supabase : `nahjdhvjozrvdgmjdbws`, Canada Central.
- Le commit `0ab04ec44cdea8f6a767b75a38435306ec987e33` a corrigé PostCSS à 8.5.33 ; npm audit, ESLint et build de production étaient verts.
- Des changements fonctionnels ultérieurs ont été ajoutés ; toujours vérifier la dernière exécution GitHub Actions et l'état Hostinger avant de considérer la dernière version publiée.

## Modèle de comptes actif
- Administrateur ConduiPRO dans `public.platform_admins`.
- Un propriétaire actif par école (`school_members.role='owner'`).
- Compte élève distinct créé automatiquement depuis le portail école.
- Aucun employé ou instructeur connecté. Le moniteur pratique est un champ texte sur la sortie.
- Les comptes secondaires du jeu de test sont désactivés et ne possèdent plus d'adhésion active.

## École de démonstration
- École : `ConduiPRO — École de démonstration`.
- Code école : `CP-6B224C`.
- Compte plateforme / propriétaire de démonstration : `elzinawael@gmail.com`.
- Élève de démonstration : `DEMO-2026-001`, en phase 2.
- Données initiales : cinq modules de phase 1 terminés, deux demandes en attente et une sortie pratique planifiée avec `Moniteur de démonstration`.

## Sécurité et RLS
- Helpers RLS déplacés dans le schéma privé non exposé.
- Toutes les policies scolaires qui autorisent des opérations opérationnelles sont owner-only.
- Rôles Admin/Employee/Instructor supprimés du modèle de membership actif.
- Finance RPC en SECURITY INVOKER, avec RLS owner-only.
- Bucket privé `student-documents`.
- Toutes les clés étrangères publiques signalées sans index ont reçu un index.
- Les tests métier de sortie pratique, demande et finance utilisent des transactions rollback.

## Modèle financier
- Contrat actif unique par élève et école.
- Enregistrement du contrat crée ou met à jour la facture associée.
- Paiement atomique avec verrou de facture et contrôle du solde restant.
- Test transactionnel : contrat CAD 1 250, acompte CAD 250, solde CAD 1 000 ; transaction annulée.

## Routes et parcours principaux
- `/admin` : création, listing, suspension et réactivation des écoles.
- `/school` : tableau de bord temps réel de l'école.
- `/school/students` : création automatique des comptes élèves et dossiers.
- `/school/students/[id]` : profil, progression, contrat, facture et paiements.
- `/school/courses` : planification des séances théoriques.
- `/school/requests` : traitement des demandes élèves.
- `/school/practical` : planification/validation des sorties avec moniteur texte.
- `/school/documents` : revue des permis d'apprenti.
- `/student` : progression, demandes, permis, contrat et solde.
- L'ancien `/setup/first-school` et l'API bootstrap sont désactivés.

## À vérifier avant les premiers vrais clients
- Déploiement Hostinger du commit de production final.
- Test visuel réel des formulaires et du changement de mot de passe initial.
- SMTP et récupération de compte propriétaire.
- Test cross-tenant avec une deuxième école.
- Protection contre mots de passe compromis dans Supabase Auth selon disponibilité du plan.
