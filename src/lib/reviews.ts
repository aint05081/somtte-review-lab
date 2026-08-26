import fs from "node:fs";
import path from "node:path";

type OliveReview = {
  content?: string;
  reviewScore?: number;
  isRepurchase?: boolean;
  reviewType?: string;
};

type SomtteReview = {
  content?: string;
  ratings?: number;
};

type CacheData = {
  olive: OliveReview[];
  centella: SomtteReview[];
  solanum: SomtteReview[];
};

let cache: CacheData | null = null;

/**
 * JSON 로드
 */
function loadJson<T>(file: string): T {
  const fullPath = path.join(process.cwd(), "data", file);
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

/**
 * 공백/줄바꿈 정규화
 *
 * 올리브영 4,380개 분석 때 사용한
 * "사실상 완전히 동일한 본문" 중복 제거 기준과 비슷하게 사용
 */
function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 본문이 완전히 동일한 리뷰 중복 제거
 */
function dedupeOliveReviews(rows: OliveReview[]) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const content = row.content?.trim();

    if (!content) return false;

    const key = normalizeText(content);

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/**
 * 솜떼 리뷰도 동일 본문이 있을 경우 보수적으로 제거
 */
function dedupeSomtteReviews(rows: SomtteReview[]) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const content = row.content?.trim();

    if (!content) return false;

    const key = normalizeText(content);

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/**
 * 데이터 최초 1회 로드 후 캐시
 */
function data(): CacheData {
  if (cache) return cache;

  const medih = loadJson<{ reviews: OliveReview[] }>(
    "oliveyoung_mediheal.json"
  );

  const dermatory = loadJson<{ reviews: OliveReview[] }>(
    "oliveyoung_dermatory.json"
  );

  const oliveRaw = [
    ...medih.reviews,
    ...dermatory.reviews,
  ].filter((r) => r.content);

  const centellaRaw = loadJson<SomtteReview[]>(
    "somtte_centella.json"
  );

  const solanumRaw = loadJson<SomtteReview[]>(
    "somtte_solanum_allclear.json"
  );

  cache = {
    olive: dedupeOliveReviews(oliveRaw),
    centella: dedupeSomtteReviews(centellaRaw),
    solanum: dedupeSomtteReviews(solanumRaw),
  };

  return cache;
}

/**
 * 배열 섞기
 */
function shuffle<T>(rows: T[]) {
  const a = [...rows];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

/**
 * 이미 선택된 리뷰가 다시 들어가는 것을 방지
 */
function uniquePush(
  target: OliveReview[],
  candidates: OliveReview[],
  count: number
) {
  const existing = new Set(
    target
      .map((r) => normalizeText(r.content || ""))
      .filter(Boolean)
  );

  for (const row of shuffle(candidates)) {
    const text = normalizeText(row.content || "");

    if (!text) continue;
    if (existing.has(text)) continue;

    target.push(row);
    existing.add(text);

    if (count <= 1) break;

    count -= 1;
  }
}

/**
 * 리뷰 특징 판별
 */

function textOf(row: OliveReview) {
  return row.content || "";
}

function isShort(row: OliveReview) {
  return normalizeText(textOf(row)).length <= 60;
}

function isMedium(row: OliveReview) {
  const n = normalizeText(textOf(row)).length;
  return n >= 61 && n <= 150;
}

function isLong(row: OliveReview) {
  return normalizeText(textOf(row)).length >= 151;
}

/**
 * ㅋㅋ / ㅎㅎ / ㅠㅠ / 구어체 / 인터넷 표현
 */
function isCasual(row: OliveReview) {
  const t = textOf(row);

  return /ㅋㅋ|ㅎㅎ|ㅠㅠ|ㅜㅜ|걍|개좋|미쳤|아묻따|굳굳|요물|최애템|쌉가능|댕좋|ㄹㅈㄷ|좋음|잘먹음|쓰는중|같아여|좋아용|더라구요/.test(
    t
  );
}

/**
 * 이모지 / 기호형 이모티콘
 */
function hasEmoji(row: OliveReview) {
  const t = textOf(row);

  return /[❤️🩷💙🖤🤍💜💚🧡💕💞💓💗💖✨⭐👍✔️🥹😭😍😳🫶🏻🙈🥲]/u.test(
    t
  );
}

/**
 * 생활 속 구체적 사용 장면
 */
function isLifestyle(row: OliveReview) {
  const t = textOf(row);

  return /아침|저녁|밤에|세안 후|세안하고|화장 전|화장하기 전|메이크업 전|머리 말|드라이|샤워|냉장고|여행|휴대|출근|잠들기|자기 전에/.test(
    t
  );
}

/**
 * 닦토 / 팩토 / 붙여두기 등 토너패드 사용 방식
 */
function isUsageSpecific(row: OliveReview) {
  const t = textOf(row);

  return /닦토|팩토|부분팩|스킨팩|붙여|올려두|닦아내|쓱쓱|슥슥|톡톡/.test(
    t
  );
}

/**
 * 피부 타입/고민 먼저 나오는 스타일
 */
function isSkinConcern(row: OliveReview) {
  const t = textOf(row);

  return /수부지|건성|지성|민감성|민감|왕지성|속건조|트러블|모공|피지|각질|블랙헤드|화이트헤드|여드름/.test(
    t
  );
}

/**
 * 장점 + 아쉬움 혼합
 */
function hasProsAndCons(row: OliveReview) {
  const t = textOf(row);

  return /근데|다만|아쉽|아쉬운|단점|그런데|조금 아쉬|좋긴 한데|좋은데|괜찮은데|만족하지만/.test(
    t
  );
}

/**
 * 재구매 / 정착
 */
function isRepurchaseStyle(row: OliveReview) {
  const t = textOf(row);

  return Boolean(
    row.isRepurchase ||
      /재구매|또 샀|또샀|몇 통|몇통|정착|다쓰면 또|다 쓰면 또|계속 사|아묻따 재구매|쟁여|쟁임/.test(
        t
      )
  );
}

/**
 * 정돈된 리뷰어/체험형
 *
 * 너무 정확할 필요는 없음.
 * "길고, 캐주얼 표현이 적고, 구조화된 표현이 있는 글" 정도만 분리.
 */
function isPolished(row: OliveReview) {
  const t = textOf(row);
  const n = normalizeText(t).length;

  const hasStructuredWords =
    /사용감|장점|단점|총평|추천 대상|사용 방법|구성|특징|마무리감/.test(
      t
    );

  return (
    n >= 180 &&
    !isCasual(row) &&
    (hasStructuredWords || /습니다|했습니다|느껴졌습니다/.test(t))
  );
}

/**
 * 일반 담백형
 *
 * 특별히 캐주얼하거나 구조적인 특징이 강하지 않은
 * 평범한 실제 후기
 */
function isPlain(row: OliveReview) {
  return (
    !isCasual(row) &&
    !hasEmoji(row) &&
    !isPolished(row)
  );
}

/**
 * 올리브영 문체 샘플 선정
 *
 * 중요한 점:
 * 단순 랜덤 12개가 아니라 문체 그룹을 일부러 섞는다.
 *
 * 결과 예:
 * - 초단문
 * - 일반 담백형
 * - 생활밀착형
 * - 피부 고민형
 * - 캐주얼형
 * - 이모지형
 * - 장단점형
 * - 재구매형
 * - 상세형
 * - 정돈형
 *
 * 샘플 자체가 지나치게 정돈된 문체로 쏠리는 것을 방지한다.
 */
function sampleOliveReferences(rows: OliveReview[]) {
  const selected: OliveReview[] = [];

  /**
   * 1. 짧은 실제 후기
   */
  uniquePush(
    selected,
    rows.filter(isShort),
    2
  );

  /**
   * 2. 일반적이고 담백한 중간 길이 후기
   */
  uniquePush(
    selected,
    rows.filter(
      (r) => isMedium(r) && isPlain(r)
    ),
    2
  );

  /**
   * 3. 생활밀착 사용형
   */
  uniquePush(
    selected,
    rows.filter(
      (r) => isLifestyle(r) || isUsageSpecific(r)
    ),
    2
  );

  /**
   * 4. 피부 고민 선제시형
   */
  uniquePush(
    selected,
    rows.filter(isSkinConcern),
    1
  );

  /**
   * 5. 친근한 구어체 / 커뮤니티형
   */
  uniquePush(
    selected,
    rows.filter(isCasual),
    1
  );

  /**
   * 6. 이모지형
   */
  uniquePush(
    selected,
    rows.filter(hasEmoji),
    1
  );

  /**
   * 7. 장점 + 아쉬움
   */
  uniquePush(
    selected,
    rows.filter(hasProsAndCons),
    1
  );

  /**
   * 8. 재구매 / 정착
   */
  uniquePush(
    selected,
    rows.filter(isRepurchaseStyle),
    1
  );

  /**
   * 9. 긴 경험 상세형
   */
  uniquePush(
    selected,
    rows.filter(
      (r) =>
        isLong(r) &&
        !isPolished(r)
    ),
    1
  );

  /**
   * 10. 정돈된 리뷰어형은
   * 실제 데이터에 존재하므로 완전히 제거하지 않고 1개 정도만.
   */
  uniquePush(
    selected,
    rows.filter(isPolished),
    1
  );

  /**
   * 조건에 해당하는 리뷰가 부족해서
   * 13개 미만이면 전체 풀에서 랜덤 보충
   */
  if (selected.length < 13) {
    uniquePush(
      selected,
      rows,
      13 - selected.length
    );
  }

  /**
   * 순서까지 고정되면 모델이 패턴으로 볼 수 있으므로 섞는다.
   */
  return shuffle(selected)
    .slice(0, 13)
    .map((r) => r.content || "");
}

/**
 * 솜떼 제품 샘플은 "문체"보다 "소구" 확인용.
 *
 * 너무 긴 리뷰만 뽑히거나 같은 소구만 반복되는 것을
 * 조금 줄이기 위해 길이 정도만 섞는다.
 */
function sampleProductReferences(
  rows: SomtteReview[]
) {
  const short = rows.filter(
    (r) =>
      normalizeText(r.content || "").length <= 100
  );

  const medium = rows.filter((r) => {
    const n = normalizeText(r.content || "").length;
    return n >= 101 && n <= 250;
  });

  const long = rows.filter(
    (r) =>
      normalizeText(r.content || "").length >= 251
  );

  const selected: SomtteReview[] = [];

  function add(
    candidates: SomtteReview[],
    amount: number
  ) {
    const existing = new Set(
      selected.map((r) =>
        normalizeText(r.content || "")
      )
    );

    for (const row of shuffle(candidates)) {
      const key = normalizeText(row.content || "");

      if (!key || existing.has(key)) continue;

      selected.push(row);
      existing.add(key);

      amount -= 1;

      if (amount <= 0) break;
    }
  }

  add(short, 3);
  add(medium, 4);
  add(long, 3);

  if (selected.length < 10) {
    add(rows, 10 - selected.length);
  }

  return shuffle(selected)
    .slice(0, 10)
    .map((r) => r.content || "");
}

/**
 * route.ts에서 호출
 */
export function sampleReferences(
  product: "centella" | "solanum"
) {
  const d = data();

  const olive = sampleOliveReferences(
    d.olive
  );

  const productRows =
    product === "centella"
      ? d.centella
      : d.solanum;

  const productExamples =
    sampleProductReferences(productRows);

  return {
    olive,
    productExamples,
  };
}