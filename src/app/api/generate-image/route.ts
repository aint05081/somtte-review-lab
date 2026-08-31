import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import { detailReferences } from "@/lib/details";
import { getProduct } from "@/lib/products";
import { sampleReviewPhotoReferences } from "@/lib/reviews";

export const runtime = "nodejs";
export const maxDuration = 120;

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

function makePrompt(productName: string, productId: string, review: string, photoNotes: string[]) {
  const notes = photoNotes.length ? photoNotes.map((x, i) => `${i + 1}) ${x}`).join("\n") : "No usable photo-review reference was available; use an ordinary Korean mobile-commerce review-photo aesthetic.";
  return `Create a NEW photorealistic Korean e-commerce customer review photo for the product "${productName}".

The input images include two kinds of references:
- official detail-page images: use ONLY to preserve the product/package identity, shape, colors, label placement and recognizable packaging details.
- real customer review photos: use ONLY to infer the ordinary shooting style, framing, home environment, lighting, distance, casual imperfection and what customers tend to show.

IMPORTANT PRIVACY / ORIGINALITY RULES:
- Do not copy any real customer's exact photo, room, body, child, face, hand pose, clothing, or unique arrangement.
- Create a completely new composition.
- If a reference contains a person or child, do not reproduce that identity. Prefer hands only, cropped body, or no person.
- This must look like a genuine smartphone snapshot, NOT a polished ad campaign or studio packshot.

Generated review text to visually match:
${review || "A satisfied everyday-use review."}

Scene direction:
${sceneHint(productId, review)}

Reference-review context associated with sampled photos:
${notes}

Visual rules:
casual smartphone photo, Korean home setting, slightly imperfect framing, mild perspective distortion, realistic household clutter in moderation, believable shadows, natural daylight or ordinary ceiling light, true-to-life exposure, product clearly recognizable, no promotional typography added, no price badges, no review UI, no watermark, no floating graphics, no fake star rating, no impossible extra product parts. Keep any printed package text as close to the reference product as the model can preserve without inventing new slogans.

The final output should be a single square review photograph.`;
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

    const prompt = makePrompt(product.name, productId, review, photoRefs.map((x) => x.content).filter(Boolean));
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const common = {
      model,
      prompt,
      size: "1024x1024",
      quality,
      output_format: "jpeg",
      output_compression: quality === "high" ? 92 : quality === "medium" ? 86 : 78,
    } as any;

    const result = images.length ? await openai.images.edit({ ...common, image: images }) : await openai.images.generate(common);
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("이미지 생성 결과가 비어 있습니다.");
    return new Response(Buffer.from(b64, "base64"), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Review-Photo-Refs": String(photoRefs.length),
        "X-Detail-Refs": String(detailRefs.length),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "이미지 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
