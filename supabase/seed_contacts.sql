-- ============================================================================
-- Contact import — the v1 address book.
--
-- Every address held in the Streamlit system's client repository, transcribed
-- from its Client Emails screen. v1 stored these as a pipe-separated text blob
-- on the client row, which is why it could carry the same address twice and
-- had no way to mark anyone internal. Here each one becomes a row.
--
-- Run after seed.sql. Safe to re-run — `on conflict do nothing` against the
-- (client_id, email) unique constraint makes this idempotent.
--
-- ── What the import does on your behalf ────────────────────────────────────
--
-- is_internal   Derived from the domain, not transcribed. Anything on
--               convin.ai is Convin's own team and is flagged internal, so it
--               is excluded from client engagement rates from the first send.
--               v1 counted these as client engagement, which is why
--               datalabsteam@convin.ai was its single most "engaged" recipient.
--
-- full_name     Derived from the local part — "podirla.jyotika" becomes
--               "Podirla Jyotika" — with trailing digits stripped, so
--               "amit.sharma6" reads "Amit Sharma". This is the same derivation
--               v1 used on its ratings screen. Treat these as a starting point
--               and correct them in the app; a derived name is a guess.
--
-- title         Left blank. v1 never captured job titles and inventing them
--               would be worse than an empty field.
--
-- ── Deliberate omissions ───────────────────────────────────────────────────
--
-- Two of v1's seventeen "clients" were test records and are not imported:
--   · "ABC"                 — animesh@convin.ai, Aman@convin.ai
--   · "data labs test mail" — datalabsteam@, ritesh.sk@, alen.dennis@convin.ai
-- Both contained only Convin staff. Importing them would put two fake accounts
-- in the client list and let a test send count as a campaign — which is
-- precisely the defect that made v1's Daily tab read "5.0/5, 100% response".
-- If you want them anyway, add them as clients first and re-run.
--
-- 110 addresses across 15 clients. 109 will land: Thyrocare carried
-- rohit.kumarsingh@thyrocare.com twice in v1, and the unique constraint
-- collapses it. Case-variant duplicates (Convinlabs@ / convinlabs@, Aman@ /
-- aman@) collapse too — `email` is citext.
-- ============================================================================

insert into public.contacts (client_id, email, full_name, is_internal)
select
  c.id,
  v.email,
  -- "salman.khan6" → "Salman Khan"; "v-rohit" → "V-Rohit"
  initcap(
    btrim(
      regexp_replace(
        replace(split_part(v.email, '@', 1), '.', ' '),
        '[0-9]+', '', 'g'
      )
    )
  ) as full_name,
  lower(split_part(v.email, '@', 2)) = 'convin.ai' as is_internal
