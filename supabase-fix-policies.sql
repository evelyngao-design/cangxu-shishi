-- ============================================================
-- 仓序食时 - 修复行级安全(RLS)策略（独立脚本，可单独/重复运行）
-- ============================================================
-- 用途：早期版本建表时若脚本中断，可能只建了「查看/新增」策略，
--       缺少「修改/删除」策略。云同步采用「先删后插」，缺少删除策略时
--       删除会被静默忽略，随后插入相同主键会报
--       duplicate key value violates unique constraint "..._pkey"。
--       本脚本为所有同步表补齐 查看/新增/修改/删除 四条策略。
-- 用法：在 Supabase SQL Editor 新建 query，粘贴本文件全部内容，点 RUN。
--       可重复运行，不会报错，也不会改动任何业务数据。
-- ============================================================

-- 通用策略模板：每条记录只能被其所属用户(user_id = auth.uid())访问
-- products 商品
alter table public.products enable row level security;
drop policy if exists "用户可查看自己的商品" on public.products;
drop policy if exists "用户可新增自己的商品" on public.products;
drop policy if exists "用户可修改自己的商品" on public.products;
drop policy if exists "用户可删除自己的商品" on public.products;
create policy "用户可查看自己的商品" on public.products for select using (auth.uid() = user_id);
create policy "用户可新增自己的商品" on public.products for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的商品" on public.products for update using (auth.uid() = user_id);
create policy "用户可删除自己的商品" on public.products for delete using (auth.uid() = user_id);

-- orders 订单
alter table public.orders enable row level security;
drop policy if exists "用户可查看自己的订单" on public.orders;
drop policy if exists "用户可新增自己的订单" on public.orders;
drop policy if exists "用户可修改自己的订单" on public.orders;
drop policy if exists "用户可删除自己的订单" on public.orders;
create policy "用户可查看自己的订单" on public.orders for select using (auth.uid() = user_id);
create policy "用户可新增自己的订单" on public.orders for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的订单" on public.orders for update using (auth.uid() = user_id);
create policy "用户可删除自己的订单" on public.orders for delete using (auth.uid() = user_id);

-- inventory 库存
alter table public.inventory enable row level security;
drop policy if exists "用户可查看自己的库存" on public.inventory;
drop policy if exists "用户可新增自己的库存" on public.inventory;
drop policy if exists "用户可修改自己的库存" on public.inventory;
drop policy if exists "用户可删除自己的库存" on public.inventory;
create policy "用户可查看自己的库存" on public.inventory for select using (auth.uid() = user_id);
create policy "用户可新增自己的库存" on public.inventory for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的库存" on public.inventory for update using (auth.uid() = user_id);
create policy "用户可删除自己的库存" on public.inventory for delete using (auth.uid() = user_id);

-- inventory_logs 库存日志（无独立修改需求，给查看/新增/删除）
alter table public.inventory_logs enable row level security;
drop policy if exists "用户可查看自己的库存日志" on public.inventory_logs;
drop policy if exists "用户可新增自己的库存日志" on public.inventory_logs;
drop policy if exists "用户可修改自己的库存日志" on public.inventory_logs;
drop policy if exists "用户可删除自己的库存日志" on public.inventory_logs;
create policy "用户可查看自己的库存日志" on public.inventory_logs for select using (auth.uid() = user_id);
create policy "用户可新增自己的库存日志" on public.inventory_logs for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的库存日志" on public.inventory_logs for update using (auth.uid() = user_id);
create policy "用户可删除自己的库存日志" on public.inventory_logs for delete using (auth.uid() = user_id);

-- diet 饮食
alter table public.diet enable row level security;
drop policy if exists "用户可查看自己的饮食" on public.diet;
drop policy if exists "用户可新增自己的饮食" on public.diet;
drop policy if exists "用户可修改自己的饮食" on public.diet;
drop policy if exists "用户可删除自己的饮食" on public.diet;
create policy "用户可查看自己的饮食" on public.diet for select using (auth.uid() = user_id);
create policy "用户可新增自己的饮食" on public.diet for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的饮食" on public.diet for update using (auth.uid() = user_id);
create policy "用户可删除自己的饮食" on public.diet for delete using (auth.uid() = user_id);

-- body_data 身体数据
alter table public.body_data enable row level security;
drop policy if exists "用户可查看自己的身体数据" on public.body_data;
drop policy if exists "用户可新增自己的身体数据" on public.body_data;
drop policy if exists "用户可修改自己的身体数据" on public.body_data;
drop policy if exists "用户可删除自己的身体数据" on public.body_data;
create policy "用户可查看自己的身体数据" on public.body_data for select using (auth.uid() = user_id);
create policy "用户可新增自己的身体数据" on public.body_data for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的身体数据" on public.body_data for update using (auth.uid() = user_id);
create policy "用户可删除自己的身体数据" on public.body_data for delete using (auth.uid() = user_id);

-- user_config 用户配置
alter table public.user_config enable row level security;
drop policy if exists "用户可查看自己的配置" on public.user_config;
drop policy if exists "用户可新增自己的配置" on public.user_config;
drop policy if exists "用户可修改自己的配置" on public.user_config;
drop policy if exists "用户可删除自己的配置" on public.user_config;
create policy "用户可查看自己的配置" on public.user_config for select using (auth.uid() = user_id);
create policy "用户可新增自己的配置" on public.user_config for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的配置" on public.user_config for update using (auth.uid() = user_id);
create policy "用户可删除自己的配置" on public.user_config for delete using (auth.uid() = user_id);

-- unassigned_food 待分配食物（旧表，保留策略以防仍存在）
alter table public.unassigned_food enable row level security;
drop policy if exists "用户可查看自己的待分配食物" on public.unassigned_food;
drop policy if exists "用户可新增自己的待分配食物" on public.unassigned_food;
drop policy if exists "用户可修改自己的待分配食物" on public.unassigned_food;
drop policy if exists "用户可删除自己的待分配食物" on public.unassigned_food;
create policy "用户可查看自己的待分配食物" on public.unassigned_food for select using (auth.uid() = user_id);
create policy "用户可新增自己的待分配食物" on public.unassigned_food for insert with check (auth.uid() = user_id);
create policy "用户可修改自己的待分配食物" on public.unassigned_food for update using (auth.uid() = user_id);
create policy "用户可删除自己的待分配食物" on public.unassigned_food for delete using (auth.uid() = user_id);
