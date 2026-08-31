import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import { detailReferences } from "@/lib/details";
import { getProduct } from "@/lib/products";
import { olivePhotoPatternProfile, sampleOlivePhotoContexts, sampleReviewPhotoReferences } from "@/lib/reviews";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Quality = "low" | "medium" | "high";
type Body = { product?: string; review?: string; quality?: Quality };

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("상세페이지 이미지 형식을 읽지 못했습니다.");
  return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
}

async function fetchImage(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`reference fetch failed: ${res.status}`);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const bytes = Buffer.from(await res.arrayBuffer());
    return { bytes, mime: contentType.split(";")[0] || "image/jpeg" };
  } finally {
    clearTimeout(timer);
  }
}

function sceneHint(productId: string, review: string) {
  if (productId === "betterday-growday") {
    if (/우유|바나나|갈아|미숫가루|아침|한끼|한 끼/.test(review)) return "A casual breakfast scene: the product beside a glass or shaker containing a light beige grain drink, ordinary kitchen or dining table.";
    if (/박스|쟁여|재구매|여러/.test(review)) return "Several boxes casually stacked or lined up at home, like a real repeat-purchase proof photo.";
    return "A casual home-use product photo, optionally with a cup or shaker nearby.";
  }
  if (productId === "betterday-calmadi") {
    if (/알|츄어블|초코|먹/.test(review)) return "Show the container and a few chocolate-colored chewable pieces naturally on a clean palm or small dish; hands only, no identifiable child face.";
    if (/박스|쟁여|재구매|여러/.test(review)) return "Show multiple boxes or containers casually arranged after delivery.";
    return "A casual home snapshot of the supplement container and package on a dining table.";
  }
  if (productId.includes("kidsday")) {
    if (/스티커/.test(review)) return "Show the product container with playful stickers attached, on a family dining table; hands only if a child is implied.";
    if (/사과|포도/.test(review)) return "Show the apple/grape variants naturally together if appropriate, with a few chewables visible.";
    return "A casual family-home supplement snapshot, product container open or held in one hand.";
  }
  if (productId.includes("candide")) return "A believable bathroom-sink or vanity snapshot with the toothpaste tube near a toothbrush or cup, natural household lighting, not an advertisement.";
  if (productId.includes("somtte")) return "A believable skincare vanity or bathroom snapshot with the jar and cotton-ball pads visible, natural use traces and soft household lighting.";
  return "A believable casual home-use product review photo.";
}

function pickOliveVisualArchetype(productId: string, review: string) {
  if (/재구매|쟁여|몇\s*통|박스|리필|여러\s*개/.test(review)) {
    return "REPURCHASE PROOF: show 2–4 units, boxes, refills or an opened package casually grouped together. Slightly uneven spacing; believable delivery/unboxing feel.";
  }
  if (/먹|섭취|츄어블|양치|닦|붙이|팩토|닦토|사용|바르|꺼내/.test(review)) {
    return "IN-USE HAND SHOT: one hand naturally interacting with the product or its contents. Crop the hand casually; avoid a perfectly posed commercial hand-model composition.";
  }
  if (/제형|에센스|앰플|촉촉|패드|알약|츄어블|치약|내용물/.test(review)) {
    return "PRODUCT + CONTENT DETAIL: package remains recognizable while 1–3 pieces / pad / texture / dispensed product are visible in the foreground. Use a close smartphone distance and shallow natural depth.";
  }
  if (/모공|피지|각질|피부결|화장|메이크업|치아|착색|입냄새/.test(review)) {
    return "RESULT-CONTEXT DETAIL: show a believable close detail related to the routine, but do not fabricate a clinical before/after comparison. If a person is implied, use an anonymous crop and keep the product visible in-frame.";
  }
  const options = [
    "PRODUCT PROOF SNAPSHOT: one main product, 3/4 or slightly top-down smartphone angle, product around the center third rather than perfectly centered, ordinary surface and modest negative space.",
    "ROUTINE CONTEXT: product placed where it would actually be used—vanity, sink, dining table, kitchen counter or bedside area—with only a few ordinary contextual objects.",
    "PRODUCT + CONTENT DETAIL: package plus a small amount of its contents/texture, close enough to feel informative but still casual and non-commercial.",
    "IN-USE HAND SHOT: hand entering from an edge while holding/opening/using the product, with imperfect but readable framing.",
  ];
  const salt = [...(productId + review)].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return options[salt % options.length];
}

