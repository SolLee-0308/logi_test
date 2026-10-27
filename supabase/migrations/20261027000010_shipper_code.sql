-- =============================================================
-- 10. 화주사: 화주코드 자동채번(S + 5자리), 주소 분리(우편번호·기본주소·상세주소)
--     기존 화주사는 등록순으로 다시 채번한다. 다른 테이블은 shippers.id 로 연결되어 있어 영향 없음.
-- =============================================================

alter table public.shippers
  add column zip_code       varchar(5) check (zip_code ~ '^\d{5}$'),
  add column address_detail varchar(200);

comment on column public.shippers.address is '기본주소 (주소 검색 결과)';

-- 컬럼이 바뀌었으므로 아래 재채번(UPDATE) 이력이 쌓이기 전에 이력 테이블부터 재구성
select public.fn_rebuild_history('shippers');

-- ---------- 기존 화주사 재채번 ----------
-- 새 코드가 기존 코드와 겹쳐 UNIQUE 위반이 나지 않도록, 임시 코드(TMP_000001…)를 거쳐 확정한다
with ordered as (
  select id, row_number() over (order by created_at, shipper_code, id) as rn
  from public.shippers
)
update public.shippers s
set shipper_code = 'TMP_' || lpad(o.rn::text, 6, '0')
from ordered o
where o.id = s.id;

update public.shippers
set shipper_code = 'S' || lpad(substr(shipper_code, 5)::int::text, 5, '0');

alter table public.shippers drop constraint shippers_shipper_code_check;
alter table public.shippers add constraint shippers_shipper_code_check check (shipper_code ~ '^S\d{5}$');

-- 다음 번호는 기존 화주사 수 + 1 부터
create sequence public.shipper_code_seq;
select setval('public.shipper_code_seq',
              greatest((select count(*) from public.shippers), 1),
              (select count(*) from public.shippers) > 0);

-- ---------- 등록 시 자동채번, 등록 후 변경 불가 ----------
create or replace function public.fn_shipper_code()
returns trigger
language plpgsql
as $$
declare
  v_no bigint;
begin
  if tg_op = 'INSERT' then
    v_no := nextval('public.shipper_code_seq');
    if v_no > 99999 then
      raise exception '화주코드 번호(5자리)를 모두 사용했습니다. 관리자에게 문의하세요.' using errcode = 'P0001';
    end if;
    new.shipper_code := 'S' || lpad(v_no::text, 5, '0');
  elsif new.shipper_code is distinct from old.shipper_code then
    raise exception '화주코드는 변경할 수 없습니다.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_shipper_code before insert or update of shipper_code on public.shippers
  for each row execute function public.fn_shipper_code();
