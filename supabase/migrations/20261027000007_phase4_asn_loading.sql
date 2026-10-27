-- =============================================================
-- 07. 4단계: ASN(차량별 상차지시) 등록, PDA 상차(스캔 누적·수동 선택·정정 이력), 상차완료
--     정합성 규칙 R3-1(같은 일자), R6(지시 품목만 상차), R7(상차=지시 수량) — docs/02-document-flow.md
-- =============================================================

-- ---------- R3·R3-1·R4·R5: ASN 라인은 같은 일자의 승인된 입고예정 라인만 ----------
create or replace function public.fn_check_asn_line()
returns trigger
language plpgsql
as $$
declare
  v_asn       public.asns;
  v_plan      public.inbound_plans;
  v_line      public.inbound_plan_lines;
  v_allocated numeric;
begin
  -- 수량 집계(loaded/received/return) 갱신만 있는 경우는 통과
  if tg_op = 'UPDATE'
     and (new.plan_line_id, new.order_qty, new.line_no) is not distinct from (old.plan_line_id, old.order_qty, old.line_no) then
    return new;
  end if;

  select * into v_asn from public.asns where id = new.asn_id;
  if v_asn.status <> 'REGISTERED' then
    raise exception 'ASN %은(는) % 상태라 라인을 변경할 수 없습니다.', v_asn.asn_no, v_asn.status using errcode = 'P0001';
  end if;
  if exists (select 1 from public.loadings l where l.asn_id = v_asn.id) then
    raise exception 'ASN %은(는) 상차가 시작되어 변경할 수 없습니다.', v_asn.asn_no using errcode = 'P0001';
  end if;

  select * into v_line from public.inbound_plan_lines where id = new.plan_line_id;
  select * into v_plan from public.inbound_plans where id = v_line.plan_id;
  if v_plan.status <> 'APPROVED' then
    raise exception '승인된 입고예정만 ASN에 배정할 수 있습니다. (%: %)', v_plan.plan_no, v_plan.status using errcode = 'P0001';
  end if;
  if v_plan.shipper_id <> v_asn.shipper_id then
    raise exception 'ASN과 입고예정의 화주사가 다릅니다.' using errcode = 'P0001';
  end if;
  if v_plan.plan_date <> v_asn.asn_date then
    raise exception 'ASN 일자(%)와 입고예정일(%)이 다릅니다. 같은 날짜의 승인분만 배정할 수 있습니다.',
      v_asn.asn_date, v_plan.plan_date using errcode = 'P0001';
  end if;

  new.item_id := v_line.item_id;

  select coalesce(sum(al.order_qty), 0) into v_allocated
  from public.asn_lines al
  join public.asns a on a.id = al.asn_id
  where al.plan_line_id = new.plan_line_id
    and a.status <> 'CANCELLED'
    and al.id <> new.id;
  if v_allocated + new.order_qty > coalesce(v_line.approved_qty, 0) then
    raise exception 'ASN 배정 수량이 승인 수량을 초과합니다. (승인 %, 기배정 %, 요청 %)',
      v_line.approved_qty, v_allocated, new.order_qty using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 차량 검증은 등록·차량 변경 때만 (상태 변경 시 그사이 미사용 처리된 차량 때문에 막히지 않도록)
create or replace function public.fn_check_asn_header()
returns trigger
language plpgsql
as $$
declare
  v_vehicle public.vehicles;
begin
  if tg_op = 'UPDATE' and old.status <> 'REGISTERED'
     and coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
    raise exception 'ASN %은(는) % 상태라 수정할 수 없습니다.', old.asn_no, old.status using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id or new.shipper_id is distinct from old.shipper_id then
    select * into v_vehicle from public.vehicles where id = new.vehicle_id;
    if v_vehicle.shipper_id is distinct from new.shipper_id or not v_vehicle.is_active then
      raise exception 'ASN 차량은 해당 화주사의 사용 중인 차량이어야 합니다.' using errcode = 'P0001';
    end if;
    new.vehicle_no := v_vehicle.vehicle_no;
  end if;
  return new;
end;
$$;

-- ASN 일자를 바꾸면 기존 라인과 날짜가 어긋나므로, 라인이 있으면 일자 변경 금지(저장 RPC는 라인을 지운 뒤 변경)
create or replace function public.fn_guard_asn_date()
returns trigger
language plpgsql
as $$
begin
  if new.asn_date is distinct from old.asn_date
     and exists (select 1 from public.asn_lines where asn_id = new.id) then
    raise exception 'ASN 라인이 있는 상태에서는 일자를 바꿀 수 없습니다.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_guard_asn_date before update of asn_date on public.asns
  for each row execute function public.fn_guard_asn_date();

