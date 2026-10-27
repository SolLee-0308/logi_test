// Supabase/Postgres 오류를 사용자에게 보여줄 한국어 메시지로 변환한다.

const CONSTRAINT_MESSAGES: Record<string, string> = {
  shippers_shipper_code_key: '이미 사용 중인 화주코드입니다.',
  shippers_shipper_code_check: '화주코드는 영문 대문자, 숫자, -, _ 만 사용할 수 있습니다.',
  centers_center_code_key: '이미 사용 중인 센터코드입니다.',
  centers_one_default_uk: '기본 센터는 1개만 지정할 수 있습니다.',
  items_internal_code_key: '이미 사용 중인 내부코드입니다.',
  items_shipper_item_code_uk: '같은 화주사에 이미 등록된 화주 품목코드입니다.',
  items_shipper_barcode_uk: '같은 화주사에 이미 등록된 바코드입니다.',
  vehicles_vehicle_no_key: '이미 등록된 차량번호입니다.',
  code_groups_pkey: '이미 존재하는 유형코드입니다.',
  code_groups_group_code_check:
    '유형코드는 영문 대문자로 시작하고 영문 대문자, 숫자, _ 만 사용할 수 있습니다.',
  codes_pkey: '같은 유형에 이미 존재하는 코드입니다.',
  profiles_login_id_key: '이미 사용 중인 로그인 ID입니다.',
  profiles_type_role_ck: '사용자 구분과 권한, 소속 화주사 조합이 올바르지 않습니다.',
}

type PgError = { code?: string; message?: string; error?: string }

export function toErrorMessage(error: unknown): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.'
  const e = error as PgError
  const message = e.message ?? e.error ?? String(error)

  const constraint = Object.keys(CONSTRAINT_MESSAGES).find((k) => message.includes(k))
  if (constraint) return CONSTRAINT_MESSAGES[constraint]

  switch (e.code) {
    case '23503':
      return '다른 데이터에서 사용 중이라 처리할 수 없습니다. 삭제 대신 미사용으로 변경하세요.'
    case '42501':
      return '권한이 없습니다.'
    case 'P0001':
      return message // DB 트리거의 업무 규칙 메시지(한국어)
  }
  if (message.includes('row-level security')) return '권한이 없습니다.'
  if (message.includes('Invalid login credentials'))
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (message.includes('Failed to fetch'))
    return '서버에 연결할 수 없습니다. 네트워크를 확인하세요.'
  return message
}
