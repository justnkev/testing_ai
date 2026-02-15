-- Update Business Settings
alter table public.business_settings 
add column if not exists google_review_url text,
add column if not exists marketing_enabled boolean default false;

-- Marketing Templates Table
create table if not exists public.marketing_templates (
    id uuid not null default gen_random_uuid() primary key,
    name text not null,
    subject text not null,
    email_body text, -- HTML content
    sms_body text,
    is_active boolean default false,
    trigger_days_after integer not null default 1, -- e.g. 1 day after job completion
    service_type_filter text[], -- Array of service types to match, null for all
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Enable RLS for Templates
alter table public.marketing_templates enable row level security;

-- Policies for Templates (Admin only usually, but typical authenticated for now)
create policy "Authenticated users can view marketing templates"
on public.marketing_templates for select
to authenticated
using (true);

create policy "Authenticated users can update marketing templates"
on public.marketing_templates for update
to authenticated
using (true);

create policy "Authenticated users can insert marketing templates"
on public.marketing_templates for insert
to authenticated
with check (true);

-- Campaign Logs Table
create table if not exists public.campaign_logs (
    id uuid not null default gen_random_uuid() primary key,
    customer_id uuid not null references public.fs_customers(id),
    job_id uuid references public.fs_jobs(id), -- Optional link to specific job trigger
    template_id uuid references public.marketing_templates(id),
    channel text not null check (channel in ('email', 'sms')),
    status text not null check (status in ('sent', 'failed', 'skipped')),
    error_message text,
    sent_at timestamp with time zone default now()
);

-- Enable RLS for Logs
alter table public.campaign_logs enable row level security;

create policy "Authenticated users can view campaign logs"
on public.campaign_logs for select
to authenticated
using (true);

create policy "Service role can insert campaign logs"
on public.campaign_logs for insert
to service_role, authenticated -- Allow authenticated for test sends
with check (true);

-- Seed Default Templates
insert into public.marketing_templates (name, subject, email_body, sms_body, is_active, trigger_days_after)
select 
    'Review Request', 
    'How did we do? - {{business_name}}', 
    '<p>Hi {{customer_name}},</p><p>Thank you for choosing us for your recent service. We would love to hear your feedback!</p><p><a href="{{review_url}}">Leave a Review</a></p>',
    'Hi {{customer_name}}, thanks for choosing {{business_name}}! Could you take a moment to leave us a review? {{review_url}}',
    false,
    1
where not exists (select 1 from public.marketing_templates where name = 'Review Request');

insert into public.marketing_templates (name, subject, email_body, sms_body, is_active, trigger_days_after)
select 
    'Service Reminder', 
    'Time for your annual maintenance', 
    '<p>Hi {{customer_name}},</p><p>It has been a year since your last service. It is time to schedule your annual maintenance to keep everything running smoothly.</p>',
    'Hi {{customer_name}}, it''s time for your annual {{business_name}} maintenance. Call us to book!',
    false,
    365
where not exists (select 1 from public.marketing_templates where name = 'Service Reminder');
