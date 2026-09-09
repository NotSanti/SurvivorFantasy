begin;
select plan(4);

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
select tests_create_user('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'outsider@example.com');

select tests_login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select lives_ok(
  $$select public.create_league('Camp Chaos', 6::smallint)$$,
  'authenticated user can create a league'
);
select isnt_empty(
  $$select id from public.leagues where name = 'Camp Chaos'$$,
  'created league is visible to the commissioner'
);

select tests_login('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select is_empty(
  $$select id from public.leagues where name = 'Camp Chaos'$$,
  'outsider cannot read the new league'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok(
  $$select public.create_league('Nope', 6::smallint)$$,
  '42501',
  'permission denied for function create_league',
  'anonymous cannot create a league'
);

select * from finish();
rollback;
