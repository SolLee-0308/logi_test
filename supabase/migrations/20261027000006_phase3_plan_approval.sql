-- =============================================================
-- 06. 3단계: 입고예정 등록·승인, 화주 품목 등록(3PL 승인), 화주 차량 등록(화주 간 중복 허용)
-- =============================================================

-- ---------- 이력 테이블 재구성 헬퍼 ----------
-- 원본에 컬럼을 추가하면 <table>_hist 의 컬럼 순서(원본 컬럼 → hist 컬럼)가 깨지므로
-- 기존 이력을 보존한 채 이력 테이블을 다시 만든다.
create or replace function public.fn_rebuild_history(p_table text)
returns void
language plpgsql
as $$
declare
  v_hist text := p_table || '_hist';
  v_old  text := p_table || '_hist_old';
  v_cols text;
  v_col  text;
begin
  execute format('alter table public.%I rename to %I', v_hist, v_old);
  execute format('alter index public.%I rename to %I', v_hist || '_at_idx', v_old || '_at_idx');
  execute format('alter index public.%I rename to %I', v_hist || '_pkey', v_old || '_pkey');
  execute format('drop policy if exists %I on public.%I', v_hist || '_select', v_old);

  perform public.fn_enable_history(p_table);

  -- 이력은 과거 시점 행을 그대로 담으므로 원본의 NOT NULL 제약을 두지 않는다
  -- (새로 추가된 컬럼은 기존 이력 행에서 null)
  for v_col in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = v_hist and is_nullable = 'NO'
      and column_name not in ('hist_op', 'hist_at', 'hist_id')
  loop
    execute format('alter table public.%I alter column %I drop not null', v_hist, v_col);
  end loop;

  -- 기존·새 이력 테이블에 모두 있는 컬럼만 옮긴다 (원본 컬럼 삭제에도 대응)
  select string_agg(quote_ident(o.column_name), ', ' order by o.ordinal_position) into v_cols
  from information_schema.columns o
  join information_schema.columns n
    on n.table_schema = 'public' and n.table_name = v_hist and n.column_name = o.column_name
  where o.table_schema = 'public' and o.table_name = v_old;

  execute format('insert into public.%I (%s) overriding system value select %s from public.%I',
                 v_hist, v_cols, v_cols, v_old);
  execute format('drop table public.%I', v_old);
  execute format('select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(hist_id) from public.%I), 0) + 1, false)',
                 'public.' || v_hist, 'hist_id', v_hist);
  execute format('create policy %I on public.%I for select to authenticated using (public.is_internal())',
                 v_hist || '_select', v_hist);
  execute format('revoke insert, update, delete on public.%I from anon, authenticated', v_hist);
end;
$$;
revoke execute on function public.fn_rebuild_history(text) from public;

-- 3PL 승인 권한: 내부 관리자·운영자
create or replace function public.can_approve()
returns boolean
language sql
stable
as $$
  select public.is_internal() and public.auth_role() in ('ADMIN', 'OPERATOR');
$$;

-- =============================================================
-- 1. 차량: 화주별 등록, 화주 간 같은 차량번호 허용
-- =============================================================
alter table public.vehicles drop constraint vehicles_vehicle_no_key;
alter table public.vehicles add constraint vehicles_shipper_vehicle_no_uk unique (shipper_id, vehicle_no);
create index vehicles_no_idx on public.vehicles (vehicle_no);

drop policy vehicles_write on public.vehicles;
create policy vehicles_admin on public.vehicles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy vehicles_shipper_insert on public.vehicles for insert to authenticated
  with check (public.auth_user_type() = 'SHIPPER' and shipper_id = public.auth_shipper_id());
create policy vehicles_shipper_update on public.vehicles for update to authenticated
  using (public.auth_user_type() = 'SHIPPER' and shipper_id = public.auth_shipper_id())
  with check (public.auth_user_type() = 'SHIPPER' and shipper_id = public.auth_shipper_id());

