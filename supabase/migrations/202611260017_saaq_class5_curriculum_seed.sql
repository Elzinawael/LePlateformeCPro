-- ConduiPRO — SAAQ PESR class 5 curriculum seed and student progress initialization
-- Source: https://saaq.gouv.qc.ca/permis-conduire/cours-conduite/automobile
-- 4 phases, 12 theory modules (120 minutes each), 15 on-road sessions (55 minutes each).
-- Phase 1: modules 1-5; Phase 2: module 6-7 + outings 1-4;
-- Phase 3: modules 8-10 + outings 5-10; Phase 4: modules 11-12 + outings 11-15.

insert into public.curriculum_phases
  (school_id, phase_number, name, description, sort_order, is_active)
values
  (null, 1, 'Préalable au permis d’apprenti conducteur', 'Durée minimale de 28 jours. Théorie : modules 1 à 4 et évaluation du module 5. La réussite permet d’obtenir le permis d’apprenti conducteur.', 1, true),
  (null, 2, 'Conduite dirigée', 'Durée minimale de 28 jours. Modules 6 et 7, puis sorties routières 1 à 4 en conduite dirigée.', 2, true),
  (null, 3, 'Conduite semi-dirigée', 'Durée minimale de 56 jours. Modules 8 à 10 et sorties routières 5 à 10.', 3, true),
  (null, 4, 'Conduite semi-dirigée à autonome', 'Durée minimale de 56 jours. Modules 11 et 12 et sorties routières 11 à 15, dont la sortie 15 de synthèse.', 4, true)
on conflict (phase_number) where school_id is null
do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.curriculum_modules
  (phase_id, module_number, name, description, duration_minutes, sort_order, is_required, is_active)
select
  p.id,
  m.module_number,
  m.name,
  m.description,
  120,
  m.module_number,
  true,
  true
from (
  values
    (1, 1, 'Le véhicule', 'Notions relatives au véhicule de promenade.'),
    (1, 2, 'Le conducteur', 'Profil et comportements du conducteur.'),
    (1, 3, 'L’environnement', 'Environnement routier et contexte de circulation.'),
    (1, 4, 'Comportements à risque', 'Prise de conscience et prévention des comportements à risque.'),
    (1, 5, 'Évaluation', 'Évaluation théorique de l’école; la réussite permet d’obtenir le permis d’apprenti conducteur.'),
    (2, 6, 'La conduite accompagnée', 'Notions relatives à la conduite accompagnée et à la conduite dirigée.'),
    (2, 7, 'La stratégie OEA', 'Apprentissage et application de la stratégie OEA.'),
    (3, 8, 'La vitesse', 'Gestion de la vitesse et des risques associés.'),
    (3, 9, 'Le partage de la route', 'Partage de la route avec les autres usagers, notamment les usagers vulnérables et les véhicules lourds.'),
    (3, 10, 'Alcool et drogues', 'Effets de l’alcool et des drogues sur la conduite.'),
    (4, 11, 'Fatigue et distractions', 'Prévention de la fatigue et des distractions au volant.'),
    (4, 12, 'L’écoconduite', 'Principes d’écoconduite.')
) as m(phase_number,module_number,name,description)
join public.curriculum_phases p
  on p.school_id is null and p.phase_number = m.phase_number
on conflict (phase_id,module_number)
do update set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  sort_order = excluded.sort_order,
  is_required = true,
  is_active = true;

insert into public.practical_lessons
  (phase_id, lesson_number, name, description, duration_minutes, sort_order, is_required, is_active)
select
  p.id,
  s.lesson_number,
  'Sortie ' || s.lesson_number,
  s.description,
  55,
  s.lesson_number,
  true,
  true