-- ---------- 상차 스캔 이력 (스캔 1건 = 1행, 정정은 ADJUST 행) ----------
create table public.loading_scans (
  id              uuid          primary key default gen_random_uuid(),
  loading_id      uuid          not null references public.loadings (id) on delete cascade,
  asn_line_id     uuid          not null references public.asn_lines (id) on delete restrict,
  item_id         uuid          not null references public.items (id),
  scanned_barcode varchar(50),
  qty             numeric(15,3) not null check (qty <> 0),
  method          varchar(10)   not null check (method in ('SCAN', 'MANUAL', 'ADJUST')),
  created_at      timestamptz   not null default now(),
  created_by      uuid,
  updated_at      timestamptz   not null default now(),
  updated_by      uuid
);
create index loading_scans_loading_idx on public.loading_scans (loading_id, asn_line_id);
alter table public.loading_scans enable row level security;
create policy loading_scans_select on public.loading_scans for select to authenticated
  using (exists (select 1 from public.loadings l join public.asns a on a.id = l.asn_id
                 where l.id = loading_id and public.can_access_shipper(a.shipper_id)));
select public.fn_enable_audit('loading_scans'), public.fn_enable_history('loading_scans');
do $$ begin
  execute 'create policy loading_scans_hist_select on public.loading_scans_hist for select to authenticated using (public.is_internal())';
  execute 'revoke insert, update, delete on public.loading_scans_hist from anon, authenticated';
end $$;

-- 스캔 합계 → loading_lines.loaded_qty (→ 기존 트리거로 asn_lines.loaded_qty)
create or replace function public.fn_after_loading_scan()
returns trigger
language plpgsql
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(qty), 0) into v_total
  from public.loading_scans where loading_id = new.loading_id and asn_line_id = new.asn_line_id;
  if v_total < 0 then
    raise exception '상차수량은 0보다 작을 수 없습니다.' using errcode = 'P0001';
  end if;
  insert into public.loading_lines (loading_id, asn_line_id, item_id, scanned_barcode, loaded_qty)
  values (new.loading_id, new.asn_line_id, new.item_id, new.scanned_barcode, v_total)
  on conflict (loading_id, asn_line_id)
  do update set loaded_qty = excluded.loaded_qty,
                scanned_barcode = coalesce(excluded.scanned_barcode, public.loading_lines.scanned_barcode);
  return null;
end;
$$;
create trigger trg_after_loading_scan after insert on public.loading_scans
  for each row execute function public.fn_after_loading_scan();

-- 상차 전표 접근 확인 (화주 본인 또는 내부 사용자)
create or replace function public.fn_loading_for_update(p_loading_id uuid)
returns public.loadings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loading loadings;
  v_asn     asns;
begin
  select * into v_loading from loadings where id = p_loading_id for update;
  select * into v_asn from asns where id = v_loading.asn_id;
  if v_loading.id is null or not public.can_access_shipper(v_asn.shipper_id) then
    raise exception '상차 전표를 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_loading.status <> 'LOADING' then
    raise exception '상차완료된 전표입니다. (%)', v_loading.loading_no using errcode = 'P0001';
  end if;
  return v_loading;
end;
$$;
revoke execute on function public.fn_loading_for_update(uuid) from public, anon, authenticated;