from (values
  -- ── Myntra · 15 ──────────────────────────────────────────────────────────
  ('myntra',         'manu.chacko@myntra.com'),
  ('myntra',         'yusuf.i@myntra.com'),
  ('myntra',         'sajjad.zaheer@myntra.com'),
  ('myntra',         'mohammed.rihab@myntra.com'),
  ('myntra',         'pranay.prabhakar@myntra.com'),
  ('myntra',         'sulaiman.md@myntra.com'),
  ('myntra',         'nabiya.zubair@myntra.com'),
  ('myntra',         'mahesh.manjunath@myntra.com'),
  ('myntra',         'salman.khan6@myntra.com'),
  ('myntra',         'utsav@convin.ai'),
  ('myntra',         'animesh@convin.ai'),
  ('myntra',         'aman@convin.ai'),
  ('myntra',         'sakshi.prasad@convin.ai'),
  ('myntra',         'alen.dennis@convin.ai'),
  ('myntra',         'mansi.kumari@convin.ai'),

  -- ── Thyrocare · 8 listed, 7 unique ───────────────────────────────────────
  -- rohit.kumarsingh appeared twice in v1's list; stated once here.
  ('thyrocare',      'mifta.sayyed@thyrocare.com'),
  ('thyrocare',      'podirla.jyotika@thyrocare.com'),
  ('thyrocare',      'rohit.kumarsingh@thyrocare.com'),
  ('thyrocare',      'rakesh.shetty@thyrocare.com'),
  ('thyrocare',      'shireen.shaikh@thyrocare.com'),
  ('thyrocare',      'siddhant.b@convin.ai'),
  ('thyrocare',      'convinlabs@convin.ai'),

  -- ── SBI Life · 10 ────────────────────────────────────────────────────────
  ('sbi-life',       'manoj.singh@sbilife.co.in'),
  ('sbi-life',       'mitesh.pal@sbilife.co.in'),
  ('sbi-life',       'sakshi.bagaria@sbilife.co.in'),
  ('sbi-life',       'yasir.shaikh@sbilife.co.in'),
  ('sbi-life',       'aman@convin.ai'),
  ('sbi-life',       'datalabsteam@convin.ai'),
  ('sbi-life',       'utsav@convin.ai'),
  ('sbi-life',       'alen.dennis@convin.ai'),
  ('sbi-life',       'sakshi.prasad@convin.ai'),
  ('sbi-life',       'mansi.kumari@convin.ai'),

  -- ── Apna · 10 ────────────────────────────────────────────────────────────
  ('apna',           'vanashri.k@apna.co'),
  ('apna',           'zunaid.a@apna.co'),
  ('apna',           'nilesh.jha@apna.co'),
  ('apna',           'neeraj.bahadur@apna.co'),
  ('apna',           'arpit.malviya@apna.co'),
  ('apna',           'fouzail.azam@apna.co'),
  ('apna',           'richard@convin.ai'),
  ('apna',           'convinlabs@convin.ai'),
  ('apna',           'shubham.sharma@convin.ai'),
  ('apna',           'navya.m@convin.ai'),

  -- ── Livpure · 9 ──────────────────────────────────────────────────────────
  -- v1 held this client as "Livpurewaas" while its campaigns said "Livpure",
  -- which is one of the name mismatches that broke attribution. One name now.
  ('livpure',        'Tapas.Mukherjee@livpure.com'),
  ('livpure',        'preeti.singh@livpure.com'),
  ('livpure',        'raqib.khan@livpure.com'),
  ('livpure',        'nitin.singh@livpure.com'),
  ('livpure',        'animesh@convin.ai'),
  ('livpure',        'sakshi.prasad@convin.ai'),
  ('livpure',        'aman@convin.ai'),
  ('livpure',        'roshan.raj@convin.ai'),
  ('livpure',        'bhavya.pandey@convin.ai'),

  -- ── Physics Wallah · 9 ───────────────────────────────────────────────────
  ('physics-wallah', 'devayani.reddy@pw.live'),
  ('physics-wallah', 'sanchit.kaura@pw.live'),
  ('physics-wallah', 'dinesh.sood@pw.live'),
  ('physics-wallah', 'asmita.singh@pw.live'),
  ('physics-wallah', 'ravi.sachan@pw.live'),
  ('physics-wallah', 'vikash.kumar14@pw.live'),
  ('physics-wallah', 'amit.sharma6@pw.live'),
  ('physics-wallah', 'utsav@convin.ai'),
  ('physics-wallah', 'convinlabs@convin.ai'),

  -- ── Cleartrip · 7 ────────────────────────────────────────────────────────
  ('cleartrip',      'priyaah.sundaraam@cleartrip.com'),
  ('cleartrip',      'chanchal.tiwari@cleartrip.com'),
  ('cleartrip',      'datalabsteam@convin.ai'),
  ('cleartrip',      'convinlabs@convin.ai'),
  ('cleartrip',      'alen.dennis@convin.ai'),
  ('cleartrip',      'mansi.kumari@convin.ai'),
  ('cleartrip',      'sakshi.prasad@convin.ai'),

  -- ── Housing · 7 ──────────────────────────────────────────────────────────
  ('housing',        'shalini.thapliyal@housing.com'),
  ('housing',        'dinesh.pandey@housing.com'),
  ('housing',        'venus.kalra@housing.com'),
  ('housing',        'richard@convin.ai'),
  ('housing',        'convinlabs@convin.ai'),
  ('housing',        'datalabsteam@convin.ai'),
  ('housing',        'aman@convin.ai'),

  -- ── Red Taxi · 7 ─────────────────────────────────────────────────────────
  ('red-taxi',       'arunkumar@redtaxi.co.in'),
  ('red-taxi',       'amuthan@redtaxi.co.in'),
  ('red-taxi',       'anand@redtaxi.co.in'),
  ('red-taxi',       'manoj@redtaxi.co.in'),
  ('red-taxi',       'richard@convin.ai'),
  ('red-taxi',       'datalabsteam@convin.ai'),
  ('red-taxi',       'alen.dennis@convin.ai'),

  -- ── Allen · 6 ────────────────────────────────────────────────────────────
  ('allen',          'kanak.sehgal@allen.in'),
  ('allen',          'richa.jain@allen.in'),
  ('allen',          'shubham.siddhartha@convin.ai'),
  ('allen',          'datalabsteam@convin.ai'),
  ('allen',          'convinlabs@convin.ai'),
  ('allen',          'aman@convin.ai'),

  -- ── Fyers · 5 ────────────────────────────────────────────────────────────
  ('fyers',          'chandan@fyers.in'),
  ('fyers',          'abdul.jaffar@fyers.in'),
  ('fyers',          'animesh@convin.ai'),
  ('fyers',          'aman@convin.ai'),
  ('fyers',          'richard@convin.ai'),

  -- ── Metropolis · 5 ───────────────────────────────────────────────────────
  ('metropolis',     'purnima.chandragiri@metropolisindia.com'),
  ('metropolis',     'tabassum.shaikh@metropolisindia.com'),
  ('metropolis',     'sayani@convin.ai'),
  ('metropolis',     'convinlabs@convin.ai'),
  ('metropolis',     'navya.m@convin.ai'),

  -- ── Realme · 5 ───────────────────────────────────────────────────────────
  ('realme',         'v-rohit@realmeindia.com'),
  ('realme',         'rahul.katare@realmeindia.com'),
  ('realme',         'utsav@convin.ai'),
  ('realme',         'convinlabs@convin.ai'),
  ('realme',         'datalabsteam@convin.ai'),

  -- ── Niva Bupa · 4 ────────────────────────────────────────────────────────
  ('niva-bupa',      'Ankit.Verma@nivabupa.com'),
  ('niva-bupa',      'Aamir.Khan@nivabupa.com'),
  ('niva-bupa',      'utsav@convin.ai'),
  ('niva-bupa',      'convinlabs@convin.ai'),

  -- ── Flipkart · 3 ─────────────────────────────────────────────────────────
  ('flipkart',       'gagan.ss@flipkart.com'),
  ('flipkart',       'raghav@convin.ai'),
  ('flipkart',       'datalabsteam@convin.ai')
) as v(slug, email)
join public.clients c on c.slug = v.slug
on conflict (client_id, email) do nothing;


