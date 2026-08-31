-- ============================================================
-- 仓序食时 - 意见反馈表（独立脚本，可单独运行）
-- ============================================================
-- 用途：当你已经建过其它表、只想开通「向开发者反馈」功能时，
--       直接在 Supabase SQL Editor 粘贴本文件全部内容并 RUN 即可，
--       不会影响 products / orders / inventory 等已有表和数据。
-- 说明：任何用户（含未登录匿名用户）都可以【提交】反馈，
--       但客户端【不能】读取/修改/删除；反馈内容请在
--       Supabase 后台 Table Editor -> feedback 表中查看。
-- ============================================================

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

-- 客户端只需要写入权限
grant insert on public.feedback to anon, authenticated;

-- 仅开放写入（匿名 + 已登录用户均可 insert），不创建 select/update/delete 策略
drop policy if exists "任何人可提交反馈" on public.feedback;
create policy "任何人可提交反馈" on public.feedback
  for insert to anon, authenticated
  with check (true);

-- 索引：后台按时间倒序查看
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
