-- Murshid synthetic seed data. SYNTHETIC ONLY: every person is fictional ("<Name> Test").
-- Fixed UUIDs (valid v4 layout) so tests and other teams can reference rows:
--   schools a0.. | students b0.. | guardians c0.. | staff d0.. | goals e0.. | milestones e1..
--   courses f0.. | materials f1.. | chunks f2.. | opp sources 90.. | opportunities 91..
--   tasks 92.. | calendar 93.. | applications 94.. | achievements 95.. | cv 96..
--   notifications 97.. | connections 98.. | consent 99.. | audit 9a.. | auth users 0a.. (students) 0b.. (guardians) 0c.. (staff)
-- Reference "today" when written: 2026-10-10 (Asia/Dubai).

begin;

-- ---------- schools ----------
insert into public.schools (id, name, emirate, curriculum, lms, domain) values
  ('a0000000-0000-4000-8000-000000000001', 'Al Noor British Academy (Test)', 'dubai', 'british', 'google_classroom', 'alnoor-british.test'),
  ('a0000000-0000-4000-8000-000000000002', 'Desert Rose Indian School (Test)', 'dubai', 'indian_cbse', 'teams', 'desertrose-cbse.test');

-- ---------- students (13-17) ----------
insert into public.students (id, auth_user_id, full_name, preferred_name, date_of_birth, grade, school_id, curriculum, emirate, nationality, languages, interests, strengths) values
  ('b0000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'Aisha Test', 'Aisha', '2009-03-14', 12, 'a0000000-0000-4000-8000-000000000001', 'british', 'dubai', 'AE',
     '{en,ar}', '{medicine,biology,debate}', '{public speaking,research,organisation}'),
  ('b0000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000002', 'Rohan Test', 'Rohan', '2010-06-02', 11, 'a0000000-0000-4000-8000-000000000002', 'indian_cbse', 'dubai', 'IN',
     '{en,hi}', '{computer science,robotics,cricket}', '{programming,maths,teamwork}'),
  ('b0000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000003', 'Mariam Test', null, '2013-01-20', 8, 'a0000000-0000-4000-8000-000000000001', 'british', 'sharjah', 'EG',
     '{ar,en}', '{art,environment}', '{drawing,creativity}'),
  ('b0000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000004', 'Arjun Test', 'AJ', '2011-09-05', 10, 'a0000000-0000-4000-8000-000000000002', 'indian_cbse', 'dubai', 'IN',
     '{en,ml,hi}', '{economics,chess,entrepreneurship}', '{analysis,strategy}'),
  ('b0000000-0000-4000-8000-000000000005', '0a000000-0000-4000-8000-000000000005', 'Layla Test', 'Layla', '2012-04-11', 9, 'a0000000-0000-4000-8000-000000000001', 'british', 'dubai', 'PK',
     '{en,ur}', '{football,product design}', '{sketching,fitness}');

-- ---------- guardians ----------
insert into public.guardians (id, student_id, auth_user_id, name, email, phone, relation, consent_status, verified_at) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001', 'Fatima Test', 'fatima.test@example.org', '+971500000001', 'mother', 'granted', '2026-09-01T08:00:00+04:00'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '0b000000-0000-4000-8000-000000000002', 'Suresh Test', 'suresh.test@example.org', '+971500000002', 'father', 'granted', '2026-09-03T19:30:00+04:00'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', null,                                   'Omar Test',   'omar.test@example.org',   '+971500000003', 'father', 'pending', null),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', '0b000000-0000-4000-8000-000000000004', 'Priya Test',  'priya.test@example.org',  '+971500000004', 'mother', 'granted', '2026-09-10T20:15:00+04:00'),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', '0b000000-0000-4000-8000-000000000005', 'Sana Test',   'sana.test@example.org',   null,            'mother', 'granted', '2026-09-12T09:00:00+04:00');

-- ---------- counsellors ----------
insert into public.school_staff (id, auth_user_id, school_id, full_name, email, role) values
  ('d0000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Ms Helen Test', 'helen.test@alnoor-british.test', 'counsellor'),
  ('d0000000-0000-4000-8000-000000000002', '0c000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Mr Ravi Test',  'ravi.test@desertrose-cbse.test', 'counsellor');

