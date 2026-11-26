# ConduiPRO — sécurité et isolation multi-écoles

## Modèle d'identité
- Les opérateurs de la plateforme sont inscrits dans `public.platform_admins`.
- Chaque école possède un seul rôle opérationnel : `owner`.
- Les élèves sont des profils séparés, liés à `students.user_id`.
- Aucun rôle Employé ou Instructeur n'est autorisé dans `school_members`. Le nom du moniteur est une donnée de planification, pas un compte utilisateur.

## Frontières d'autorisation
- Les routes `/admin`, `/school` et `/student` sont protégées par middleware serveur.
- L'administrateur de plateforme provisionne les écoles via une route serveur qui utilise la clé Supabase uniquement côté serveur.
- Un propriétaire ne peut lire ou modifier que les données de son école.
- Un élève peut lire uniquement son dossier et ses données pédagogiques, demandes, permis, contrat et solde.
- Les écritures de progression, changements de phase, décisions sur les demandes, revues de permis, contrats et paiements sont soumises à des contrôles serveur et aux politiques RLS.
- Les documents sont conservés dans le bucket privé `student-documents`, avec un chemin par école et élève et des URL signées de courte durée.

## Fonctions SQL internes
Les helpers RLS `private.is_school_member`, `private.has_school_role` et `private.current_student_id` sont placés dans le schéma non exposé `private`. Les anciennes fonctions publiques ne sont plus exécutables par les clients authentifiés ou anonymes.

Les fonctions métier de traitement des demandes et de vérification des permis contrôlent explicitement le rôle `owner`. Les fonctions financières utilisent `SECURITY INVOKER`, de sorte que les mêmes privilèges et politiques RLS que le propriétaire s'appliquent.

## Provisionnement des comptes
- Le mot de passe temporaire d'un propriétaire est généré côté serveur et affiché une seule fois après la création de l'école.
- Le compte élève est créé automatiquement avec le code école et le numéro de contrat comme identifiants métier.
- Le mot de passe initial élève suit la règle définie dans le cahier des charges et doit être changé à la première connexion.
- Les routes de bootstrap historiques qui créaient des comptes Employé/Instructeur sont désactivées.
- Ne jamais transmettre `SUPABASE_SECRET_KEY` au navigateur ou au dépôt Git.

## Finance
- Un seul contrat actif par élève et école.
- La sauvegarde du contrat crée ou met à jour la facture correspondante.
- Les paiements verrouillent la facture, vérifient le solde restant et refusent un paiement supérieur au montant dû.
- Le solde élève est calculé à partir des factures ouvertes et des paiements enregistrés.

## État et limites connues
- Le test de démonstration confirme les portées propriétaire/élève dans le même établissement.
- Les tests multi-écoles complets (école A contre école B) et les essais de navigation réels sur les écrans de production restent à compléter.
- Supabase signale encore la protection des mots de passe compromis comme désactivée. L'activation se configure dans Authentication > Password security et dépend du plan Supabase.
- Les avis d'information RLS sur les tables internes `conduipro_bootstrap_guard` et `instructor_student_assignments` reflètent des tables sans accès client ; elles ne sont pas exposées aux comptes de l'application.
