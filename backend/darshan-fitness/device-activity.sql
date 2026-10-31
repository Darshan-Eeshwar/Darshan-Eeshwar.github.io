create table public.df_device_activity (
 account_id uuid not null references public.df_accounts(id) on delete cascade,
 device_id text not null,
 source text not null check(source in ('phone_sensor','health_connect')),
 day date not null,
 data jsonb not null,
 received_at bigint not null,
 primary key(account_id,device_id,source,day)
);
create index df_device_activity_account_day on public.df_device_activity(account_id,day);
alter table public.df_device_activity enable row level security;
revoke all on public.df_device_activity from public,anon,authenticated;
grant select,insert,update,delete on public.df_device_activity to service_role;
