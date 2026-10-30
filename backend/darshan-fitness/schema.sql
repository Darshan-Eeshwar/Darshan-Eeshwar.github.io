create table public.df_accounts (
 id uuid primary key,
 username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
 password_hash text not null check(length(password_hash)=64),
 salt text not null check(length(salt)=64),
 created_at bigint not null,
 auth_version integer not null default 1
);
create table public.df_sessions (
 token_hash text primary key check(length(token_hash)=64),
 account_id uuid not null references public.df_accounts(id) on delete cascade,
 expires_at bigint not null,
 auth_version integer not null default 1
);
create index df_sessions_account on public.df_sessions(account_id);
create index df_sessions_expiry on public.df_sessions(expires_at);
create table public.df_journals (
 account_id uuid primary key references public.df_accounts(id) on delete cascade,
 data jsonb not null,
 version bigint not null check(version>0),
 updated_at bigint not null
);
create table public.df_auth_attempts (
 key text primary key,
 count integer not null,
 window_start bigint not null
);
alter table public.df_accounts enable row level security;
alter table public.df_sessions enable row level security;
alter table public.df_journals enable row level security;
alter table public.df_auth_attempts enable row level security;
revoke all on public.df_accounts, public.df_sessions, public.df_journals, public.df_auth_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.df_accounts, public.df_sessions, public.df_journals, public.df_auth_attempts to service_role;
create function public.df_rate_limit(p_key text,p_limit integer,p_window_ms bigint)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n bigint := (extract(epoch from clock_timestamp())*1000)::bigint; c integer;
begin
 insert into public.df_auth_attempts(key,count,window_start) values(p_key,1,n)
 on conflict(key) do update set count=case when df_auth_attempts.window_start<n-p_window_ms then 1 else df_auth_attempts.count+1 end,
 window_start=case when df_auth_attempts.window_start<n-p_window_ms then n else df_auth_attempts.window_start end returning count into c;
 return c<=p_limit;
end;
$$;
revoke all on function public.df_rate_limit(text,integer,bigint) from public,anon,authenticated;
grant execute on function public.df_rate_limit(text,integer,bigint) to service_role;
