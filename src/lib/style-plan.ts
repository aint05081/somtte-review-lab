export type ReviewLength = "short" | "medium" | "long";

export type ReviewStyle =
  | "초단문·툭 던지는 형"
  | "생활밀착 사용형"
  | "친근한 구어체·커뮤니티형"
  | "피부 고민 선제시형"
  | "경험 상세 설명형"
  | "장점+아쉬움 혼합형"
  | "재구매·정착템형"
  | "정돈된 리뷰어·체험후기형";

export type PolishLevel =
  | "clean"
  | "natural"
  | "loose";

export type PunctuationStyle =
  | "clean"
  | "mixed"
  | "loose";

export type CasualLevel =
  | "none"
  | "light"
  | "medium"
  | "strong";

export type EmojiMode =
  | "none"
  | "light";

export type ReviewPlanItem = {
  index: number;
  length: ReviewLength;
  style: ReviewStyle;
  polish: PolishLevel;
  punctuation: PunctuationStyle;
  casual: CasualLevel;
  emoji: EmojiMode;
  allowLaugh: boolean;
  allowCry: boolean;
};

const styles: ReviewStyle[] = [
  "초단문·툭 던지는 형",
  "생활밀착 사용형",
  "친근한 구어체·커뮤니티형",
  "피부 고민 선제시형",
  "경험 상세 설명형",
  "장점+아쉬움 혼합형",
  "재구매·정착템형",
  "정돈된 리뷰어·체험후기형",
];

function shuffle<T>(a: T[]) {
  const out = [...a];

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

function randomBool(probability: number) {
  return Math.random() < probability;
}

function weightedPick<T>(
  items: Array<{ value: T; weight: number }>
): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }

  return items[items.length - 1].value;
}

/**
 * 스타일별 기본 문체 성향
 *
 * 완전히 고정하지 않고 "기본값"만 정한다.
 * 이후 전체 분포 보정 단계에서 일부 값이 변경될 수 있다.
 */
