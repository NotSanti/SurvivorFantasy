begin;
select plan(13);

create extension if not exists pgcrypto with schema extensions;

create or replace function tests_create_user(uid uuid, email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    uid,
    'authenticated',
    'authenticated',
    email,
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    pg_catalog.gen_random_uuid(),
    uid,
    jsonb_build_object('sub', uid::text, 'email', email),
    'email',
    uid::text,
    now(),
    now(),
    now()
  );
end;
$$;

create or replace function tests_login(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

select tests_create_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.com');
select tests_create_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.com');
select tests_create_user('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'outsider@example.com');

insert into public.tribes (id, season_id, name, sort_order)
values
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', 'Test Sage', 1),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', 'Test Clay', 2),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Test Dusk', 3);

insert into public.castaways (id, season_id, original_tribe_id, display_name, slug)
values
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'Player One', 'player-one');

insert into public.leagues (
  id, season_id, name, commissioner_id, status, max_members, ruleset_version_id
) values (
  '55555555-5555-4555-8555-555555555551',
  '11111111-1111-4111-8111-111111111111',
  'Camp Alpha',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'selecting',
  8,
  '22222222-2222-4222-8222-222222222222'
), (
  '55555555-5555-4555-8555-555555555552',
  '11111111-1111-4111-8111-111111111111',
  'Camp Beta',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'selecting',
  8,
  '22222222-2222-4222-8222-222222222222'
);

insert into public.league_members (league_id, user_id, role)
values
  ('55555555-5555-4555-8555-555555555551', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'commissioner'),
  ('55555555-5555-4555-8555-555555555551', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member'),
  ('55555555-5555-4555-8555-555555555552', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'commissioner');

insert into public.roster_entries (
  league_id, member_id, castaway_id, acquisition_type, slot_number, starts_episode
) values (
  '55555555-5555-4555-8555-555555555551',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '44444444-4444-4444-8444-444444444441',
  'manual',
  1,
  2
);

-- Anonymous can read the announced season, but not draft rules.
set local role anon;
select isnt_empty(
  'select id from public.seasons where number = 51',
  'anonymous can read season metadata'
);
select is_empty(
  'select id from public.rule_sets',
  'anonymous cannot read draft rule sets'
);
select throws_ok(
  'select id from public.leagues',
  '42501',
  'permission denied for table leagues',
  'anonymous cannot read private leagues'
);

-- Outsider cannot read another league.
select tests_login('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select is_empty(
  'select id from public.leagues where id = ''55555555-5555-4555-8555-555555555551''',
  'non-member cannot read a private league'
);
select is_empty(
  'select member_id from public.roster_entries',
  'non-member cannot read roster picks'
);

-- Member B cannot read member A picks while the league is unlocked.
select tests_login('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select is_empty(
  $$select id from public.roster_entries
    where league_id = '55555555-5555-4555-8555-555555555551'
      and member_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'other members cannot read unlocked picks'
);
select isnt_empty(
  $$select id from public.leagues where id = '55555555-5555-4555-8555-555555555551'$$,
  'member can read their league'
);

-- A cannot see beta.
select tests_login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select is_empty(
  $$select id from public.leagues where id = '55555555-5555-4555-8555-555555555552'$$,
  'cross-league reads fail'
);
select isnt_empty(
  $$select id from public.roster_entries where member_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'member can read own unlocked picks'
);

-- Direct client writes to lifecycle and scores are revoked.
select throws_ok(
  $$insert into public.leagues (season_id, name, commissioner_id, max_members, ruleset_version_id)
    values (
      '11111111-1111-4111-8111-111111111111',
      'Forged',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      4,
      '22222222-2222-4222-8222-222222222222'
    )$$,
  '42501',
  'permission denied for table leagues',
  'clients cannot insert leagues directly'
);

select throws_ok(
  $$update public.leagues set status = 'locked' where id = '55555555-5555-4555-8555-555555555551'$$,
  '42501',
  'permission denied for table leagues',
  'clients cannot update league status directly'
);

select throws_ok(
  $$insert into public.episodes (season_id, episode_number, status)
    values ('11111111-1111-4111-8111-111111111111', 2, 'published')$$,
  '42501',
  'permission denied for table episodes',
  'clients cannot insert episodes'
);

-- After lock, peer picks become visible.
reset role;
update public.leagues
set status = 'locked', locked_at = now()
where id = '55555555-5555-4555-8555-555555555551';

select tests_login('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select isnt_empty(
  $$select id from public.roster_entries
    where league_id = '55555555-5555-4555-8555-555555555551'
      and member_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'locked rosters are visible to league members'
);

select * from finish();
rollback;
