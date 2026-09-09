begin;
select plan(6);

create extension if not exists pgcrypto with schema extensions;

create or replace function tests_create_user(uid uuid, email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
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
select tests_create_user('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c@example.com');

select tests_login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.create_league('Tiny Camp', 2::smallint);
select public.create_league('Revoked Camp', 4::smallint);
select public.create_league('Expired Camp', 4::smallint);

create temp table tokens (
  camp text primary key,
  token text not null
);

insert into tokens (camp, token)
select 'tiny', public.create_league_invite(id, 72, null)
from public.leagues where name = 'Tiny Camp';
insert into tokens (camp, token)
select 'revoked', public.create_league_invite(id, 72, null)
from public.leagues where name = 'Revoked Camp';
insert into tokens (camp, token)
select 'expired', public.create_league_invite(id, 72, null)
from public.leagues where name = 'Expired Camp';

select public.revoke_league_invite(
  (select i.id from public.league_invites i
    join public.leagues l on l.id = i.league_id
    where l.name = 'Revoked Camp' limit 1)
);

reset role;
update public.league_invites i
set expires_at = now() - interval '1 hour'
from public.leagues l
where l.id = i.league_id and l.name = 'Expired Camp';

select tests_login('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select lives_ok(
  $$select public.accept_league_invite((select token from tokens where camp = 'tiny'))$$,
  'second member can accept an open invite'
);
select lives_ok(
  $$select public.accept_league_invite((select token from tokens where camp = 'tiny'))$$,
  'already-member acceptance is idempotent'
);
select is(
  (select count(*)::int from public.league_members m
    join public.leagues l on l.id = m.league_id
    where l.name = 'Tiny Camp' and m.status = 'active'),
  2,
  'already-member retry does not add another seat'
);

select tests_login('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select throws_ok(
  $$select public.accept_league_invite((select token from tokens where camp = 'tiny'))$$,
  '22023',
  'This league is full',
  'a late join after the last seat is rejected'
);
select throws_ok(
  $$select public.accept_league_invite((select token from tokens where camp = 'revoked'))$$,
  '22023',
  'Invite has been revoked',
  'revoked invites fail safely'
);
select throws_ok(
  $$select public.accept_league_invite((select token from tokens where camp = 'expired'))$$,
  '22023',
  'Invite has expired',
  'expired invites fail safely'
);

select * from finish();
rollback;