function styleDefaults(style: ReviewStyle) {
  switch (style) {
    case "초단문·툭 던지는 형":
      return {
        polish: weightedPick<PolishLevel>([
          { value: "natural", weight: 45 },
          { value: "loose", weight: 45 },
          { value: "clean", weight: 10 },
        ]),
        punctuation: weightedPick<PunctuationStyle>([
          { value: "loose", weight: 50 },
          { value: "mixed", weight: 40 },
          { value: "clean", weight: 10 },
        ]),
        casual: weightedPick<CasualLevel>([
          { value: "light", weight: 35 },
          { value: "medium", weight: 40 },
          { value: "strong", weight: 15 },
          { value: "none", weight: 10 },
        ]),
      };

    case "생활밀착 사용형":
      return {
        polish: weightedPick<PolishLevel>([
          { value: "natural", weight: 60 },
          { value: "loose", weight: 25 },
          { value: "clean", weight: 15 },
        ]),
        punctuation: weightedPick<PunctuationStyle>([
          { value: "mixed", weight: 55 },
          { value: "loose", weight: 30 },
          { value: "clean", weight: 15 },
        ]),
        casual: weightedPick<CasualLevel>([
          { value: "light", weight: 50 },
          { value: "medium", weight: 25 },
          { value: "none", weight: 20 },
          { value: "strong", weight: 5 },
        ]),
      };

    case "친근한 구어체·커뮤니티형":
      return {
        polish: weightedPick<PolishLevel>([
          { value: "loose", weight: 65 },
          { value: "natural", weight: 30 },
          { value: "clean", weight: 5 },
        ]),
        punctuation: weightedPick<PunctuationStyle>([
          { value: "loose", weight: 60 },
          { value: "mixed", weight: 35 },
          { value: "clean", weight: 5 },
        ]),
        casual: weightedPick<CasualLevel>([
          { value: "strong", weight: 45 },
          { value: "medium", weight: 40 },
          { value: "light", weight: 15 },
          { value: "none", weight: 0 },
        ]),
      };

    case "피부 고민 선제시형":
      return {
        polish: weightedPick<PolishLevel>([
          { value: "natural", weight: 60 },
          { value: "clean", weight: 20 },
          { value: "loose", weight: 20 },
        ]),
        punctuation: weightedPick<PunctuationStyle>([
          { value: "mixed", weight: 60 },
          { value: "clean", weight: 20 },
          { value: "loose", weight: 20 },
        ]),
        casual: weightedPick<CasualLevel>([
          { value: "light", weight: 45 },
          { value: "medium", weight: 25 },
          { value: "none", weight: 25 },
          { value: "strong", weight: 5 },
        ]),
      };

    case "경험 상세 설명형":
      return {
        polish: weightedPick<PolishLevel>([
          { value: "natural", weight: 50 },
          { value: "clean", weight: 35 },
          { value: "loose", weight: 15 },
        ]),
        punctuation: weightedPick<PunctuationStyle>([
          { value: "mixed", weight: 55 },
          { value: "clean", weight: 35 },
          { value: "loose", weight: 10 },
        ]),
        casual: weightedPick<CasualLevel>([
          { value: "light", weight: 45 },
          { value: "none", weight: 35 },
          { value: "medium", weight: 18 },
          { value: "strong", weight: 2 },
        ]),
      };

    case "장점+아쉬움 혼합형":
      return {
        polish: weightedPick<PolishLevel>([
          { value: "natural", weight: 55 },
          { value: "clean", weight: 25 },
          { value: "loose", weight: 20 },
        ]),
        punctuation: weightedPick<PunctuationStyle>([
          { value: "mixed", weight: 60 },
          { value: "clean", weight: 20 },
          { value: "loose", weight: 20 },
        ]),
        casual: weightedPick<CasualLevel>([
          { value: "light", weight: 45 },
          { value: "medium", weight: 25 },
          { value: "none", weight: 25 },
          { value: "strong", weight: 5 },
        ]),
      };

    case "재구매·정착템형":
      return {
        polish: weightedPick<PolishLevel>([
          { value: "natural", weight: 45 },
          { value: "loose", weight: 40 },
          { value: "clean", weight: 15 },
        ]),
        punctuation: weightedPick<PunctuationStyle>([
          { value: "mixed", weight: 45 },
          { value: "loose", weight: 40 },
          { value: "clean", weight: 15 },
        ]),
        casual: weightedPick<CasualLevel>([
          { value: "medium", weight: 40 },
          { value: "light", weight: 30 },
          { value: "strong", weight: 20 },
          { value: "none", weight: 10 },
        ]),
      };

    case "정돈된 리뷰어·체험후기형":
      return {
        polish: weightedPick<PolishLevel>([
          { value: "clean", weight: 75 },
          { value: "natural", weight: 25 },
          { value: "loose", weight: 0 },
        ]),
        punctuation: weightedPick<PunctuationStyle>([
          { value: "clean", weight: 70 },
          { value: "mixed", weight: 30 },
          { value: "loose", weight: 0 },
        ]),
        casual: weightedPick<CasualLevel>([
          { value: "none", weight: 65 },
          { value: "light", weight: 35 },
          { value: "medium", weight: 0 },
          { value: "strong", weight: 0 },
        ]),
      };
  }
}

/**
 * 여러 리뷰 생성 시 이모지 비율을
 * "랜덤 확률"이 아니라 실제 개수로 먼저 정한다.
 *
 * 예:
 * 10개 → 약 2~3개
 * 20개 → 약 4~6개
 *
 * 사용자가 체감하기에는 기존 11.9%보다 조금 높은
 * 20~30% 정도를 유지한다.
 */
function buildEmojiFlags(count: number) {
  if (count <= 1) {
    return [randomBool(0.24)];
  }

  const ratio = 0.2 + Math.random() * 0.1;
  const emojiCount = Math.max(
    1,
    Math.min(count, Math.round(count * ratio))
  );

  const flags = [
    ...Array(emojiCount).fill(true),
    ...Array(count - emojiCount).fill(false),
  ];

  return shuffle(flags);
}

/**
 * ㅎㅎ/ㅋㅋ/ㅠㅠ는 전부 독립적으로 확률을 적용하되
 * 너무 과해지지 않게 한다.
 */
function expressionFlags(style: ReviewStyle) {
  let laughProbability = 0.08;
  let cryProbability = 0.06;

  if (style === "친근한 구어체·커뮤니티형") {
    laughProbability = 0.3;
    cryProbability = 0.16;
  }

  if (style === "재구매·정착템형") {
    laughProbability = 0.18;
    cryProbability = 0.08;
  }

  if (style === "생활밀착 사용형") {
    laughProbability = 0.12;
    cryProbability = 0.07;
  }

  if (style === "피부 고민 선제시형") {
    laughProbability = 0.06;
    cryProbability = 0.18;
  }

  if (style === "정돈된 리뷰어·체험후기형") {
    laughProbability = 0.02;
    cryProbability = 0.01;
  }

  return {
    allowLaugh: randomBool(laughProbability),
    allowCry: randomBool(cryProbability),
  };
}