-- =============================================================
-- 2. 품목: 화주 등록 → 3PL 승인. 승인 후 화주가 수정하면 재승인
-- =============================================================
alter table public.items
  add column approval_status varchar(10) not null default 'APPROVED'
    check (approval_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column approved_by   uuid,
  add column approved_at   timestamptz,
  add column reject_reason text;
create index items_approval_idx on public.items (approval_status);
select public.fn_rebuild_history('items');

create or replace function public.fn_items_approval()
returns trigger
language plpgsql
as $$
begin
  -- 승인 RPC 또는 시스템(마이그레이션·서비스 키) 처리
  if coalesce(current_setting('app.allow_status_change', true), '') = 'on' or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if public.is_internal() then
      new.approval_status := 'APPROVED';
      new.approved_by := auth.uid();
      new.approved_at := now();
    else
      new.approval_status := 'PENDING';
      new.approved_by := null;
      new.approved_at := null;
    end if;
    new.reject_reason := null;
    return new;
  end if;

  if (new.approval_status, new.approved_by, new.approved_at, new.reject_reason)
     is distinct from (old.approval_status, old.approved_by, old.approved_at, old.reject_reason) then
    raise exception '품목 승인 상태는 승인·반려 처리로만 변경할 수 있습니다.' using errcode = 'P0001';
  end if;

  -- 화주가 품목 정보를 바꾸면 다시 승인대기
  if not public.is_internal()
     and (new.shipper_item_code, new.item_name, new.spec, new.barcode, new.uom_code,
          new.box_qty, new.lot_yn, new.expiry_yn)
         is distinct from
         (old.shipper_item_code, old.item_name, old.spec, old.barcode, old.uom_code,
          old.box_qty, old.lot_yn, old.expiry_yn) then
    new.approval_status := 'PENDING';
    new.approved_by := null;
    new.approved_at := null;
    new.reject_reason := null;
  end if;
  return new;
end;
$$;
create trigger trg_items_approval before insert or update on public.items
  for each row execute function public.fn_items_approval();

drop policy items_write on public.items;
create policy items_admin on public.items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy items_shipper_insert on public.items for insert to authenticated
  with check (public.auth_user_type() = 'SHIPPER' and shipper_id = public.auth_shipper_id());
create policy items_shipper_update on public.items for update to authenticated
  using (public.auth_user_type() = 'SHIPPER' and shipper_id = public.auth_shipper_id())
  with check (public.auth_user_type() = 'SHIPPER' and shipper_id = public.auth_shipper_id());

create or replace function public.approve_items(p_item_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.can_approve() then
    raise exception '품목 승인 권한이 없습니다.' using errcode = 'P0001';
  end if;
  perform public.fn_allow_status_change();
  update items
  set approval_status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), reject_reason = null
  where id = any (p_item_ids) and approval_status <> 'APPROVED';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.reject_item(p_item_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_approve() then
    raise exception '품목 반려 권한이 없습니다.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception '반려 사유를 입력하세요.' using errcode = 'P0001';
  end if;
  perform public.fn_allow_status_change();
  update items
  set approval_status = 'REJECTED', approved_by = null, approved_at = null, reject_reason = trim(p_reason)
  where id = p_item_id and approval_status = 'PENDING';
  if not found then
    raise exception '승인대기 상태의 품목만 반려할 수 있습니다.' using errcode = 'P0001';
  end if;
end;
$$;

-- =============================================================
-- 3. 입고예정: 라인별 승인수량 조정 사유, 같은 품목 중복 라인 금지
-- =============================================================
alter table public.inbound_plan_lines
  add column adjust_reason text,
  add constraint inbound_plan_lines_approved_le_plan_ck check (approved_qty <= plan_qty),
  add constraint inbound_plan_lines_item_uk unique (plan_id, item_id);
select public.fn_rebuild_history('inbound_plan_lines');

-- R1·R2: PENDING 에서만 라인 변경, 품목은 같은 화주의 사용 중·승인된 품목
create or replace function public.fn_guard_plan_line()
returns trigger
language plpgsql
as $$
declare
  v_plan public.inbound_plans;
  v_rec  public.inbound_plan_lines := coalesce(new, old);
begin
  select * into v_plan from public.inbound_plans where id = v_rec.plan_id;
  if v_plan.id is null then
    return coalesce(new, old);   -- 헤더 cascade 삭제 중
  end if;

  -- asn_qty 집계 갱신은 상태와 무관하게 허용
  if tg_op = 'UPDATE'
     and (new.item_id, new.plan_qty, new.approved_qty, new.adjust_reason, new.line_no, new.remark)
         is not distinct from
         (old.item_id, old.plan_qty, old.approved_qty, old.adjust_reason, old.line_no, old.remark) then
    return new;
  end if;

  if v_plan.status <> 'PENDING'
     and coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
    raise exception '입고예정 %은(는) % 상태라 라인을 변경할 수 없습니다.', v_plan.plan_no, v_plan.status
      using errcode = 'P0001';
  end if;

  if (tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.item_id is distinct from old.item_id))
     and not exists (
       select 1 from public.items i
       where i.id = new.item_id and i.shipper_id = v_plan.shipper_id
         and i.is_active and i.approval_status = 'APPROVED'
     ) then
    raise exception '입고예정 품목은 화주사의 사용 중이며 승인된 품목이어야 합니다.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

-- 입고예정 저장(등록·수정): 헤더와 라인을 한 트랜잭션으로 저장. 호출자 권한(RLS) 적용
--   p_lines: [{ "item_id": uuid, "plan_qty": number, "remark": text }]
create or replace function public.save_inbound_plan(
  p_plan_id     uuid,
  p_shipper_id  uuid,
  p_plan_date   date,
  p_remark      text,
  p_source_type text,
  p_lines       jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_plan_id uuid := p_plan_id;
  v_center  uuid;
  v_line    jsonb;
  v_no      integer := 0;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception '입고 품목을 1건 이상 입력하세요.' using errcode = 'P0001';
  end if;
  if p_plan_date < (now() at time zone 'Asia/Seoul')::date then
    raise exception '입고예정일은 오늘 이후여야 합니다.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.shippers where id = p_shipper_id and is_active) then
    raise exception '사용 중인 화주사가 아닙니다.' using errcode = 'P0001';
  end if;

  if v_plan_id is null then
    select id into v_center from public.centers where is_default;
    insert into public.inbound_plans (shipper_id, center_id, plan_date, remark, source_type)
    values (p_shipper_id, v_center, p_plan_date, nullif(trim(p_remark), ''), coalesce(p_source_type, 'MANUAL'))
    returning id into v_plan_id;
  else
    update public.inbound_plans
    set plan_date = p_plan_date, remark = nullif(trim(p_remark), '')
    where id = v_plan_id and shipper_id = p_shipper_id;
    if not found then
      raise exception '수정할 입고예정을 찾을 수 없습니다.' using errcode = 'P0001';
    end if;
    delete from public.inbound_plan_lines where plan_id = v_plan_id;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_no := v_no + 1;
    insert into public.inbound_plan_lines (plan_id, line_no, item_id, plan_qty, remark)
    values (v_plan_id, v_no, (v_line ->> 'item_id')::uuid, (v_line ->> 'plan_qty')::numeric,
            nullif(trim(v_line ->> 'remark'), ''));
  end loop;
  return v_plan_id;
end;
$$;

-- 입고예정 최종 승인: 라인별 승인수량(0~예정수량), 감량 시 사유 필수
--   p_lines: [{ "line_id": uuid, "approved_qty": number, "adjust_reason": text }]
create or replace function public.approve_inbound_plan(p_plan_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan   inbound_plans;
  v_line   inbound_plan_lines;
  v_input  jsonb;
  v_qty    numeric;
  v_reason text;
  v_total  numeric := 0;
begin
  if not public.can_approve() then
    raise exception '입고 승인 권한이 없습니다.' using errcode = 'P0001';
  end if;
  select * into v_plan from inbound_plans where id = p_plan_id for update;
  if v_plan.id is null or v_plan.status <> 'PENDING' then
    raise exception '승인대기 상태의 입고예정만 승인할 수 있습니다.' using errcode = 'P0001';
  end if;

  perform public.fn_allow_status_change();
  for v_line in select * from inbound_plan_lines where plan_id = p_plan_id order by line_no loop
    select e into v_input from jsonb_array_elements(p_lines) e where (e ->> 'line_id')::uuid = v_line.id;
    if v_input is null then
      raise exception '%번 라인의 승인수량이 없습니다.', v_line.line_no using errcode = 'P0001';
    end if;
    v_qty := (v_input ->> 'approved_qty')::numeric;
    v_reason := nullif(trim(v_input ->> 'adjust_reason'), '');
    if v_qty is null or v_qty < 0 or v_qty > v_line.plan_qty then
      raise exception '%번 라인 승인수량은 0 ~ %이어야 합니다.', v_line.line_no, v_line.plan_qty using errcode = 'P0001';
    end if;
    if v_qty < v_line.plan_qty and v_reason is null then
      raise exception '%번 라인은 예정수량보다 적게 승인하므로 조정 사유가 필요합니다.', v_line.line_no using errcode = 'P0001';
    end if;
    update inbound_plan_lines
    set approved_qty = v_qty, adjust_reason = case when v_qty < plan_qty then v_reason end
    where id = v_line.id;
    v_total := v_total + v_qty;
  end loop;

  if v_total = 0 then
    raise exception '승인수량이 모두 0입니다. 승인 대신 반려하세요.' using errcode = 'P0001';
  end if;
  update inbound_plans
  set status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), reject_reason = null
  where id = p_plan_id;
end;
$$;

create or replace function public.reject_inbound_plan(p_plan_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_approve() then
    raise exception '입고 반려 권한이 없습니다.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception '반려 사유를 입력하세요.' using errcode = 'P0001';
  end if;
  perform public.fn_allow_status_change();
  update inbound_plans
  set status = 'REJECTED', reject_reason = trim(p_reason), approved_by = auth.uid(), approved_at = now()
  where id = p_plan_id and status = 'PENDING';
  if not found then
    raise exception '승인대기 상태의 입고예정만 반려할 수 있습니다.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.cancel_inbound_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan inbound_plans;
begin
  select * into v_plan from inbound_plans where id = p_plan_id for update;
  if v_plan.id is null or not public.can_access_shipper(v_plan.shipper_id) then
    raise exception '입고예정을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_plan.status <> 'PENDING' then
    raise exception '승인대기 상태에서만 취소할 수 있습니다. (현재: %)', v_plan.status using errcode = 'P0001';
  end if;
  perform public.fn_allow_status_change();
  update inbound_plans set status = 'CANCELLED' where id = p_plan_id;
end;
$$;

revoke execute on function
  public.approve_items(uuid[]), public.reject_item(uuid, text),
  public.save_inbound_plan(uuid, uuid, date, text, text, jsonb),
  public.approve_inbound_plan(uuid, jsonb), public.reject_inbound_plan(uuid, text),
  public.cancel_inbound_plan(uuid)
  from public, anon;
grant execute on function
  public.approve_items(uuid[]), public.reject_item(uuid, text),
  public.save_inbound_plan(uuid, uuid, date, text, text, jsonb),
  public.approve_inbound_plan(uuid, jsonb), public.reject_inbound_plan(uuid, text),
  public.cancel_inbound_plan(uuid)
  to authenticated;

-- 입고예정 목록용 요약 뷰 (호출자 RLS 적용)
create view public.v_inbound_plans
with (security_invoker = true)
as
select
  p.*,
  s.shipper_code,
  s.shipper_name,
  (select count(*) from public.inbound_plan_lines l where l.plan_id = p.id)::int            as line_count,
  (select coalesce(sum(plan_qty), 0) from public.inbound_plan_lines l where l.plan_id = p.id) as total_plan_qty,
  (select sum(approved_qty) from public.inbound_plan_lines l where l.plan_id = p.id)          as total_approved_qty,
  (select user_name from public.profiles u where u.id = p.created_by)                        as created_by_name,
  (select user_name from public.profiles u where u.id = p.approved_by)                       as approved_by_name
from public.inbound_plans p
join public.shippers s on s.id = p.shipper_id;