-- ---------- ASN 저장(등록·수정): 화주사 사용자만. 라인은 같은 일자의 승인 라인 ----------
--   p_lines: [{ "plan_line_id": uuid, "order_qty": number }]
create or replace function public.save_asn(
  p_asn_id     uuid,
  p_shipper_id uuid,
  p_asn_date   date,
  p_vehicle_id uuid,
  p_remark     text,
  p_lines      jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_asn_id uuid := p_asn_id;
  v_center uuid;
  v_line   jsonb;
  v_no     integer := 0;
begin
  if public.auth_user_type() is distinct from 'SHIPPER' then
    raise exception 'ASN은 화주사 사용자가 등록합니다. 3PL은 조회만 할 수 있습니다.' using errcode = 'P0001';
  end if;
  if p_lines is null or (select count(*) from jsonb_array_elements(p_lines) e where (e ->> 'order_qty')::numeric > 0) = 0 then
    raise exception '차량에 배정할 품목 수량을 1건 이상 입력하세요.' using errcode = 'P0001';
  end if;

  if v_asn_id is null then
    select id into v_center from public.centers where is_default;
    insert into public.asns (shipper_id, center_id, asn_date, vehicle_id, remark)
    values (p_shipper_id, v_center, p_asn_date, p_vehicle_id, nullif(trim(p_remark), ''))
    returning id into v_asn_id;
  else
    if exists (select 1 from public.loadings where asn_id = v_asn_id) then
      raise exception '상차가 시작된 ASN은 수정할 수 없습니다.' using errcode = 'P0001';
    end if;
    delete from public.asn_lines where asn_id = v_asn_id;
    update public.asns
    set asn_date = p_asn_date, vehicle_id = p_vehicle_id, remark = nullif(trim(p_remark), '')
    where id = v_asn_id and shipper_id = p_shipper_id;
    if not found then
      raise exception '수정할 ASN을 찾을 수 없습니다.' using errcode = 'P0001';
    end if;
  end if;

  for v_line in
    select e from jsonb_array_elements(p_lines) e where (e ->> 'order_qty')::numeric > 0
  loop
    v_no := v_no + 1;
    insert into public.asn_lines (asn_id, line_no, plan_line_id, item_id, order_qty)
    select v_asn_id, v_no, pl.id, pl.item_id, (v_line ->> 'order_qty')::numeric
    from public.inbound_plan_lines pl where pl.id = (v_line ->> 'plan_line_id')::uuid;
    if not found then
      raise exception '입고예정 라인을 찾을 수 없습니다.' using errcode = 'P0001';
    end if;
  end loop;
  return v_asn_id;
end;
$$;

create or replace function public.cancel_asn(p_asn_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asn asns;
begin
  select * into v_asn from asns where id = p_asn_id for update;
  if v_asn.id is null or not public.can_access_shipper(v_asn.shipper_id)
     or public.auth_user_type() is distinct from 'SHIPPER' then
    raise exception 'ASN을 찾을 수 없거나 취소 권한이 없습니다.' using errcode = 'P0001';
  end if;
  if v_asn.status <> 'REGISTERED' or exists (select 1 from loadings where asn_id = p_asn_id) then
    raise exception '상차가 시작되기 전의 ASN만 취소할 수 있습니다.' using errcode = 'P0001';
  end if;
  perform public.fn_allow_status_change();
  update asns set status = 'CANCELLED' where id = p_asn_id;   -- 배정수량은 트리거가 재집계
end;
$$;

-- ---------- PDA 상차 ----------
-- 상차지시서 바코드(ASN 번호)로 상차 시작 (이미 시작했으면 이어서)
create or replace function public.start_loading(p_asn_no text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asn     asns;
  v_loading uuid;
begin
  select * into v_asn from asns where asn_no = upper(trim(p_asn_no));
  if v_asn.id is null or not public.can_access_shipper(v_asn.shipper_id) then
    raise exception '상차지시서를 찾을 수 없습니다. (%)', p_asn_no using errcode = 'P0001';
  end if;
  if v_asn.status = 'CANCELLED' then
    raise exception '취소된 ASN입니다. (%)', v_asn.asn_no using errcode = 'P0001';
  end if;
  if v_asn.status <> 'REGISTERED' then
    raise exception '이미 상차완료된 ASN입니다. (%)', v_asn.asn_no using errcode = 'P0001';
  end if;

  select id into v_loading from loadings where asn_id = v_asn.id;
  if v_loading is null then
    insert into loadings (asn_id, worker_id) values (v_asn.id, auth.uid()) returning id into v_loading;
  end if;
  return v_loading;
end;
$$;

-- 상차 입력: 바코드 스캔(SCAN) 또는 목록 선택(MANUAL)으로 수량 누적 (R6)
create or replace function public.scan_loading(
  p_loading_id  uuid,
  p_barcode     text,
  p_asn_line_id uuid,
  p_qty         numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loading loadings := public.fn_loading_for_update(p_loading_id);
  v_line    asn_lines;
  v_method  text;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception '수량은 0보다 커야 합니다.' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_barcode), '') <> '' then
    v_method := 'SCAN';
    select al.* into v_line
    from asn_lines al join items i on i.id = al.item_id
    where al.asn_id = v_loading.asn_id and i.barcode = trim(p_barcode)
    limit 1;
    if v_line.id is null then
      raise exception '상차지시에 없는 품목 바코드입니다. (%)', p_barcode using errcode = 'P0001';
    end if;
  else
    v_method := 'MANUAL';
    select * into v_line from asn_lines where id = p_asn_line_id and asn_id = v_loading.asn_id;
    if v_line.id is null then
      raise exception '상차지시에 없는 품목입니다.' using errcode = 'P0001';
    end if;
  end if;

  insert into loading_scans (loading_id, asn_line_id, item_id, scanned_barcode, qty, method)
  values (p_loading_id, v_line.id, v_line.item_id, nullif(trim(p_barcode), ''), p_qty, v_method);
  return v_line.id;
end;
$$;

-- 상차수량 정정: 목표 수량으로 맞추고 차이를 ADJUST 이력으로 남김
create or replace function public.adjust_loading_qty(p_loading_id uuid, p_asn_line_id uuid, p_qty numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loading loadings := public.fn_loading_for_update(p_loading_id);
  v_line    asn_lines;
  v_current numeric;
begin
  if p_qty is null or p_qty < 0 then
    raise exception '수량은 0 이상이어야 합니다.' using errcode = 'P0001';
  end if;
  select * into v_line from asn_lines where id = p_asn_line_id and asn_id = v_loading.asn_id;
  if v_line.id is null then
    raise exception '상차지시에 없는 품목입니다.' using errcode = 'P0001';
  end if;
  select coalesce(sum(qty), 0) into v_current
  from loading_scans where loading_id = p_loading_id and asn_line_id = p_asn_line_id;
  if p_qty <> v_current then
    insert into loading_scans (loading_id, asn_line_id, item_id, qty, method)
    values (p_loading_id, v_line.id, v_line.item_id, p_qty - v_current, 'ADJUST');
  end if;
end;
$$;

-- 상차완료 (R7): 모든 라인의 상차수량 = 지시수량
create or replace function public.complete_loading(p_loading_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loading  loadings := public.fn_loading_for_update(p_loading_id);
  v_mismatch integer;
  v_detail   text;
begin
  select count(*), string_agg(format('%s번 %s(지시 %s / 상차 %s)', al.line_no, i.item_name,
                                     trim_scale(al.order_qty), trim_scale(al.loaded_qty)), ', ' order by al.line_no)
  into v_mismatch, v_detail
  from asn_lines al join items i on i.id = al.item_id
  where al.asn_id = v_loading.asn_id and al.loaded_qty <> al.order_qty;
  if v_mismatch > 0 then
    raise exception '상차수량이 지시수량과 다른 품목이 %건 있습니다: %', v_mismatch, v_detail using errcode = 'P0001';
  end if;

  perform public.fn_allow_status_change();
  update loadings set status = 'COMPLETED', completed_at = now(), worker_id = coalesce(worker_id, auth.uid())
  where id = p_loading_id;
  update asns set status = 'LOADED' where id = v_loading.asn_id;
end;
$$;

revoke execute on function
  public.save_asn(uuid, uuid, date, uuid, text, jsonb), public.cancel_asn(uuid),
  public.start_loading(text), public.scan_loading(uuid, text, uuid, numeric),
  public.adjust_loading_qty(uuid, uuid, numeric), public.complete_loading(uuid)
  from public, anon;
grant execute on function
  public.save_asn(uuid, uuid, date, uuid, text, jsonb), public.cancel_asn(uuid),
  public.start_loading(text), public.scan_loading(uuid, text, uuid, numeric),
  public.adjust_loading_qty(uuid, uuid, numeric), public.complete_loading(uuid)
  to authenticated;

-- ---------- 조회 뷰 (호출자 RLS 적용) ----------
-- ASN 목록
create view public.v_asns
with (security_invoker = true)
as
select
  a.*,
  s.shipper_code,
  s.shipper_name,
  v.vehicle_type_code,
  v.tonnage,
  v.driver_name,
  v.driver_tel,
  c.center_name,
  c.address as center_address,
  l.id           as loading_id,
  l.loading_no,
  l.status       as loading_status,
  l.completed_at as loaded_at,
  (select count(*) from public.asn_lines x where x.asn_id = a.id)::int                 as line_count,
  (select coalesce(sum(order_qty), 0) from public.asn_lines x where x.asn_id = a.id)  as total_order_qty,
  (select coalesce(sum(loaded_qty), 0) from public.asn_lines x where x.asn_id = a.id) as total_loaded_qty,
  (select user_name from public.profiles u where u.id = a.created_by)                 as created_by_name
from public.asns a
join public.shippers s on s.id = a.shipper_id
join public.vehicles v on v.id = a.vehicle_id
join public.centers c  on c.id = a.center_id
left join public.loadings l on l.asn_id = a.id;

-- ASN 라인 (품목·원천 입고예정 포함)
create view public.v_asn_lines
with (security_invoker = true)
as
select
  al.*,
  p.plan_no,
  i.internal_code,
  i.shipper_item_code,
  i.item_name,
  i.spec,
  i.barcode,
  i.uom_code
from public.asn_lines al
join public.inbound_plan_lines pl on pl.id = al.plan_line_id
join public.inbound_plans p       on p.id = pl.plan_id
join public.items i               on i.id = al.item_id;

-- ASN 배정 대상: 승인된 입고예정 라인과 잔여 수량
create view public.v_open_plan_lines
with (security_invoker = true)
as
select
  pl.id           as plan_line_id,
  pl.plan_id,
  p.plan_no,
  p.plan_date,
  p.shipper_id,
  pl.line_no,
  pl.item_id,
  i.internal_code,
  i.shipper_item_code,
  i.item_name,
  i.spec,
  i.uom_code,
  pl.approved_qty,
  pl.asn_qty,
  pl.approved_qty - pl.asn_qty as remaining_qty
from public.inbound_plan_lines pl
join public.inbound_plans p on p.id = pl.plan_id
join public.items i         on i.id = pl.item_id
where p.status = 'APPROVED' and pl.approved_qty > 0;
