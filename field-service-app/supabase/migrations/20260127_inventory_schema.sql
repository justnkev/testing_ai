-- Create Inventory Items Table
create table if not exists public.fs_inventory_items (
    id uuid not null default gen_random_uuid() primary key,
    -- We'll infer organization from the creating user for default, but enforce it references profiles
    organization_id uuid not null references public.organizations(id), 
    name text not null,
    sku text,
    description text,
    cost_price numeric(10, 2) default 0,
    retail_price numeric(10, 2) default 0,
    stock_quantity integer default 0,
    min_stock_level integer default 5,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.fs_inventory_items enable row level security;

-- Policies for Inventory Items
create policy "Users can view inventory of their organization"
on public.fs_inventory_items for select
using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "Users can insert inventory to their organization"
on public.fs_inventory_items for insert
with check (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "Users can update inventory of their organization"
on public.fs_inventory_items for update
using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "Users can delete inventory of their organization"
on public.fs_inventory_items for delete
using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
);


-- Create Job Parts Table
create table if not exists public.fs_job_parts (
    id uuid not null default gen_random_uuid() primary key,
    job_id uuid not null references public.fs_jobs(id) on delete cascade,
    item_id uuid not null references public.fs_inventory_items(id),
    quantity_used integer not null check (quantity_used > 0),
    unit_price_at_time_of_use numeric(10, 2) not null,
    created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.fs_job_parts enable row level security;

-- Policies for Job Parts
-- Allow access if the user can see the related job (assuming implicit access via other rules)
-- Or easier: if they belong to the same organization as the item.
create policy "Users can view job parts of their organization"
on public.fs_job_parts for select
using (
    exists (
        select 1 from public.fs_inventory_items i
        where i.id = fs_job_parts.item_id
        and i.organization_id = (select organization_id from public.profiles where id = auth.uid())
    )
);

create policy "Users can insert job parts using their organization items"
on public.fs_job_parts for insert
with check (
    exists (
        select 1 from public.fs_inventory_items i
        where i.id = item_id
        and i.organization_id = (select organization_id from public.profiles where id = auth.uid())
    )
);

create policy "Users can update job parts of their organization"
on public.fs_job_parts for update
using (
    exists (
        select 1 from public.fs_inventory_items i
        where i.id = fs_job_parts.item_id
        and i.organization_id = (select organization_id from public.profiles where id = auth.uid())
    )
);

create policy "Users can delete job parts of their organization"
on public.fs_job_parts for delete
using (
    exists (
        select 1 from public.fs_inventory_items i
        where i.id = fs_job_parts.item_id
        and i.organization_id = (select organization_id from public.profiles where id = auth.uid())
    )
);

-- RPC for Decrementing Stock Transactionally
create or replace function decrement_stock(p_item_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
as $$
declare
  v_current_stock integer;
begin
  -- Lock the row for update
  select stock_quantity into v_current_stock
  from public.fs_inventory_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  if v_current_stock < p_quantity then
    raise exception 'Insufficient stock. Current: %, Requested: %', v_current_stock, p_quantity;
  end if;

  -- Update stock
  update public.fs_inventory_items
  set stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  where id = p_item_id;
end;
$$;

-- RPC for Incrementing Stock (for returns/removals)
create or replace function increment_stock(p_item_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
as $$
begin
  update public.fs_inventory_items
  set stock_quantity = stock_quantity + p_quantity,
      updated_at = now()
  where id = p_item_id;
end;
$$;