export function buildStylePlan(
  count: number,
  requested: "auto" | "short" | "medium" | "long"
): ReviewPlanItem[] {
  const lengths: ReviewLength[] = [];

  if (
    requested === "short" ||
    requested === "medium" ||
    requested === "long"
  ) {
    for (let i = 0; i < count; i++) {
      lengths.push(requested);
    }
  } else {
    /**
     * 올리브영 4,290개 분석 기준
     *
     * short  35.0%
     * medium 34.5%
     * long   30.5%
     */
    let shortN = Math.round(count * 0.35);
    let mediumN = Math.round(count * 0.345);
    let longN = count - shortN - mediumN;

    if (longN < 0) {
      mediumN += longN;
      longN = 0;
    }

    lengths.push(
      ...Array(shortN).fill("short"),
      ...Array(mediumN).fill("medium"),
      ...Array(longN).fill("long")
    );
  }

  /**
   * 스타일은 단순 완전 균등 반복이 아니라
   * 기본 8종을 섞되 정돈형이 과하게 반복되지 않도록 한다.
   */
  const stylePool: ReviewStyle[] = [];

  const weightedStyles: ReviewStyle[] = [
    "초단문·툭 던지는 형",
    "생활밀착 사용형",
    "생활밀착 사용형",
    "친근한 구어체·커뮤니티형",
    "피부 고민 선제시형",
    "피부 고민 선제시형",
    "경험 상세 설명형",
    "경험 상세 설명형",
    "장점+아쉬움 혼합형",
    "재구매·정착템형",
    "정돈된 리뷰어·체험후기형",
  ];

  while (stylePool.length < count) {
    stylePool.push(...shuffle(weightedStyles));
  }

  const chosenStyles = stylePool.slice(0, count);
  const mixedLengths = shuffle(lengths);
  const emojiFlags = buildEmojiFlags(count);

  return Array.from({ length: count }, (_, i) => {
    const style = chosenStyles[i];
    const defaults = styleDefaults(style);
    const expressions = expressionFlags(style);

    /**
     * emoji가 true여도 모델에게 "반드시 넣어라"라고
     * 과도하게 강요하지 않고 1~2개 허용하는 방향.
     */
    const emoji: EmojiMode = emojiFlags[i] ? "light" : "none";

    return {
      index: i + 1,
      length: mixedLengths[i],
      style,
      polish: defaults.polish,
      punctuation: defaults.punctuation,
      casual: defaults.casual,
      emoji,
      allowLaugh: expressions.allowLaugh,
      allowCry: expressions.allowCry,
    };
  });
}

export function stylePlanText(
  plan: ReturnType<typeof buildStylePlan>
) {
  const lengthText = {
    short: "짧은형(대체로 60자 이하)",
    medium: "중간형(대체로 61~150자)",
    long: "상세형(대체로 151자 이상)",
  } as const;

  const polishText = {
    clean: "정돈도 높음",
    natural: "정돈도 보통",
    loose: "정돈도 느슨함",
  } as const;

  const punctuationText = {
    clean: "구두점 비교적 정확",
    mixed: "구두점 혼합",
    loose: "구두점 느슨/마침표 생략 가능",
  } as const;

  const casualText = {
    none: "구어체 거의 없음",
    light: "가벼운 구어체",
    medium: "구어체 중간",
    strong: "인터넷 구어체 강함",
  } as const;

  return plan
    .map((x) => {
      const expressions: string[] = [];

      if (x.emoji === "light") {
        expressions.push("이모지 1~2개 허용");
      } else {
        expressions.push("이모지 없음");
      }

      if (x.allowLaugh) {
        expressions.push("ㅎㅎ/ㅋㅋ 자연스럽게 허용");
      }

      if (x.allowCry) {
        expressions.push("ㅠㅠ/ㅜㅜ 자연스럽게 허용");
      }

      return [
        `${x.index}.`,
        lengthText[x.length],
        `/ ${x.style}`,
        `/ ${polishText[x.polish]}`,
        `/ ${punctuationText[x.punctuation]}`,
        `/ ${casualText[x.casual]}`,
        `/ ${expressions.join(", ")}`,
      ].join(" ");
    })
    .join("\n");
}