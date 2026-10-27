-- =============================================================
-- 02. 기준정보: 회사, 화주사, 센터, 공통코드, 품목, 차량, 사용자
-- =============================================================

-- 공통코드 (2단계: 유형코드 → 공통코드)
create table public.code_groups (
  group_code  varchar(30)  primary key check (group_code ~ '^[A-Z][A-Z0-9_]*$'),
  group_name  varchar(100) not null,
  description text,
  sort_order  integer      not null default 0,
  is_system   boolean      not null default false,
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  created_by  uuid,
  updated_at  timestamptz  not null default now(),
  updated_by  uuid
);

create table public.codes (
  group_code  varchar(30)  not null references public.code_groups (group_code) on update cascade,
  code        varchar(30)  not null,
  code_name   varchar(100) not null,
  sort_order  integer      not null default 0,
  attr1       varchar(100),
  attr2       varchar(100),
  attr3       varchar(100),
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  created_by  uuid,
  updated_at  timestamptz  not null default now(),
  updated_by  uuid,
  primary key (group_code, code)
);

-- 시스템 유형코드는 삭제 불가
create or replace function public.fn_protect_system_group()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception '시스템 유형코드(%)는 삭제할 수 없습니다.', old.group_code using errcode = 'P0001';
  end if;
  return old;
end;
$$;
create trigger trg_protect_system before delete on public.code_groups
  for each row execute function public.fn_protect_system_group();

-- 회사정보 (3PL, 1행)
create table public.company (
  id           smallint     primary key default 1 check (id = 1),
  company_name varchar(100) not null,
  biz_no       varchar(12),
  ceo_name     varchar(50),
  address      text,
  tel          varchar(20),
  email        varchar(100),
  created_at   timestamptz  not null default now(),
  created_by   uuid,
  updated_at   timestamptz  not null default now(),
  updated_by   uuid
);

-- 화주사
create table public.shippers (
  id            uuid         primary key default gen_random_uuid(),
  shipper_code  varchar(20)  not null unique check (shipper_code ~ '^[A-Z0-9_-]+$'),
  shipper_name  varchar(100) not null,
  biz_no        varchar(12),
  address       text,
  manager_name  varchar(50),
  manager_tel   varchar(20),
  manager_email varchar(100),
  remark        text,
  is_active     boolean      not null default true,
  created_at    timestamptz  not null default now(),
  created_by    uuid,
  updated_at    timestamptz  not null default now(),
  updated_by    uuid
);

-- 센터 (기본 센터 1개)
create table public.centers (
  id          uuid         primary key default gen_random_uuid(),
  center_code varchar(20)  not null unique,
  center_name varchar(100) not null,
  address     text,
  tel         varchar(20),
  is_default  boolean      not null default false,
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  created_by  uuid,
  updated_at  timestamptz  not null default now(),
  updated_by  uuid
);
create unique index centers_one_default_uk on public.centers (is_default) where is_default;

-- 품목: 내부코드(3PL, 전역 유일, 자동채번) / 화주 품목코드(화주 내 유일)
create sequence public.item_code_seq;

create table public.items (
  id                uuid         primary key default gen_random_uuid(),
  shipper_id        uuid         not null references public.shippers (id),
  internal_code     varchar(20)  not null unique
                    default 'IT' || lpad(nextval('public.item_code_seq')::text, 7, '0'),
  shipper_item_code varchar(50)  not null,
  item_name         varchar(200) not null,
  spec              varchar(200),
  barcode           varchar(50),
  uom_code          varchar(30)  not null default 'EA',
  box_qty           integer      check (box_qty > 0),
  lot_yn            boolean      not null default false,
  expiry_yn         boolean      not null default false,
  remark            text,
  is_active         boolean      not null default true,
  created_at        timestamptz  not null default now(),
  created_by        uuid,
  updated_at        timestamptz  not null default now(),
  updated_by        uuid,
  constraint items_shipper_item_code_uk unique (shipper_id, shipper_item_code),
  constraint items_shipper_barcode_uk unique (shipper_id, barcode)
);
create index items_shipper_idx on public.items (shipper_id);

create trigger trg_codes before insert or update on public.items
  for each row execute function public.fn_validate_codes('uom_code', 'UOM');

-- 품목의 화주사·내부코드는 등록 후 변경 불가
create or replace function public.fn_items_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.shipper_id is distinct from old.shipper_id or new.internal_code is distinct from old.internal_code then
    raise exception '품목의 화주사와 내부코드는 변경할 수 없습니다.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_items_immutable before update on public.items
  for each row execute function public.fn_items_immutable();

-- 차량
create table public.vehicles (
  id                uuid         primary key default gen_random_uuid(),
  shipper_id        uuid         not null references public.shippers (id),
  vehicle_no        varchar(20)  not null unique,
  vehicle_type_code varchar(30),
  tonnage           numeric(5,1) check (tonnage > 0),
  driver_name       varchar(50),
  driver_tel        varchar(20),
  remark            text,
  is_active         boolean      not null default true,
  created_at        timestamptz  not null default now(),
  created_by        uuid,
  updated_at        timestamptz  not null default now(),
  updated_by        uuid
);
create index vehicles_shipper_idx on public.vehicles (shipper_id);

-- 차량번호는 공백 제거 후 저장
create or replace function public.fn_normalize_vehicle_no()
returns trigger
language plpgsql
as $$
begin
  new.vehicle_no := regexp_replace(new.vehicle_no, '\s', '', 'g');
  return new;
end;
$$;
create trigger trg_normalize before insert or update on public.vehicles
  for each row execute function public.fn_normalize_vehicle_no();
create trigger trg_codes before insert or update on public.vehicles
  for each row execute function public.fn_validate_codes('vehicle_type_code', 'VEHICLE_TYPE');

-- 사용자 (auth.users 1:1, 로그인 계정)
create table public.profiles (
  id         uuid         primary key references auth.users (id) on delete cascade,
  login_id   varchar(100) not null unique,
  user_name  varchar(50)  not null,
  user_type  varchar(10)  not null check (user_type in ('INTERNAL', 'SHIPPER')),
  role       varchar(20)  not null,
  shipper_id uuid         references public.shippers (id),
  tel        varchar(20),
  is_active  boolean      not null default true,
  created_at timestamptz  not null default now(),
  created_by uuid,
  updated_at timestamptz  not null default now(),
  updated_by uuid,
  constraint profiles_type_role_ck check (
    (user_type = 'INTERNAL' and role in ('ADMIN', 'OPERATOR', 'WORKER') and shipper_id is null)
    or
    (user_type = 'SHIPPER' and role = 'SHIPPER_USER' and shipper_id is not null)
  )
);
create index profiles_shipper_idx on public.profiles (shipper_id);

create or replace function public.fn_profiles_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.login_id is distinct from old.login_id then
    raise exception '로그인 ID는 변경할 수 없습니다.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_profiles_immutable before update on public.profiles
  for each row execute function public.fn_profiles_immutable();

-- 감사 컬럼 + 이력
select public.fn_enable_audit(t), public.fn_enable_history(t)
from unnest(array[
  'code_groups', 'codes', 'company', 'shippers', 'centers', 'items', 'vehicles', 'profiles'
]) as t;
