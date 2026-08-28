import OpenAI from "openai";
import { NextResponse } from "next/server";
import { sampleReferences } from "@/lib/reviews";
import { GENERATION_RULES, STYLE_PROFILE } from "@/lib/prompt";
import { buildStylePlan, stylePlanText } from "@/lib/style-plan";

export const runtime = "nodejs";

type Body = {
  product?: string;
  experience?: string;
  length?: "auto" | "short" | "medium" | "long";
  count?: number;
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 확인해주세요." }, { status: 500 });
    }

    const body = (await req.json()) as Body;
    const productId = String(body.product || "").trim();
    const experience = String(body.experience || "").trim().slice(0, 5000);
    const count = Math.min(Math.max(Number(body.count || 1), 1), 20);
    const length = body.length || "auto";
    const refs = sampleReferences(productId);
    const stylePlan = buildStylePlan(count, length);

    const lengthRule = length === "short"
      ? "짧은 후기 중심. 대체로 60자 이하, 한두 포인트만 툭 말하고 끝나도 된다."
      : length === "medium"
      ? "중간 길이 후기 중심. 대체로 61~150자, 문장 수와 줄바꿈은 리뷰마다 다르게 한다."
      : length === "long"
      ? "상세 후기 중심. 대체로 151자 이상이지만 길이와 구조를 획일화하지 않는다."
      : "실제 올리브영 분포처럼 짧음/중간/상세 후기를 섞는다.";

    const productProfile = refs.product.profile
      ? `[제품 등록 프로필 — 보조 참고]\n${refs.product.profile}`
      : `[제품 등록 프로필 없음]\n아래 실제 제품 리뷰 표본과 반복 키워드만 보고 이 제품의 소구를 파악한다.`;

    const modeRule = experience
      ? `[입력 기반 모드]\n사용자 입력:\n${experience}\n\n입력 내용이 가장 중요한 사실 기준이다. 입력에 없는 효과·기간·피부 타입·재구매 경험을 새로 만들지 않는다.`
      : `[자동 생성 모드]\n사용자 경험 입력이 없다. 아래 해당 제품 실제 리뷰에서 반복 확인되는 소구 범위 안에서만 일반적인 가상 사용 상황을 구성한다. 한 리뷰에 모든 장점을 넣지 말고 보통 1~2개의 포인트만 사용한다.`;

    const input = `
[작업 대상]
제품: ${refs.product.name}
제품 ID: ${refs.product.id}
실제 제품 리뷰 수: ${refs.productReviewCount}개
요청 리뷰 수: ${count}개
길이: ${lengthRule}

${modeRule}

${STYLE_PROFILE}

[이번 요청의 리뷰별 스타일 설계표 — 번호와 1:1로 준수]
${stylePlanText(stylePlan)}

스타일 설계표는 단순 참고가 아니라 각 리뷰의 작성자 성향이다. 이모지 없음이면 넣지 않고, 이모지 1~2개 허용이면 자연스럽게 실제 사용한다. 정돈도 느슨함이면 모든 문장을 표준 맞춤법과 마침표로 정리하지 않는다. 인터넷 구어체 강함이면 문맥에 맞는 범위에서 진짜/걍/좋음/쓰는중/ㅋㅋ 등을 사용할 수 있다.

${productProfile}

[해당 제품 실제 리뷰에서 자주 나타난 단어 — 소구 탐색 보조]
${refs.productKeywords.join(", ") || "키워드 없음"}

[실제 올리브영 리뷰 — 오직 문체 관찰용]
${refs.olive.map((x, i) => `${i + 1}. ${x}`).join("\n")}

[해당 제품 실제 리뷰 — 제품 소구/사용 맥락 확인용]
${refs.productExamples.map((x, i) => `${i + 1}. ${x}`).join("\n")}

[최종 지시]
- 위 제품 실제 리뷰에서 확인되지 않는 핵심 효능을 새로 만들지 않는다.
- 제품 리뷰의 독특한 개인 에피소드를 복제하지 않는다.
- 같은 시작문장과 같은 결론을 반복하지 않는다.
- 모든 리뷰가 추천/재구매로 끝나지 않게 한다.
- 입력 기반 모드라면 사용자 입력의 사실을 유지한다.
- 자동 모드라면 제품 데이터 안에서만 가상 상황을 다양하게 구성한다.
- 분석/출처/소제목 없이 1부터 ${count}까지 리뷰만 출력한다.
`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      instructions: GENERATION_RULES,
      input,
      max_output_tokens: count <= 3 ? 1800 : count <= 10 ? 5000 : 9000,
    });

    const text = response.output_text?.trim();
    if (!text) throw new Error("모델 응답이 비어 있습니다.");
    return NextResponse.json({ text, mode: experience ? "guided" : "auto", product: refs.product.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
