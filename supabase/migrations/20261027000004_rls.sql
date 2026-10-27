-- =============================================================
-- 04. 권한(RLS): 내부 사용자(ADMIN/OPERATOR/WORKER) / 화주 사용자(SHIPPER_USER)
--     권한 매트릭스는 docs/04-master-data.md 참조
-- =============================================================

-- 로그인 사용자 정보 헬퍼 (security definer: profiles RLS 재귀 방지)
create or replace function public.auth_user_type()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select user_type from profiles where id = auth.uid() and is_active;
$$;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

create or replace function public.auth_shipper_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select shipper_id from profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_internal()
returns boolean
language sql
stable
as $$
  select coalesce(public.auth_user_type() = 'INTERNAL', false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.auth_user_type() = 'INTERNAL' and public.auth_role() = 'ADMIN', false);
$$;

-- 활성 프로필이 있는 사용자 (내부 또는 화주)
create or replace function public.is_member()
returns boolean
language sql
stable
as $$
  select public.auth_user_type() is not null;
$$;

-- 내부 사용자이거나, 해당 화주의 사용자
create or replace function public.can_access_shipper(p_shipper_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_internal() or p_shipper_id = public.auth_shipper_id();
$$;

-- ---------- RLS 활성화 ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'code_groups', 'codes', 'company', 'shippers', 'centers', 'items', 'vehicles', 'profiles',
    'ai_import_jobs', 'inbound_plans', 'inbound_plan_lines', 'asns', 'asn_lines',
    'loadings', 'loading_lines', 'receipts', 'receipt_lines', 'receipt_images'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------- 기준정보 ----------
-- 공통코드·센터: 모든 사용자 조회, 관리자만 변경
create policy code_groups_select on public.code_groups for select to authenticated using (public.is_member());
create policy code_groups_write  on public.code_groups for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy codes_select       on public.codes       for select to authenticated using (public.is_member());
create policy codes_write        on public.codes       for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy centers_select     on public.centers     for select to authenticated using (public.is_member());
create policy centers_write      on public.centers     for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- 회사정보: 내부 사용자 조회, 관리자 변경
create policy company_select on public.company for select to authenticated using (public.is_internal());
create policy company_write  on public.company for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- 화주사: 내부 전체 / 화주는 자기 회사
create policy shippers_select on public.shippers for select to authenticated using (public.can_access_shipper(id));
create policy shippers_write  on public.shippers for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- 품목·차량: 내부 전체 / 화주는 자기 데이터 조회
create policy items_select    on public.items    for select to authenticated using (public.can_access_shipper(shipper_id));
create policy items_write     on public.items    for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy vehicles_select on public.vehicles for select to authenticated using (public.can_access_shipper(shipper_id));
create policy vehicles_write  on public.vehicles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- 사용자: 본인 + 내부 사용자 조회, 관리자 변경 (생성·비밀번호는 Edge Function admin-users)
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_internal());
create policy profiles_write  on public.profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 입고 전표 ----------
-- 입고예정·ASN·상차: 내부 전체 / 화주는 자기 데이터 조회·등록·수정 (상태·정합성은 트리거와 RPC가 통제)
create policy ai_import_jobs_all on public.ai_import_jobs for all to authenticated
  using (public.can_access_shipper(shipper_id)) with check (public.can_access_shipper(shipper_id));

create policy inbound_plans_all on public.inbound_plans for all to authenticated
  using (public.can_access_shipper(shipper_id)) with check (public.can_access_shipper(shipper_id));
create policy inbound_plan_lines_all on public.inbound_plan_lines for all to authenticated
  using (exists (select 1 from public.inbound_plans p where p.id = plan_id and public.can_access_shipper(p.shipper_id)))
  with check (exists (select 1 from public.inbound_plans p where p.id = plan_id and public.can_access_shipper(p.shipper_id)));

create policy asns_all on public.asns for all to authenticated
  using (public.can_access_shipper(shipper_id)) with check (public.can_access_shipper(shipper_id));
create policy asn_lines_all on public.asn_lines for all to authenticated
  using (exists (select 1 from public.asns a where a.id = asn_id and public.can_access_shipper(a.shipper_id)))
  with check (exists (select 1 from public.asns a where a.id = asn_id and public.can_access_shipper(a.shipper_id)));

create policy loadings_all on public.loadings for all to authenticated
  using (exists (select 1 from public.asns a where a.id = asn_id and public.can_access_shipper(a.shipper_id)))
  with check (exists (select 1 from public.asns a where a.id = asn_id and public.can_access_shipper(a.shipper_id)));
create policy loading_lines_all on public.loading_lines for all to authenticated
  using (exists (select 1 from public.loadings l join public.asns a on a.id = l.asn_id
                 where l.id = loading_id and public.can_access_shipper(a.shipper_id)))
  with check (exists (select 1 from public.loadings l join public.asns a on a.id = l.asn_id
                      where l.id = loading_id and public.can_access_shipper(a.shipper_id)));

-- 검수: 화주는 조회만, 내부 사용자가 처리
create policy receipts_select on public.receipts for select to authenticated using (public.can_access_shipper(shipper_id));
create policy receipts_write  on public.receipts for all    to authenticated using (public.is_internal()) with check (public.is_internal());
create policy receipt_lines_select on public.receipt_lines for select to authenticated
  using (exists (select 1 from public.receipts r where r.id = receipt_id and public.can_access_shipper(r.shipper_id)));
create policy receipt_lines_write on public.receipt_lines for all to authenticated
  using (public.is_internal()) with check (public.is_internal());
create policy receipt_images_select on public.receipt_images for select to authenticated
  using (exists (select 1 from public.receipt_lines rl join public.receipts r on r.id = rl.receipt_id
                 where rl.id = receipt_line_id and public.can_access_shipper(r.shipper_id)));
create policy receipt_images_write on public.receipt_images for all to authenticated
  using (public.is_internal()) with check (public.is_internal());

-- ---------- 이력 테이블: 내부 사용자 조회 전용 ----------
do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name like '%\_hist' and table_type = 'BASE TABLE'
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_internal())',
                   t || '_select', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- 채번 테이블은 함수로만 접근
revoke all on public.doc_sequences from anon, authenticated;
revoke execute on function public.fn_next_doc_no(text, date) from public, anon;
grant execute on function public.fn_next_doc_no(text, date) to authenticated;