function makePrompt(
  productName: string,
  productId: string,
  review: string,
  productPhotoNotes: string[],
  oliveContexts: { content: string; photoCount: number; reviewType?: string }[],
  oliveProfile: ReturnType<typeof olivePhotoPatternProfile>,
) {
  const productNotes = productPhotoNotes.length
    ? productPhotoNotes.map((x, i) => `${i + 1}) ${x}`).join("\n")
    : "No usable first-party customer photo reference was available; rely on the official product identity plus the Olive Young visual-pattern profile.";
  const oliveNotes = oliveContexts.length
    ? oliveContexts.map((x, i) => `${i + 1}) attached ${x.photoCount} photo(s) / ${x.reviewType || "review"}: ${x.content}`).join("\n")
    : "No matching Olive Young photo-review text sample selected.";
  const cueText = oliveProfile.cueRates
    .slice(0, 7)
    .map((x) => `${x.label}: ${(x.rate * 100).toFixed(1)}% of Olive Young photo reviews mention this context`)
    .join("\n");
  const dist = oliveProfile.photoCountDistribution;

  return `Create ONE NEW photorealistic Korean mobile-commerce customer review photo for the product "${productName}".

SOURCE ROLES — DO NOT MIX THEM UP:
1) OFFICIAL DETAIL-PAGE IMAGES = PRODUCT TRUTH.
   Use them to preserve the actual package identity, shape, color, cap/lid, label placement, materials and recognizable product details.
2) THIS BRAND'S REAL CUSTOMER REVIEW PHOTOS/TEXT = PRODUCT-SPECIFIC REAL-LIFE CONTEXT.
   Use them to understand how this exact product is actually handled, opened, consumed/used, and what customers tend to show.
3) OLIVE YOUNG 4,290-REVIEW PHOTO PATTERN ANALYSIS = PHOTO TYPE / FRAMING / ARRANGEMENT GRAMMAR ONLY.
   Use Olive Young to decide what kind of review photo feels normal, how many things belong in-frame, framing distance, hand usage, casual composition and level of imperfection. Do NOT borrow another brand's package, claims or product-specific usage from Olive Young.

OLIVE YOUNG PHOTO-REVIEW PROFILE (analyzed across the existing dataset, not a single sample):
- total analyzed reviews: ${oliveProfile.totalReviews}
- reviews with photos: ${oliveProfile.photoReviews} (${(oliveProfile.photoRate * 100).toFixed(1)}%)
- total attached review photos represented in metadata: ${oliveProfile.attachedPhotos}
- attachment-count pattern among photo reviews: 1 photo ${dist["1"] || 0}, 2 photos ${dist["2"] || 0}, 3 photos ${dist["3"] || 0}, 4+ photos ${dist["4+"] || 0}
- common context signals found in photo-review text:
${cueText}

For this ONE generated frame, use this Olive-style visual archetype:
${pickOliveVisualArchetype(productId, review)}

Generated review text to visually match:
${review || "A satisfied everyday-use review."}

Product-specific scene direction:
${sceneHint(productId, review)}

First-party customer review context associated with sampled real product photos:
${productNotes}

Matching Olive Young PHOTO-review contexts (TEXT + attachment count only; do not copy any exact photo):
${oliveNotes}

COMPOSITION RULES DERIVED FROM THE PHOTO-REVIEW DATA:
- Treat this as one frame from an ordinary review-photo set, not a hero ad.
- Product must be visible and recognizable, but it does not need to sit perfectly centered.
- Prefer believable 3/4, slightly top-down, hand-held, close-detail or routine-context framing over symmetrical studio packshots.
- If showing product contents, keep the amount believable: usually a few pieces / one pad / one squeezed amount, not decorative abundance.
- If review implies repeat purchase, multiple packs are allowed; otherwise do not multiply products without reason.
- Ordinary supporting objects are allowed only when they explain the routine. Do not decorate the frame like an advertising set.
- Mild tilt, imperfect crop, uneven spacing, household lighting and small background clutter are positive realism signals.
- Keep the key product and useful detail readable even when the framing is casual.

IMPORTANT PRIVACY / ORIGINALITY RULES:
- Do not copy any real customer's exact photo, room, body, child, face, hand pose, clothing, or unique arrangement.
- Create a completely new composition.
- If references contain people or children, do not reproduce their identity. Prefer hands only, anonymous crops, or no person.
- Do not fabricate a medical/clinical before-and-after photo or objective proof that is not in the official detail-page facts.
- This must look like a genuine smartphone snapshot, NOT a polished ad campaign or studio packshot.

FINAL VISUAL RULES:
casual smartphone photo, Korean everyday setting, slightly imperfect framing, mild perspective distortion, realistic household clutter in moderation, believable shadows, natural daylight or ordinary ceiling light, true-to-life exposure, no promotional typography added, no price badges, no review UI, no watermark, no floating graphics, no fake star rating, no impossible extra product parts. Keep printed package text as close to the official reference product as possible without inventing slogans.

The final output must be a single square customer-review photograph.`;
}
export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    const body = (await req.json()) as Body;
    const productId = String(body.product || "").trim();
    const review = String(body.review || "").trim().slice(0, 2500);
    const quality: Quality = ["low", "medium", "high"].includes(String(body.quality)) ? (body.quality as Quality) : "high";
    if (!productId) return NextResponse.json({ error: "제품을 선택해주세요." }, { status: 400 });

    const product = getProduct(productId);
    const photoRefs = sampleReviewPhotoReferences(productId, review, 2);
    const detailRefs = detailReferences(product, 2);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const images: any[] = [];

    for (let i = 0; i < detailRefs.length; i++) {
      const parsed = dataUrlToBuffer(detailRefs[i].dataUrl);
      images.push(await toFile(parsed.bytes, `official-${i + 1}.jpg`, { type: parsed.mime }));
    }
    for (let i = 0; i < photoRefs.length; i++) {
      try {
        const remote = await fetchImage(photoRefs[i].url);
        images.push(await toFile(remote.bytes, `review-style-${i + 1}.jpg`, { type: remote.mime }));
      } catch (error) {
        console.warn("review image reference skipped", photoRefs[i].url, error);
      }
    }

    const oliveProfile = olivePhotoPatternProfile();
    const oliveContexts = sampleOlivePhotoContexts(review, 5);
    const prompt = makePrompt(
      product.name,
      productId,
      review,
      photoRefs.map((x) => x.content).filter(Boolean),
      oliveContexts,
      oliveProfile,
    );
    const model = (process.env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim();
    const common = {
      model,
      prompt,
      size: "1024x1024",
      quality,
      output_format: "jpeg",
      output_compression: quality === "high" ? 88 : quality === "medium" ? 84 : 76,
    } as any;

    const startedAt = Date.now();
    const result = images.length
      ? await openai.images.edit({ ...common, image: images })
      : await openai.images.generate(common);
    const elapsedMs = Date.now() - startedAt;
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("이미지 생성 결과가 비어 있습니다.");
    return new Response(Buffer.from(b64, "base64"), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Review-Photo-Refs": String(photoRefs.length),
        "X-Olive-Photo-Profile-Reviews": String(oliveProfile.totalReviews),
        "X-Olive-Photo-Contexts": String(oliveContexts.length),
        "X-Detail-Refs": String(detailRefs.length),
        "X-Image-Quality": quality,
        "X-Image-Model": model,
        "X-Generation-Ms": String(elapsedMs),
      },
    });
  } catch (e: any) {
    console.error("generate-image error", e);

    const status = Number(e?.status || e?.response?.status || 500);
    const code = String(e?.code || e?.error?.code || "").trim();
    const rawMessage = String(e?.message || e?.error?.message || "이미지 생성 중 오류가 발생했습니다.");
    const model = (process.env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim();

    let friendly = rawMessage;
    if (status === 401) friendly = "OpenAI API 키 인증에 실패했습니다. Vercel의 OPENAI_API_KEY를 확인해주세요.";
    else if (status === 403) friendly = `현재 OpenAI 프로젝트에서 ${model} 모델을 사용할 권한이 없습니다.`;
    else if (status === 429) friendly = "OpenAI 이미지 API 사용 한도 또는 크레딧을 확인해주세요.";
    else if (status === 408 || /timeout|timed out|deadline|aborted/i.test(rawMessage)) friendly = "고화질 이미지 생성 시간이 서버 제한을 넘었습니다. 잠시 후 다시 시도하거나 중화질로 생성해주세요.";
    else if (status >= 500 && status < 600) friendly = `OpenAI 이미지 서버에서 일시적인 오류가 발생했습니다. (${status}) 잠시 후 다시 시도해주세요.`;
    else if (/model/i.test(rawMessage) && /not|access|exist|invalid|unsupported/i.test(rawMessage)) friendly = `이미지 모델 설정을 확인해주세요. 현재 설정: ${model}`;
    else if (/billing|credit|quota/i.test(rawMessage)) friendly = "OpenAI API 결제/크레딧 또는 사용 한도를 확인해주세요.";

    return NextResponse.json(
      {
        error: friendly,
        detail: rawMessage,
        code: code || undefined,
        status,
        model,
      },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