-- ---------- consent records ----------
insert into public.consent_records (id, student_id, guardian_id, granted_by, scope, status, method, granted_at, revoked_at, created_at) values
  ('99000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'guardian', 'account',           'granted', 'email_link', '2026-09-01T08:00:00+04:00', null, '2026-09-01T08:00:00+04:00'),
  ('99000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'guardian', 'connectors',        'granted', 'email_link', '2026-09-01T08:01:00+04:00', null, '2026-09-01T08:01:00+04:00'),
  ('99000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'guardian', 'counsellor_access', 'granted', 'email_link', '2026-09-01T08:02:00+04:00', null, '2026-09-01T08:02:00+04:00'),
  ('99000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'guardian', 'account',           'granted', 'otp',        '2026-09-03T19:30:00+04:00', null, '2026-09-03T19:30:00+04:00'),
  ('99000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'guardian', 'connectors',        'granted', 'otp',        '2026-09-03T19:31:00+04:00', null, '2026-09-03T19:31:00+04:00'),
  ('99000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'guardian', 'counsellor_access', 'granted', 'otp',        '2026-09-03T19:32:00+04:00', null, '2026-09-03T19:32:00+04:00'),
  ('99000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'guardian', 'account',           'pending', 'email_link', null, null,                        '2026-10-08T17:00:00+04:00'),
  ('99000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'guardian', 'account',           'granted', 'email_link', '2026-09-10T20:15:00+04:00', null, '2026-09-10T20:15:00+04:00'),
  ('99000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'guardian', 'counsellor_access', 'granted', 'email_link', '2026-09-10T20:16:00+04:00', null, '2026-09-10T20:16:00+04:00'),
  ('99000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'guardian', 'counsellor_access', 'revoked', 'in_app',     null, '2026-10-01T21:00:00+04:00', '2026-10-01T21:00:00+04:00'),
  ('99000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'guardian', 'account',           'granted', 'email_link', '2026-09-12T09:00:00+04:00', null, '2026-09-12T09:00:00+04:00');

-- ---------- goals + milestones ----------
insert into public.goals (id, student_id, title, category, target_date, status, parent_goal_id, progress) values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Get into a UK medical school', 'university', '2027-09-01', 'active', null, 35),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Score 2700+ on the UCAT', 'academic', '2027-07-31', 'active', 'e0000000-0000-4000-8000-000000000001', 20),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Complete 40 hours of clinical volunteering', 'personal', '2027-06-30', 'active', 'e0000000-0000-4000-8000-000000000001', 50),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'Qualify for the national informatics olympiad', 'academic', '2027-01-31', 'active', null, 40),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'Score 95%+ in Class 11 Computer Science', 'academic', '2027-03-15', 'active', null, 60),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000003', 'Enter a school art competition', 'skill', '2026-12-15', 'active', null, 10),
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000004', 'Launch a small online business', 'career', '2027-04-30', 'active', null, 25),
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000004', 'Reach 1600 chess rating', 'skill', '2027-02-28', 'paused', null, 70),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000005', 'Make the school U15 football team', 'sport', '2026-11-30', 'active', null, 55),
  ('e0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000005', 'Build a product design portfolio', 'skill', '2027-05-31', 'active', null, 15);

insert into public.milestones (id, goal_id, title, due_date, done) values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Shortlist 4 medical schools', '2026-11-15', true),
  ('e1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Draft personal statement', '2027-06-30', false),
  ('e1000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000002', 'Finish first full UCAT mock', '2026-11-01', false),
  ('e1000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000003', 'Log 20 hours at clinic', '2026-12-31', true),
  ('e1000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000004', 'Solve 50 past olympiad problems', '2026-12-01', false),
  ('e1000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000004', 'Register for selection round', '2026-11-10', true),
  ('e1000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000006', 'Pick a theme and do 3 sketches', '2026-10-31', false),
  ('e1000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000007', 'Validate idea with 10 classmates', '2026-11-20', true),
  ('e1000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000007', 'Build a landing page', '2027-01-15', false),
  ('e1000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-000000000009', 'Attend 8 training sessions', '2026-11-15', false);

-- ---------- courses + materials ----------
insert into public.courses (id, student_id, name, teacher, source, external_id) values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'A-Level Biology (Y12)', 'Mr Daniel Test', 'google_classroom', 'gc-bio-12a'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'A-Level Chemistry (Y12)', 'Dr Noura Test', 'google_classroom', 'gc-chem-12a'),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'Class 11 Computer Science', 'Mrs Anjali Test', 'teams', 'teams-cs-11b'),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'Class 11 Physics', 'Mr Kiran Test', 'teams', 'teams-phy-11b'),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'Year 8 Science', 'Ms Rachel Test', 'google_classroom', 'gc-sci-8c'),
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000004', 'Class 10 Economics', 'Mr Joseph Test', 'teams', 'teams-eco-10a'),
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000004', 'Class 10 Mathematics', 'Mrs Shalini Test', 'manual', null),
  ('f0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000005', 'GCSE Design & Technology', 'Mr Tom Test', 'google_classroom', 'gc-dt-9a');

insert into public.materials (id, course_id, title, kind, body_text, file_url, due_at, source, external_id) values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Cell membranes and transport - notes', 'note',
     'Fluid mosaic model: phospholipid bilayer with embedded proteins. Diffusion, facilitated diffusion, osmosis and active transport move substances across membranes.', null, null, 'google_classroom', 'gc-mat-1001'),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'Enzyme kinetics practical write-up', 'assignment',
     'Write up the catalase practical: method, results table, rate graph and evaluation. 1,200 words max.', 'https://example.org/files/enzyme-practical.pdf', '2026-10-16T23:59:00+04:00', 'google_classroom', 'gc-mat-1002'),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'Unit 2 test: Energetics', 'exam',
     'Covers enthalpy changes, Hess''s law, bond enthalpies and calorimetry.', null, '2026-10-22T08:00:00+04:00', 'google_classroom', 'gc-mat-2001'),
  ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000003', 'Python lists and dictionaries worksheet', 'assignment',
     'Complete questions 1-15 on list comprehension and dictionary methods. Submit as a .py file.', 'https://example.org/files/cs-worksheet-4.pdf', '2026-10-14T20:00:00+04:00', 'teams', 'teams-asg-301'),
  ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000004', 'Periodic test schedule announced', 'announcement',
     'Periodic Test 2 for Physics will be held on 28 October. Syllabus: Laws of Motion, Work Energy and Power.', null, null, 'teams', 'teams-ann-401'),
  ('f1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000005', 'Ecosystems project brief', 'assignment',
     'Create a poster about a UAE ecosystem (mangroves, desert or coral reef) showing a food web.', null, '2026-10-29T15:00:00+04:00', 'google_classroom', 'gc-mat-5001'),
  ('f1000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000006', 'Chapter 2: Sectors of the Indian Economy', 'note',
     'Primary, secondary and tertiary sectors; organised vs unorganised sectors; GDP contribution and employment.', null, null, 'teams', 'teams-mat-601'),
  ('f1000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000008', 'Design brief: sustainable lamp', 'assignment',
     'Research three existing lamps, then sketch five concepts for a lamp made from recycled materials.', null, '2026-11-05T15:00:00+04:00', 'google_classroom', 'gc-mat-8001');

