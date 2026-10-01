-- Publish selection session turn state for live draft rooms.
alter table public.selection_sessions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'selection_sessions'
  ) then
    alter publication supabase_realtime add table public.selection_sessions;
  end if;
end
$$;
