# SOMTTE Review Lab v5

올리브영 실제 리뷰 데이터는 문체용, 제품별 공홈 리뷰 JSON은 제품 소구용으로 분리해 사용하는 내부 리뷰 샘플 도구입니다.

## 새 제품 추가 방법

1. 제품 리뷰 JSON을 `data/products/` 폴더에 넣습니다.
2. `data/products.json`에 제품 정보를 한 항목 추가합니다.
3. 저장 후 재배포하면 제품 선택 목록에 자동으로 나타납니다. 소스코드 수정은 필요 없습니다.

예시:

```json
{
  "id": "new-product",
  "name": "전체 제품명",
  "label": "화면에 표시할 짧은 이름",
  "file": "new-product.json",
  "summary": "제품 선택 버튼 아래 짧은 설명"
}
```

`profile`은 선택사항입니다. 제품의 주요 소구를 이미 알고 있으면 적어둘 수 있습니다. 생략하면 실제 제품 리뷰 표본과 반복 키워드만으로 소구를 파악합니다.

### 지원 리뷰 JSON 형식

가장 권장하는 형식:

```json
[
  { "content": "리뷰 본문", "ratings": 5 },
  { "content": "리뷰 본문", "ratings": 4 }
]
```

또한 최상위가 `{ "reviews": [...] }`, `{ "data": [...] }`, `{ "items": [...] }`, `{ "results": [...] }` 형태인 JSON도 읽습니다. 핵심 필드는 `content`입니다.

## 실행

```bash
npm install
npm run dev
```

`.env.local`:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4
```

## 배포

Vercel에 배포할 경우 `OPENAI_API_KEY`, `OPENAI_MODEL`을 Vercel Environment Variables에 등록합니다.