-- ── Optional · recipients seen only in v1's send history ────────────────────
-- These addresses received reports but were never saved to the client's
-- address list, so v1 could mail them and then not show them as contacts.
-- They are almost certainly real. Uncomment to include them.
--
-- insert into public.contacts (client_id, email, full_name, is_internal)
-- select c.id, v.email,
--        initcap(btrim(regexp_replace(replace(split_part(v.email,'@',1),'.',' '),'[0-9]+','','g'))),
--        lower(split_part(v.email,'@',2)) = 'convin.ai'
-- from (values
--   ('cleartrip', 'prasanna.kumarj@cleartrip.com'),
--   ('cleartrip', 'santosh.v2@cleartrip.com'),
--   ('cleartrip', 'utsav@convin.ai'),
--   ('cleartrip', 'amit@convin.ai'),
--   ('housing',   'amit@convin.ai'),
--   ('thyrocare', 'amit@convin.ai'),
--   ('flipkart',  'ramesh.mudiyappa@flipkart.com')
-- ) as v(slug, email)
-- join public.clients c on c.slug = v.slug
-- on conflict (client_id, email) do nothing;


-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect 15 rows and 109 contacts: 55 client-side, 54 internal CCs.
--
-- That ratio is the finding, not a rounding artefact. Almost exactly half of
-- every list v1 mailed was Convin's own team, and v1 counted all of them as
-- client engagement. Excluding them is why v2's open rate will read lower than
-- the number this team is used to quoting — and why it will be true.
select
  c.name,
  count(*)                                   as contacts,
  count(*) filter (where not ct.is_internal) as client_side,
  count(*) filter (where ct.is_internal)     as internal_cc
from public.contacts ct
join public.clients c on c.id = ct.client_id
group by c.name
order by contacts desc, c.name;