from (
  values
    (2, 1, 'Premières sorties en conduite dirigée.'),
    (2, 2, 'Conduite dirigée dans des environnements simples.'),
    (2, 3, 'Mise en pratique des manœuvres de base.'),
    (2, 4, 'Consolidation de la conduite dirigée.'),
    (3, 5, 'Évaluation pratique à la sortie 5 et conduite semi-dirigée.'),
    (3, 6, 'Conduite semi-dirigée dans des environnements diversifiés.'),
    (3, 7, 'Consolidation des manœuvres et comportements sécuritaires.'),
    (3, 8, 'Partage de la route dans différents contextes.'),
    (3, 9, 'Conduite semi-dirigée et gestion des risques.'),
    (3, 10, 'Évaluation pratique à la sortie 10.'),
    (4, 11, 'Conduite plus autonome et gestion de la fatigue.'),
    (4, 12, 'Conduite plus autonome et prévention des distractions.'),
    (4, 13, 'Approfondissement des manœuvres et comportements sécuritaires.'),
    (4, 14, 'Conduite dans des environnements diversifiés.'),
    (4, 15, 'Sortie de synthèse préparatoire à l’examen pratique de la SAAQ.')
) as s(phase_number,lesson_number,description)
join public.curriculum_phases p
  on p.school_id is null and p.phase_number = s.phase_number
on conflict (phase_id,lesson_number)
do update set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  sort_order = excluded.sort_order,
  is_required = true,
  is_active = true;

-- New student records start in Phase 1 unless staff explicitly selected a phase.
create or replace function public.set_student_initial_phase()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.current_phase_id is null then
    select p.id
      into new.current_phase_id
    from public.curriculum_phases p
    where p.phase_number = 1
      and (p.school_id = new.school_id or p.school_id is null)
    order by (p.school_id is null) asc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists students_initial_phase_assignment on public.students;
create trigger students_initial_phase_assignment
before insert on public.students
for each row execute function public.set_student_initial_phase();

-- A student receives a not-started progress row for every module and lesson
-- in their school's curriculum (school-specific phase overrides global template).
create or replace function public.initialize_student_learning_progress()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  with chosen_phases as (
    select coalesce(school_phase.id, global_phase.id) as phase_id
    from generate_series(1, 4) as n(phase_number)
    left join public.curriculum_phases school_phase
      on school_phase.school_id = new.school_id
     and school_phase.phase_number = n.phase_number
    left join public.curriculum_phases global_phase
      on global_phase.school_id is null
     and global_phase.phase_number = n.phase_number
    where coalesce(school_phase.id, global_phase.id) is not null
  )
  insert into public.student_module_progress
    (school_id, student_id, module_id, status)
  select new.school_id, new.id, m.id, 'not_started'
  from public.curriculum_modules m
  join chosen_phases p on p.phase_id = m.phase_id
  on conflict (student_id, module_id) do nothing;

  with chosen_phases as (
    select coalesce(school_phase.id, global_phase.id) as phase_id
    from generate_series(1, 4) as n(phase_number)
    left join public.curriculum_phases school_phase
      on school_phase.school_id = new.school_id
     and school_phase.phase_number = n.phase_number
    left join public.curriculum_phases global_phase
      on global_phase.school_id is null
     and global_phase.phase_number = n.phase_number
    where coalesce(school_phase.id, global_phase.id) is not null
  )
  insert into public.student_practical_progress
    (school_id, student_id, lesson_id, status)
  select new.school_id, new.id, l.id, 'not_started'
  from public.practical_lessons l
  join chosen_phases p on p.phase_id = l.phase_id
  on conflict (student_id, lesson_id) do nothing;

  return new;
end;
$$;

drop trigger if exists students_initialize_learning_progress on public.students;
create trigger students_initialize_learning_progress
after insert on public.students
for each row execute function public.initialize_student_learning_progress();

-- Trigger functions are not callable as ordinary API functions.
revoke all on function public.set_student_initial_phase() from public, anon, authenticated;
revoke all on function public.initialize_student_learning_progress() from public, anon, authenticated;
