begin;
select plan(3);

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

select tests_login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.create_league('Stay Together', 4::smallint);
select public.create_league_invite(
  (select id from public.leagues where name = 'Stay Together'),
  72,
  null
) as token into temporary table stay_token;

select tests_login('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select public.accept_league_invite((select token from stay_token));

select tests_login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select throws_ok(
  $$select public.leave_league((select id from public.leagues where name = 'Stay Together'))$$,
  '22023',
  'Commissioner must archive the league or wait until others leave',
  'commissioner cannot leave while other members remain'
);

select tests_login('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select lives_ok(
  $$select public.leave_league((select id from public.leagues where name = 'Stay Together'))$$,
  'a regular member can leave while recruiting'
);

select tests_login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select lives_ok(
  $$select public.leave_league((select id from public.leagues where name = 'Stay Together'))$$,
  'solo commissioner leave archives the empty league'
);

select * from finish();
rollback;
