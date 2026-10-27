// 숫자만 입력받아 하이픈 형식으로 바꾸는 입력 포맷 함수들 (입력 중에도 자연스럽게 동작)

const digits = (value: string) => value.replace(/\D/g, '')

// 숫자를 정해진 길이 묶음으로 나눠 하이픈으로 잇는다. 예) group('1234567890', [3, 2, 5]) → 123-45-67890
function group(value: string, sizes: number[]) {
  const parts: string[] = []
  let rest = value
  for (const size of sizes) {
    if (!rest) break
    parts.push(rest.slice(0, size))
    rest = rest.slice(size)
  }
  return parts.join('-')
}

// 사업자등록번호: 000-00-00000
export function formatBizNo(value: string) {
  return group(digits(value).slice(0, 10), [3, 2, 5])
}

// 법인등록번호: 000000-0000000
export function formatCorpNo(value: string) {
  return group(digits(value).slice(0, 13), [6, 7])
}

// 전화·팩스번호: 서울(02), 지역·휴대폰(0XX), 대표번호(15XX 등), 050X 안심번호
export function formatPhone(value: string) {
  const d = digits(value).slice(0, 12)
  if (d.startsWith('02')) {
    // 02-123-4567 / 02-1234-5678
    return group(d.slice(0, 10), d.length <= 9 ? [2, 3, 4] : [2, 4, 4])
  }
  if (/^1[5-9]/.test(d)) {
    // 1588-1234
    return group(d.slice(0, 8), [4, 4])
  }
  if (d.startsWith('050')) {
    // 0505-123-4567 / 0505-1234-5678
    return group(d, d.length <= 11 ? [4, 3, 4] : [4, 4, 4])
  }
  // 031-123-4567 / 010-1234-5678
  return group(d.slice(0, 11), d.length <= 10 ? [3, 3, 4] : [3, 4, 4])
}

// 전화번호 형식 검사용 (포맷 결과와 짝)
export const PHONE_REGEX = /^(\d{2,4}-\d{3,4}-\d{4}|1\d{3}-\d{4})$/
