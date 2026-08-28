import OpenAI from "openai";
import { NextResponse } from "next/server";
import { sampleReferences } from "@/lib/reviews";
import { detailReferences, detailPageCount } from "@/lib/details";
import { GENERATION_RULES, STYLE_PROFILE } from "@/lib/prompt";
import { buildStylePlan, stylePlanText } from "@/lib/style-plan";

export const runtime = "nodejs";

 type Body = {
  product?: string;
  experience?: string;
  length?: "auto" | "short" | "medium" | "long";
  count?: number;
  ageGroup?: "auto" | "teens" | "20s" | "30s" | "40s" | "50plus";
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
    const ageGroup = body.ageGroup || "auto";
    const stylePlan = buildStylePlan(count, length);

    const refs = sampleReferences(productId);
    if (!refs.productReviewCount) {
      throw new Error(`${refs.product.label} 제품의 리뷰 JSON이 비어 있습니다.`);
    }

    const productName = refs.product.name;
    const reviewCount = refs.productReviewCount;
    const detailCount = detailPageCount(refs.product);
    const detailImages = detailReferences(refs.product, 6);

    const lengthRule = length === "short"
      ? "짧은 후기 중심. 대체로 60자 이하, 한두 포인트만 툭 말하고 끝나도 된다."
      : length === "medium"
      ? "중간 길이 후기 중심. 대체로 61~150자, 문장 수와 줄바꿈은 리뷰마다 다르게 한다."
      : length === "long"
      ? "상세 후기 중심. 대체로 151자 이상이지만 길이와 구조를 획일화하지 않는다."
      : "실제 올리브영 분포처럼 짧음/중간/상세 후기를 섞는다.";

    const modeRule = experience
      ? `[입력 기반 모드]\n사용자 입력:\n${experience}\n\n입력 내용이 가장 중요한 경험 기준이다. 입력에 없는 효과·기간·피부 타입·재구매 경험을 새로 만들지 않는다.`
      : `[자동 생성 모드]\n사용자 경험 입력이 없다. 공식 상세페이지에서 확인되는 제품 FACT/공식 소구를 기준으로 잡고, 해당 제품 실제 리뷰에서 반복되는 개인 경험·구매 계기·생활 맥락을 참고해 자연스러운 가상 소비자 후기를 구성한다. 개인 경험은 리뷰마다 넣어도 되고 생략해도 되며 모든 리뷰에 강제로 넣지 않는다. 한 리뷰에 모든 장점을 넣지 말고 보통 1~2개의 포인트만 사용한다.`;

    const ageRule = ageGroup === "teens"
      ? "10대 작성자 말투를 목표로 한다. 비교적 짧고 즉각적인 반응, 편한 구어체와 이모지를 자연스럽게 활용하되 과장된 신조어 도배는 피한다."
      : ageGroup === "20s"
      ? "20대 작성자 말투를 목표로 한다. 편한 존댓말과 구어체를 자연스럽게 섞고, 감정 표현·이모지·짧은 생활 디테일을 비교적 적극적으로 활용한다."
      : ageGroup === "30s"
      ? "30대 작성자 말투를 목표로 한다. 실제 사용 상황과 실용적인 판단을 중심으로 편한 존댓말을 쓰며, 이모지와 ㅎㅎ/ㅠㅠ도 자연스럽게 섞을 수 있다."
      : ageGroup === "40s"
      ? "40대 작성자 말투를 목표로 한다. 사용 이유와 실제 체감을 비교적 또렷하게 설명하되 지나치게 정돈된 광고체는 피한다. 이모지·ㅎㅎ·~·^^ 등은 일부 리뷰에 자연스럽게 쓸 수 있다."
      : ageGroup === "50plus"
      ? "50대 이상 작성자 말투를 목표로 한다. 명확하고 생활적인 표현을 중심으로 쓰되 지나치게 딱딱하지 않게 한다. 강한 신조어는 줄이고 ~, ^^, 느낌표나 간단한 이모지를 일부 사용할 수 있다."
      : "연령대 자동 모드다. 특정 세대의 말투로 통일하지 말고 결과마다 자연스럽게 다른 작성자 느낌을 주되 연령을 본문에 직접 밝히지는 않는다.";

    const inputText = `
[작업 대상]
제품: ${productName}
실제 제품 리뷰 수: ${reviewCount}개
공식 상세페이지 참고 이미지: ${detailImages.length}장 / 전체 ${detailCount}장
요청 리뷰 수: ${count}개
길이: ${lengthRule}
작성자 연령대 설정: ${ageGroup}

${modeRule}

[연령대 말투 지침]
${ageRule}
- 연령대는 말투와 표현 리듬을 위한 설정일 뿐이다. 본문에 실제 나이를 임의로 밝히지 않는다.
- 연령대만 보고 결혼, 육아, 직업, 성별 같은 개인 정보를 자동으로 만들어내지 않는다.

${STYLE_PROFILE}

[이번 요청의 리뷰별 스타일 설계표 — 번호와 1:1로 준수]
${stylePlanText(stylePlan)}

[소스 역할 분리 — 중요]
1) 공식 상세페이지 이미지 = 제품의 성분, 사용법/섭취법, 제형, 맛, 공식 기능성/특징, 주의사항 등 FACT 확인용.
2) 해당 제품 실제 공홈 리뷰 = 개인 사용 경험, 구매 계기, 생활 맥락, 만족/아쉬움, 제품을 받아들이는 방식 파악용. 공식 소구를 정하는 근거로 사용하지 않는다.
3) 올리브영 리뷰 = 문체와 길이 분포, 구어체/이모지/맞춤법 흔들림 등 스타일 관찰용.
4) 공홈 리뷰의 개인적인 효과 체감은 개인 경험 참고자료로만 취급한다. 자동 생성에서는 이런 개인 경험을 일부 리뷰에 자연스럽게 넣거나 생략할 수 있다. 단, 특정 성장 수치·치료·통증 개선·전문가 보증처럼 객관적 효능으로 오해될 수 있는 내용은 새로 만들어내지 않는다.
5) 공식 상세페이지에서 확인되지 않는 성분·함량·기능성·사용법을 임의로 추가하지 않는다.
6) 선택한 연령대는 말투·구어체 강도·이모지와 문장 리듬에만 반영한다. 연령 자체나 연령에 따른 가족관계/직업을 사실처럼 만들지 않는다.

[해당 제품 실제 리뷰에서 자주 나타난 단어 — 개인 경험/생활 맥락 탐색 보조]
${refs.productKeywords.join(", ") || "키워드 없음"}

[실제 올리브영 리뷰 — 오직 문체 관찰용]
${refs.olive.map((x, i) => `${i + 1}. ${x}`).join("\n")}

[해당 제품 실제 리뷰 — 개인 경험/구매 계기/생활 맥락 확인용]
${refs.productExamples.map((x, i) => `${i + 1}. ${x}`).join("\n")}

[최종 지시]
- 뒤에 첨부된 이미지들은 이 제품의 공식 상세페이지 일부를 전체 구간에 걸쳐 균등 추출한 참고 이미지다. 제품 사실은 이미지 내용을 우선한다.
- 제품의 핵심 소구와 FACT는 공식 상세페이지에서만 잡는다. 상세페이지 문장을 광고 카피처럼 그대로 복사하지 말고 소비자가 실제로 쓸 법한 표현으로 자연스럽게 녹인다.
- 자동 생성 모드에서는 실제 공홈 리뷰에서 반복되는 범위의 개인 경험을 가상 소비자 경험으로 일부 리뷰에 넣어도 되고, 넣지 않아도 된다. 리뷰마다 경험 유무와 강도를 다르게 한다.
- 리뷰 데이터의 독특한 개인 에피소드는 복제하지 않는다.
- 같은 시작문장과 같은 결론을 반복하지 않는다.
- 모든 리뷰가 추천/재구매로 끝나지 않게 한다.
- 입력 기반 모드라면 사용자 입력의 사실을 유지한다.
- 분석/출처/소제목 없이 1부터 ${count}까지 리뷰만 출력한다.
`;

    const content: any[] = [{ type: "input_text", text: inputText }];
    for (const image of detailImages) {
      content.push({ type: "input_image", image_url: image.dataUrl, detail: "high" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      instructions: GENERATION_RULES,
      input: [{ role: "user", content }] as any,
      max_output_tokens: count <= 3 ? 1800 : count <= 10 ? 5000 : 9000,
    });

    const text = response.output_text?.trim();
    if (!text) throw new Error("모델 응답이 비어 있습니다.");
    return NextResponse.json({
      text,
      mode: experience ? "guided" : "auto",
      product: productId || "custom",
      detailPagesUsed: detailImages.length,
      detailPagesTotal: detailCount,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
