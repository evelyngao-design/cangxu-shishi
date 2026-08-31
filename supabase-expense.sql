-- ============================================================
-- 仓序食时 - 订单表新增「支出类型」字段（独立迁移，可单独运行）
-- ============================================================
-- 用途：已建过 orders 表的项目，想开通「记一笔支出」（交通等非食材支出）
--       的云同步时，在 Supabase SQL Editor 粘贴本文件全部内容并 RUN 即可。
--       不影响现有采购订单与库存/饮食数据；可重复运行，不会报错。
-- 说明：kind = grocery(采购，默认) / expense(其他支出)；
--       expense_category 记录支出分类（交通出行、外食餐饮等）。
--       本地模式无需运行本脚本，功能立即可用。
-- ============================================================

alter table public.orders
  add column if not exists kind text default 'grocery';

alter table public.orders
  add column if not exists expense_category text default '';