-- deterministic synthetic 768-d embeddings (not from a model)
insert into public.material_chunks (id, material_id, chunk_index, chunk_text, embedding)
select v.id::uuid, v.material_id::uuid, v.idx, v.txt,
       (select array_agg(sin(i * v.seed)::real order by i) from generate_series(1, 768) as i)::extensions.vector(768)
from (values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 0, 'Fluid mosaic model: phospholipid bilayer with embedded proteins.', 0.11),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 1, 'Diffusion, facilitated diffusion, osmosis and active transport move substances across membranes.', 0.23),
  ('f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000007', 0, 'Primary, secondary and tertiary sectors; organised vs unorganised sectors.', 0.37)
) as v(id, material_id, idx, txt, seed);

-- ---------- opportunity sources + 25 opportunities ----------
insert into public.opportunity_sources (id, name, url, kind, active, last_crawled_at) values
  ('90000000-0000-4000-8000-000000000001', 'Manual curation (seed)', null, 'manual', true, '2026-10-09T06:00:00+04:00'),
  ('90000000-0000-4000-8000-000000000002', 'Example UAE youth opportunities feed', 'https://example.org/feeds/uae-youth.xml', 'rss', true, '2026-10-10T06:00:00+04:00');

insert into public.opportunities (id, title, organizer, type, url, emirate, country, min_grade, max_grade, eligibility_text, nationality_restriction, cost_aed, deadline, tags, source_id, last_seen_at, status) values
  ('91000000-0000-4000-8000-000000000001', 'Emirates Young Scientists Challenge 2027', 'Emirates Science Forum (fictional)', 'competition', 'https://example.org/opportunities/young-scientists-2027', 'dubai', 'AE', 9, 12,
     'Teams of 2-3 students enrolled in a UAE school. Project must include an original experiment.', null, 0, '2026-12-15T23:59:00+04:00', '{science,research,stem}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000002', 'Gulf Junior Mathematics Olympiad', 'Gulf Maths Circle (fictional)', 'olympiad', 'https://example.org/opportunities/gulf-junior-maths', null, 'AE', 6, 10,
     'Individual entry via school coordinator. Two rounds: online qualifier and in-person final in Abu Dhabi.', null, 50, '2026-11-20T23:59:00+04:00', '{maths,stem}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000003', 'UAE National Informatics Olympiad - Selection Round', 'UAE Computing Olympiad Committee (fictional)', 'olympiad', 'https://example.org/opportunities/uae-informatics-olympiad', null, 'AE', 8, 12,
     'Open to students of any nationality enrolled in a UAE school. C++, Java or Python.', null, 0, '2026-11-10T23:59:00+04:00', '{coding,algorithms,stem}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000004', 'Dubai Youth Model United Nations 2027', 'Dubai Youth Diplomacy Network (fictional)', 'mun', 'https://example.org/opportunities/dubai-youth-mun-2027', 'dubai', 'AE', 8, 13,
     'Delegations or individual delegates. Position paper required before the conference.', null, 350, '2027-01-10T23:59:00+04:00', '{debate,public speaking,leadership}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000005', 'Abu Dhabi Schools Model UN', 'Capital Schools MUN Society (fictional)', 'mun', 'https://example.org/opportunities/ad-schools-mun', 'abu_dhabi', 'AE', 9, 13,
     'School delegations of up to 12 students; individual applications accepted for press corps.', null, 400, '2027-02-01T23:59:00+04:00', '{debate,international relations}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000006', 'Sharjah Heritage Volunteers Winter Programme', 'Sharjah Heritage Friends (fictional)', 'volunteering', 'https://example.org/opportunities/sharjah-heritage-winter', 'sharjah', 'AE', 8, 12,
     'Ages 13-17 with parent consent. Weekend shifts guiding visitors at heritage sites.', null, 0, '2026-11-30T23:59:00+04:00', '{culture,community,heritage}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000007', 'Dubai Youth Volunteer Corps - Community Kitchens', 'Dubai Giving Collective (fictional)', 'volunteering', 'https://example.org/opportunities/dubai-community-kitchens', 'dubai', 'AE', 9, 13,
     'Minimum 10 hours per term. Certificate issued after completion.', null, 0, null, '{community,food security}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000008', 'Hamdan Innovation Hackathon for Schools', 'Dubai Future Makers Lab (fictional)', 'hackathon', 'https://example.org/opportunities/innovation-hackathon-schools', 'dubai', 'AE', 9, 13,
     '48-hour hackathon on smart-city challenges. Teams of 3-5; mentors provided.', null, 0, '2026-12-01T23:59:00+04:00', '{coding,smart city,ai,teamwork}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000009', 'Global Climate Code Jam (Online)', 'Open Climate Youth (fictional)', 'hackathon', 'https://example.org/opportunities/climate-code-jam', null, 'XX', 8, 13,
     'Online, worldwide. Build a tool that helps a community adapt to heat or water scarcity.', null, 0, '2026-11-25T23:59:00+04:00', '{climate,coding,sustainability}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-00000000000a', 'Youth Research Summer Internship in Clean Energy', 'Abu Dhabi Clean Energy Institute (fictional)', 'internship', 'https://example.org/opportunities/clean-energy-summer-internship', 'abu_dhabi', 'AE', 11, 13,
     'Six-week lab placement. Must be 16+ by 1 July 2027. Strong maths and physics grades.', null, 0, '2027-03-01T23:59:00+04:00', '{energy,research,engineering}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-00000000000b', 'Hospital Shadowing Week for Future Doctors', 'Dubai Community Hospital (fictional)', 'internship', 'https://example.org/opportunities/hospital-shadowing-week', 'dubai', 'AE', 11, 13,
     'Students aged 16+ considering medicine. Includes ward observation and a reflective log.', null, 500, '2026-11-15T23:59:00+04:00', '{medicine,healthcare,shadowing}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-00000000000c', 'Aviation Discovery Internship', 'Gulf Skies Aviation Academy (fictional)', 'internship', 'https://example.org/opportunities/aviation-discovery', 'dubai', 'AE', 10, 12,
     'Two-week rotation across engineering, operations and customer experience.', null, 0, '2027-02-15T23:59:00+04:00', '{aviation,engineering,careers}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-00000000000d', 'Sharjah Merit Scholarship for Grade 12', 'Sharjah Education Endowment (fictional)', 'scholarship', 'https://example.org/opportunities/sharjah-merit-scholarship', 'sharjah', 'AE', 12, 13,
     'Final-year students with 90%+ average; covers first-year university tuition in the UAE.', 'UAE nationals only', 0, '2027-03-31T23:59:00+04:00', '{scholarship,university}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-00000000000e', 'Diaspora STEM Scholarship - UAE Chapter', 'Overseas Indian STEM Foundation (fictional)', 'scholarship', 'https://example.org/opportunities/diaspora-stem-scholarship', null, 'AE', 11, 12,
     'Students in CBSE/ICSE schools in the UAE planning STEM degrees. Essay plus interview.', 'Indian nationals / OCI holders', 0, '2027-01-31T23:59:00+04:00', '{scholarship,stem,university}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-00000000000f', 'Global Young Leaders Summer School, London', 'Global Leaders Education Trust (fictional)', 'summer_program', 'https://example.org/opportunities/young-leaders-london', null, 'GB', 10, 13,
     'Residential two-week programme. Visa and travel arranged by participants.', null, 18500, '2027-03-15T23:59:00+04:00', '{leadership,residential,international}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000010', 'Summer Program in Computer Science', 'Saadiyat University Outreach (fictional)', 'summer_program', 'https://example.org/opportunities/summer-cs-program', 'abu_dhabi', 'AE', 10, 12,
     'Three-week day programme: Python, data science and a final team project.', null, 4500, '2027-04-15T23:59:00+04:00', '{coding,data science,university}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000011', 'Humanities Summer Academy (Online)', 'Ivy Quad Online (fictional)', 'summer_program', 'https://example.org/opportunities/humanities-summer-online', null, 'XX', 10, 13,
     'Online seminars in philosophy, history and creative writing; tutor feedback on an essay.', null, 6200, '2027-04-30T23:59:00+04:00', '{humanities,writing,online}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'unknown'),
  ('91000000-0000-4000-8000-000000000012', 'Arabic Calligraphy Youth Course', 'Sharjah Arts House (fictional)', 'course', 'https://example.org/opportunities/arabic-calligraphy-youth', 'sharjah', 'AE', 6, 12,
     'Eight Saturday sessions; materials included. Beginners welcome.', null, 600, '2026-10-25T23:59:00+04:00', '{art,arabic,culture}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000013', 'Intro to Machine Learning for Teens (Online)', 'Open Learning Commons (fictional)', 'course', 'https://example.org/opportunities/ml-for-teens', null, 'XX', 8, 13,
     'Self-paced, about 20 hours. Certificate on completion of the final project.', null, 0, null, '{ai,coding,online}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000014', 'Marine Conservation Volunteering Weekend', 'RAK Reef Guardians (fictional)', 'volunteering', 'https://example.org/opportunities/rak-reef-weekend', 'ras_al_khaimah', 'AE', 8, 13,
     'Beach clean-up and turtle-nesting survey; guardian must accompany students under 16.', null, 150, '2026-11-05T23:59:00+04:00', '{environment,marine,community}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000015', 'East Coast Youth Debate Championship', 'Fujairah Debating Union (fictional)', 'competition', 'https://example.org/opportunities/east-coast-debate', 'fujairah', 'AE', 8, 12,
     'British Parliamentary format, teams of two. English and Arabic divisions.', null, 100, '2026-12-05T23:59:00+04:00', '{debate,public speaking}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000016', 'UAE Junior Entrepreneurship Pitch Competition', 'Young Founders UAE (fictional)', 'competition', 'https://example.org/opportunities/junior-pitch', 'dubai', 'AE', 9, 12,
     'Pitch a business idea in 3 minutes; finalists receive mentoring and seed prizes.', null, 0, '2027-01-20T23:59:00+04:00', '{entrepreneurship,business,pitching}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000017', 'International Economics Olympiad - UAE Selection', 'UAE Economics Olympiad Committee (fictional)', 'olympiad', 'https://example.org/opportunities/economics-olympiad-uae', null, 'AE', 9, 12,
     'Online test on micro, macro and finance; top five represent the UAE internationally.', null, 0, '2027-02-10T23:59:00+04:00', '{economics,finance}', '90000000-0000-4000-8000-000000000002', '2026-10-10T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000018', 'World Robotics Challenge - UAE National Round', 'Robotics League Gulf (fictional)', 'competition', 'https://example.org/opportunities/robotics-national-round', 'abu_dhabi', 'AE', 6, 12,
     'Teams of 2-4 with a coach. Kit purchase required; registration fee per team.', null, 750, '2026-12-20T23:59:00+04:00', '{robotics,engineering,stem,teamwork}', '90000000-0000-4000-8000-000000000001', '2026-10-09T06:00:00+04:00', 'open'),
  ('91000000-0000-4000-8000-000000000019', 'Young Writers Short Story Prize', 'Ajman Literary Circle (fictional)', 'competition', 'https://example.org/opportunities/young-writers-prize', 'ajman', 'AE', 6, 12,
     'Original short story up to 2,000 words in English or Arabic.', null, 0, '2026-09-30T23:59:00+04:00', '{writing,creative}', '90000000-0000-4000-8000-000000000002', '2026-10-01T06:00:00+04:00', 'closed');

-- ---------- tasks ----------
insert into public.tasks (id, student_id, title, kind, due_at, est_minutes, status, linked_goal_id, linked_material_id, linked_opportunity_id, ai_use_level) values
  ('92000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Write up enzyme practical', 'assignment', '2026-10-16T20:00:00+04:00', 120, 'doing', null, 'f1000000-0000-4000-8000-000000000002', null, 'support'),
  ('92000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Revise energetics (Hess''s law questions)', 'study', '2026-10-20T19:00:00+04:00', 60, 'todo', null, 'f1000000-0000-4000-8000-000000000003', null, 'none'),
  ('92000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'UCAT verbal reasoning practice set', 'study', '2026-10-12T18:00:00+04:00', 45, 'todo', 'e0000000-0000-4000-8000-000000000002', null, null, 'none'),
  ('92000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Apply for hospital shadowing week', 'application', '2026-11-10T20:00:00+04:00', 90, 'todo', 'e0000000-0000-4000-8000-000000000003', null, '91000000-0000-4000-8000-00000000000b', 'support'),
  ('92000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'Finish Python worksheet Q1-15', 'assignment', '2026-10-14T19:00:00+04:00', 75, 'todo', 'e0000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000004', null, 'none'),
  ('92000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002', 'Solve 5 olympiad problems (greedy)', 'study', '2026-10-11T21:00:00+04:00', 90, 'done', 'e0000000-0000-4000-8000-000000000004', null, '91000000-0000-4000-8000-000000000003', 'none'),
  ('92000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'Revise Laws of Motion for PT-2', 'study', '2026-10-26T19:00:00+04:00', 60, 'todo', null, 'f1000000-0000-4000-8000-000000000005', null, 'none'),
  ('92000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000003', 'Start ecosystems poster: choose mangroves or reef', 'assignment', '2026-10-18T17:00:00+04:00', 40, 'todo', null, 'f1000000-0000-4000-8000-000000000006', null, 'none'),
  ('92000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000004', 'Make notes on sectors of the economy', 'study', '2026-10-13T19:30:00+04:00', 45, 'todo', null, 'f1000000-0000-4000-8000-000000000007', null, 'support'),
  ('92000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000004', 'Draft 3-minute pitch script', 'application', '2026-12-20T20:00:00+04:00', 60, 'todo', 'e0000000-0000-4000-8000-000000000007', null, '91000000-0000-4000-8000-000000000016', 'support'),
  ('92000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000005', 'Football training - fitness drills', 'habit', '2026-10-11T17:00:00+04:00', 60, 'todo', 'e0000000-0000-4000-8000-000000000009', null, null, 'none'),
  ('92000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000005', 'Research three existing lamps', 'assignment', '2026-10-25T18:00:00+04:00', 50, 'todo', 'e0000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000008', null, 'none');

-- ---------- calendar events ----------
insert into public.calendar_events (id, student_id, title, start_at, end_at, source, external_id) values
  ('93000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Chemistry Unit 2 test', '2026-10-22T08:00:00+04:00', '2026-10-22T09:00:00+04:00', 'google_calendar', 'gcal-evt-1'),
  ('93000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Clinic volunteering shift', '2026-10-17T09:00:00+04:00', '2026-10-17T13:00:00+04:00', 'manual', null),
  ('93000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'Physics Periodic Test 2', '2026-10-28T08:30:00+04:00', '2026-10-28T10:00:00+04:00', 'teams', 'teams-evt-1'),
  ('93000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'Robotics club', '2026-10-13T14:30:00+04:00', '2026-10-13T16:00:00+04:00', 'outlook', 'outlook-evt-7'),
  ('93000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004', 'Chess club tournament', '2026-10-24T10:00:00+04:00', '2026-10-24T14:00:00+04:00', 'manual', null),
  ('93000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000005', 'U15 football trials', '2026-11-02T15:30:00+04:00', '2026-11-02T17:30:00+04:00', 'google_calendar', 'gcal-evt-9');

-- ---------- applications ----------
insert into public.applications (id, student_id, opportunity_id, status, checklist, notes, submitted_at) values
  ('94000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-00000000000b', 'preparing',
     '[{"item":"Reference letter from biology teacher","done":true},{"item":"Personal statement (300 words)","done":false},{"item":"Guardian consent form","done":true}]', 'Ask Mr Daniel Test for the reference by 1 Nov.', null),
  ('94000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'submitted',
     '[{"item":"Delegate form","done":true},{"item":"Position paper","done":true}]', null, '2026-10-05T18:20:00+04:00'),
  ('94000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000003', 'submitted',
     '[{"item":"Register via school coordinator","done":true}]', null, '2026-10-02T16:00:00+04:00'),
  ('94000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000008', 'saved', '[]', 'Need 2 more teammates.', null),
  ('94000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000016', 'preparing',
     '[{"item":"Pitch script","done":false},{"item":"One-page business summary","done":false}]', null, null),
  ('94000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000017', 'saved', '[]', null, null),
  ('94000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000019', 'rejected',
     '[{"item":"Story draft","done":true}]', 'Entered under-15 category.', '2026-09-20T12:00:00+04:00'),
  ('94000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000012', 'saved', '[]', null, null);

-- ---------- achievements ----------
insert into public.achievements (id, student_id, title, category, date, description, evidence_url) values
  ('95000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Best Delegate, School MUN 2026', 'award', '2026-04-18', 'Represented Japan on the WHO committee.', 'https://example.org/evidence/aisha-mun.pdf'),
  ('95000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'GCSE results: 8 grade 9s', 'academic', '2026-08-20', 'Including Biology, Chemistry and Maths.', null),
  ('95000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Clinic volunteer - 20 hours', 'volunteering', '2026-09-30', 'Patient reception and health awareness leaflets.', null),
  ('95000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'Inter-school coding contest - 2nd place', 'award', '2026-02-11', 'Solved 5 of 6 problems in Python.', 'https://example.org/evidence/rohan-coding.png'),
  ('95000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'Built a line-following robot', 'project', '2026-06-05', 'Arduino-based robot for the school science fair.', null),
  ('95000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000004', 'School chess champion', 'sport', '2026-03-12', 'Won the Class 9-10 school championship.', null),
  ('95000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000004', 'Class monitor', 'leadership', '2026-04-01', 'Elected class monitor for the 2026-27 year.', null),
  ('95000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000005', 'Design & Technology star project', 'project', '2026-06-15', 'Flat-pack phone stand from recycled acrylic.', null);

-- ---------- CV versions ----------
insert into public.cv_versions (id, student_id, template, target, "json", pdf_url) values
  ('96000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'classic', 'university',
     '{"basics":{"name":"Aisha Test","label":"Year 12 student","location":{"city":"Dubai","countryCode":"AE"}},"education":[{"institution":"Al Noor British Academy (Test)","studyType":"A-Levels","area":"Biology, Chemistry, Maths"}],"awards":[{"title":"Best Delegate, School MUN 2026","date":"2026-04-18"}]}',
     'https://example.org/cv/aisha-university-v1.pdf'),
  ('96000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'modern', 'internship',
     '{"basics":{"name":"Rohan Test","label":"Class 11 student","location":{"city":"Dubai","countryCode":"AE"}},"skills":[{"name":"Programming","keywords":["Python","C++"]}],"awards":[{"title":"Inter-school coding contest - 2nd place","date":"2026-02-11"}]}',
     null);

-- ---------- connections (token_ref = vault reference only) ----------
insert into public.connections (id, student_id, provider, scopes, status, token_ref, last_sync_at) values
  ('98000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'google', '{classroom.courses.readonly,classroom.coursework.me.readonly,calendar.readonly}', 'active', 'vault:conn/aisha-google', '2026-10-10T07:00:00+04:00'),
  ('98000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'microsoft', '{EduAssignments.ReadBasic,Calendars.Read}', 'active', 'vault:conn/rohan-microsoft', '2026-10-10T07:05:00+04:00'),
  ('98000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'google', '{classroom.courses.readonly}', 'pending', null, null);

-- ---------- notifications ----------
insert into public.notifications (id, student_id, recipient, channel, template, payload, scheduled_at, sent_at, status) values
  ('97000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'student', 'push', 'task_due_soon', '{"task_id":"92000000-0000-4000-8000-000000000001"}', '2026-10-15T18:00:00+04:00', null, 'scheduled'),
  ('97000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'student', 'in_app', 'morning_briefing', '{"date":"2026-10-10"}', '2026-10-10T06:30:00+04:00', '2026-10-10T06:30:05+04:00', 'sent'),
  ('97000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'guardian', 'email', 'weekly_guardian_summary', '{"week":"2026-W41"}', '2026-10-11T08:00:00+04:00', null, 'scheduled'),
  ('97000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'student', 'whatsapp', 'opportunity_deadline', '{"opportunity_id":"91000000-0000-4000-8000-000000000008"}', '2026-11-24T17:00:00+04:00', null, 'scheduled'),
  ('97000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'student', 'in_app', 'guardian_consent_pending', '{}', '2026-10-08T17:05:00+04:00', '2026-10-08T17:05:01+04:00', 'sent');

-- ---------- audit logs ----------
insert into public.audit_logs (id, actor, actor_type, action, resource, resource_id, student_id, metadata, at) values
  ('9a000000-0000-4000-8000-000000000001', 'connector:google_classroom', 'connector', 'sync', 'materials', null, 'b0000000-0000-4000-8000-000000000001', '{"items":3}', '2026-10-10T07:00:00+04:00'),
  ('9a000000-0000-4000-8000-000000000002', 'connector:teams', 'connector', 'sync', 'materials', null, 'b0000000-0000-4000-8000-000000000002', '{"items":2}', '2026-10-10T07:05:00+04:00'),
  ('9a000000-0000-4000-8000-000000000003', 'agent:planner', 'agent', 'read', 'tasks', null, 'b0000000-0000-4000-8000-000000000001', '{"purpose":"morning_briefing"}', '2026-10-10T06:29:00+04:00');

commit;
