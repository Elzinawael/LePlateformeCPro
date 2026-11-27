# ConduiPRO — checklist de recette V1

Cette checklist sert à vérifier les parcours de la première version après déploiement Hostinger.

## A. Administrateur de la plateforme

- [ ] Connexion avec le compte administrateur ConduiPRO.
- [ ] L'espace /admin est accessible.
- [ ] Créer une école avec un courriel propriétaire inédit.
- [ ] Vérifier que code école et mot de passe temporaire sont affichés une seule fois.
- [ ] Vérifier le compte propriétaire et l'adhésion active dans Supabase.
- [ ] Déconnexion.
- [ ] Se connecter comme propriétaire avec le mot de passe temporaire.
- [ ] Vérifier que la modification du mot de passe est imposée.
- [ ] Suspendre une école et vérifier que ses utilisateurs ne peuvent plus ouvrir les portails.
- [ ] Réactiver l'école et confirmer le rétablissement des accès.

## B. Propriétaire d'école — élèves

- [ ] Créer un élève avec un numéro de contrat unique.
- [ ] Vérifier que la fiche élève, le profil Auth et les progressions de formation sont créés.
- [ ] Vérifier que la réponse affiche code école, numéro de contrat et mot de passe initial.
- [ ] Tenter de créer le même numéro de contrat une deuxième fois : l'opération doit être refusée.
- [ ] Ouvrir le dossier détaillé de l'élève.
- [ ] Modifier ses coordonnées et confirmer la persistance après rechargement.
- [ ] Créer le contrat et sa facture.
- [ ] Déposer un PDF de contrat et vérifier son accès privé.

## C. Propriétaire d'école — formation théorique

- [ ] Créer une séance future sur un module actif.
- [ ] Vérifier que capacité, date, heure et lieu sont conservés.
- [ ] Tenter de choisir une date passée ou une capacité invalide : l'opération doit être refusée.
- [ ] Se connecter comme élève et vérifier que seules les séances des modules non terminés dans la phase courante sont proposées.
- [ ] Envoyer une demande théorique.
- [ ] Dans l'espace École, passer la demande en traitement.
- [ ] Approuver la demande et vérifier la réservation d'une place.
- [ ] Vérifier que la demande apparaît avec son statut et sa réponse dans l'espace Élève.

## D. Propriétaire d'école — formation pratique

- [ ] Envoyer une demande pratique avec plusieurs plages de disponibilité depuis le compte Élève.
- [ ] Vérifier que l'élève ne peut pas sélectionner une date précise pour cette demande.
- [ ] L'école met la demande en traitement, l'approuve ou la refuse avec une réponse.
- [ ] Depuis /school/practical, planifier une sortie avec date et heure locales.
- [ ] Vérifier la durée de 55 minutes et le blocage d'un chevauchement pour le même élève.
- [ ] Valider une sortie passée comme terminée.
- [ ] Vérifier le statut dans le dossier élève et le portail Élève.

## E. Permis d'apprenti conducteur

- [ ] Vérifier que le dépôt est verrouillé avant la réussite des modules 1 à 5.
- [ ] Après validation de l'évaluation du module 5, vérifier que l'instruction de la démarche SAAQ apparaît.
- [ ] Déposer un fichier PDF/JPG/PNG valide de 10 Mo maximum.
- [ ] L'école ouvre le lien signé temporaire.
- [ ] Approuver le permis et vérifier la mise à jour atomique des statuts.
- [ ] Tester un refus avec motif obligatoire et un nouveau dépôt.

## F. Finances

- [ ] Enregistrer le montant du contrat.
- [ ] Vérifier la création/actualisation de la facture.
- [ ] Enregistrer un paiement partiel et vérifier le nouveau solde.
- [ ] Tenter un paiement supérieur au solde : l'opération doit être refusée.
- [ ] Vérifier le contrat et le solde depuis le compte Élève.

## G. Isolation et contrôles négatifs

- [ ] Un élève A ne peut pas lire le dossier de l'élève B en modifiant une URL.
- [ ] Une école A ne peut pas consulter les dossiers, cours ou demandes de l'école B.
- [ ] Un compte Élève ne peut pas ouvrir /school ou /admin.
- [ ] Un compte propriétaire ne peut pas ouvrir /admin sans appartenance à platform_admins.
- [ ] Les anciennes identités de démonstration admin/employee/instructor sont incapables d'accéder au portail école.
- [ ] Vérifier qu'aucune route d'inscription publique ne crée de compte.

## Environnement et limites de recette

- La CI vérifie ESLint, l'audit des dépendances et le build Next.js.
- Les tests réels de courriel, de session navigateur, de dépôt Storage et d'interface mobile doivent être réalisés sur Hostinger après fusion et déploiement.
- Supabase Auth « leaked password protection » reste à activer dans le tableau de bord Auth du projet.
