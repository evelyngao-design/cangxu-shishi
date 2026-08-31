-- ============================================================
-- 仓序食时 (CangXu ShiShi) - Supabase 数据库建表脚本
-- ============================================================
-- 使用方法：
-- 1. 注册并登录 https://supabase.com
-- 2. 创建新项目（New Project）
-- 3. 进入 SQL Editor，粘贴本文件全部内容，点击 RUN
-- ============================================================

-- 启用 RLS（行级安全）
alter default privileges revoke execute on functions from public;

-- ========== 商品表 ==========
create table if not exists public.products (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  brand text default '',
  category text default '其他',
  unit text default '个',
  default_price numeric default 0,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  stock_threshold numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== 订单表 ==========
create table if not exists public.orders (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  channel text default '',
  payment text default '',
  currency text default 'HKD',
  note text default '',
  tags jsonb default '[]'::jsonb,
  items jsonb default '[]'::jsonb,
  total numeric default 0,
  created_at timestamptz default now()
);

-- ========== 库存表 ==========
create table if not exists public.inventory (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id text,
  product_name text not null,
  brand text default '',
  category text default '其他',
  quantity numeric default 0,
  unit text default '个',
  expiry text,
  location text default '其他',
  avg_cost numeric default 0,
  source_order_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== 库存变动日志 ==========
create table if not exists public.inventory_logs (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  inventory_id text not null,
  type text not null,
  quantity numeric default 0,
  note text default '',
  date text not null,
  created_at timestamptz default now()
);

-- ========== 饮食记录表 ==========
create table if not exists public.diet (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  meal text not null,
  items jsonb default '[]'::jsonb,
  total_calories numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== 身体数据表 ==========
create table if not exists public.body_data (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  weight numeric default 0,
  body_fat numeric default 0,
  created_at timestamptz default now()
);

-- ========== 配置表 ==========
create table if not exists public.user_config (
  user_id uuid references auth.users(id) on delete cascade primary key,
  config jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ========== 待分配食物池 ==========
create table if not exists public.unassigned_food (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  order_id text,
  order_date text,
  product_id text,
  product_name text not null,
  brand text default '',
  unit text default '份',
  quantity numeric default 0,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  created_at timestamptz default now()
);

-- ========== 启用 RLS ==========
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.diet enable row level security;
alter table public.body_data enable row level security;
alter table public.user_config enable row level security;
alter table public.unassigned_food enable row level security;

-- ========== 表级授权（修复 permission denied for table）==========
-- 网页通过 anon / authenticated 角色访问，必须先授予表级权限；
-- 行级安全（RLS）策略会在此基础上进一步限制用户只能访问自己的数据。
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
-- 以后新建的表也自动授权
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- ========== RLS 策略：用户只能访问自己的数据 ==========
-- （先删除旧策略，保证脚本可以安全重复运行）
drop policy if exists "用户可查看自己的商品" on public.products;
drop policy if exists "用户可新增自己的商品" on public.products;
drop policy if exists "用户可修改自己的商品" on public.products;
drop policy if exists "用户可删除自己的商品" on public.products;
create policy "用户可查看自己的商品" on public.products for select using (auth.uid() = user_id);
create policy "用户可新增自己的商品" on public.products for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的商品" on public.products for update using (auth.uid() = user_id);
create policy "用户可删除自己的商品" on public.products for delete using (auth.uid() = user_id);

drop policy if exists "用户可查看自己的订单" on public.orders;
drop policy if exists "用户可新增自己的订单" on public.orders;
drop policy if exists "用户可修改自己的订单" on public.orders;
drop policy if exists "用户可删除自己的订单" on public.orders;
create policy "用户可查看自己的订单" on public.orders for select using (auth.uid() = user_id);
create policy "用户可新增自己的订单" on public.orders for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的订单" on public.orders for update using (auth.uid() = user_id);
create policy "用户可删除自己的订单" on public.orders for delete using (auth.uid() = user_id);

drop policy if exists "用户可查看自己的库存" on public.inventory;
drop policy if exists "用户可新增自己的库存" on public.inventory;
drop policy if exists "用户可修改自己的库存" on public.inventory;
drop policy if exists "用户可删除自己的库存" on public.inventory;
create policy "用户可查看自己的库存" on public.inventory for select using (auth.uid() = user_id);
create policy "用户可新增自己的库存" on public.inventory for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的库存" on public.inventory for update using (auth.uid() = user_id);
create policy "用户可删除自己的库存" on public.inventory for delete using (auth.uid() = user_id);

drop policy if exists "用户可查看自己的库存日志" on public.inventory_logs;
drop policy if exists "用户可新增自己的库存日志" on public.inventory_logs;
drop policy if exists "用户可删除自己的库存日志" on public.inventory_logs;
create policy "用户可查看自己的库存日志" on public.inventory_logs for select using (auth.uid() = user_id);
create policy "用户可新增自己的库存日志" on public.inventory_logs for insert with check (auth.uid() = user_id);
create policy "用户可删除自己的库存日志" on public.inventory_logs for delete using (auth.uid() = user_id);

drop policy if exists "用户可查看自己的饮食" on public.diet;
drop policy if exists "用户可新增自己的饮食" on public.diet;
drop policy if exists "用户可修改自己的饮食" on public.diet;
drop policy if exists "用户可删除自己的饮食" on public.diet;
create policy "用户可查看自己的饮食" on public.diet for select using (auth.uid() = user_id);
create policy "用户可新增自己的饮食" on public.diet for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的饮食" on public.diet for update using (auth.uid() = user_id);
create policy "用户可删除自己的饮食" on public.diet for delete using (auth.uid() = user_id);

drop policy if exists "用户可查看自己的身体数据" on public.body_data;
drop policy if exists "用户可新增自己的身体数据" on public.body_data;
drop policy if exists "用户可修改自己的身体数据" on public.body_data;
drop policy if exists "用户可删除自己的身体数据" on public.body_data;
create policy "用户可查看自己的身体数据" on public.body_data for select using (auth.uid() = user_id);
create policy "用户可新增自己的身体数据" on public.body_data for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的身体数据" on public.body_data for update using (auth.uid() = user_id);
create policy "用户可删除自己的身体数据" on public.body_data for delete using (auth.uid() = user_id);

drop policy if exists "用户可查看自己的配置" on public.user_config;
drop policy if exists "用户可新增自己的配置" on public.user_config;
drop policy if exists "用户可修改自己的配置" on public.user_config;
create policy "用户可查看自己的配置" on public.user_config for select using (auth.uid() = user_id);
create policy "用户可新增自己的配置" on public.user_config for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的配置" on public.user_config for update using (auth.uid() = user_id);

drop policy if exists "用户可查看自己的待分配食物" on public.unassigned_food;
drop policy if exists "用户可新增自己的待分配食物" on public.unassigned_food;
drop policy if exists "用户可修改自己的待分配食物" on public.unassigned_food;
drop policy if exists "用户可删除自己的待分配食物" on public.unassigned_food;
create policy "用户可查看自己的待分配食物" on public.unassigned_food for select using (auth.uid() = user_id);
create policy "用户可新增自己的待分配食物" on public.unassigned_food for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的待分配食物" on public.unassigned_food for update using (auth.uid() = user_id);
create policy "用户可删除自己的待分配食物" on public.unassigned_food for delete using (auth.uid() = user_id);

-- ========== 自动更新 updated_at ==========
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.handle_updated_at();
drop trigger if exists inventory_updated_at on public.inventory;
create trigger inventory_updated_at before update on public.inventory
  for each row execute function public.handle_updated_at();
drop trigger if exists diet_updated_at on public.diet;
create trigger diet_updated_at before update on public.diet
  for each row execute function public.handle_updated_at();
drop trigger if exists user_config_updated_at on public.user_config;
create trigger user_config_updated_at before update on public.user_config
  for each row execute function public.handle_updated_at();

-- ========== 意见反馈 ==========
-- 说明：任何用户（含未登录匿名用户）都可以【提交】反馈，但客户端【不能】读取/修改/删除。
-- 反馈内容请在 Supabase 后台 Table Editor -> feedback 表中查看（后台使用 service_role，不受 RLS 限制）。
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  contact text,
  context text,
  user_id uuid references auth.users(id),
  user_agent text,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- 显式授予写入权限（客户端只需要 insert，不能读取/修改/删除）
grant insert on public.feedback to anon, authenticated;

-- 仅开放写入（匿名 + 已登录用户均可 insert），不创建 select/update/delete 策略
drop policy if exists "任何人可提交反馈" on public.feedback;
create policy "任何人可提交反馈" on public.feedback
  for insert to anon, authenticated
  with check (true);

-- 索引：按时间倒序查看
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
