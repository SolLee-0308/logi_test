-- =============================================================
-- 05. 초기 데이터: 회사(1행), 기본 센터, 공통코드
-- =============================================================

insert into public.company (id, company_name) values (1, '회사명을 입력하세요')
on conflict (id) do nothing;

insert into public.centers (center_code, center_name, is_default) values ('C001', '기본센터', true)
on conflict (center_code) do nothing;

insert into public.code_groups (group_code, group_name, description, sort_order, is_system) values
  ('UOM',            '단위',       '품목 단위',                 10, true),
  ('VEHICLE_TYPE',   '차종',       '차량 종류',                 20, true),
  ('INSPECT_RESULT', '검수결과',   '입고 검수 결과 구분',       30, true),
  ('RETURN_REASON',  '반송사유',   '검수 반송 사유',            40, true),
  ('USER_ROLE',      '사용자권한', '사용자 권한 (표시명 관리용)', 50, true)
on conflict (group_code) do nothing;

insert into public.codes (group_code, code, code_name, sort_order, attr1) values
  ('UOM', 'EA',  '낱개',     10, null),
  ('UOM', 'BOX', '박스',     20, null),
  ('UOM', 'PLT', '팔레트',   30, null),
  ('UOM', 'KG',  '킬로그램', 40, null),
  ('UOM', 'SET', '세트',     50, null),
  ('VEHICLE_TYPE', 'CARGO',  '카고',         10, null),
  ('VEHICLE_TYPE', 'WING',   '윙바디',       20, null),
  ('VEHICLE_TYPE', 'TOP',    '탑차',         30, null),
  ('VEHICLE_TYPE', 'REFRIG', '냉장·냉동탑',  40, null),
  ('VEHICLE_TYPE', 'DAMAS',  '다마스·라보',  50, null),
  ('INSPECT_RESULT', 'NORMAL',       '정상',             10, null),
  ('INSPECT_RESULT', 'QTY_MISMATCH', '수량불일치',       20, null),
  ('INSPECT_RESULT', 'DAMAGED',      '파손·오염 반송',   30, 'RETURN'),
  ('INSPECT_RESULT', 'WRONG_ITEM',   '품목불일치 반송',  40, 'RETURN'),
  ('RETURN_REASON', 'DAMAGE',        '파손',        10, null),
  ('RETURN_REASON', 'CONTAMINATION', '오염',        20, null),
  ('RETURN_REASON', 'WRONG_ITEM',    '품목 불일치', 30, null),
  ('RETURN_REASON', 'ETC',           '기타',        40, null),
  ('USER_ROLE', 'ADMIN',        '관리자',     10, 'INTERNAL'),
  ('USER_ROLE', 'OPERATOR',     '운영자',     20, 'INTERNAL'),
  ('USER_ROLE', 'WORKER',       '작업자',     30, 'INTERNAL'),
  ('USER_ROLE', 'SHIPPER_USER', '화주사용자', 40, 'SHIPPER')
on conflict (group_code, code) do nothing;
