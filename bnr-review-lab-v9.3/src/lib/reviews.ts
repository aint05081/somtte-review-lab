import fs from "node:fs";
import path from "node:path";
import { getProduct, getProducts, productDataPath, type ProductConfig } from "@/lib/products";
import { detailPageCount } from "@/lib/details";

type OliveReview = { content?: string; reviewScore?: number; isRepurchase?: boolean; reviewType?: string };
type ProductReview = { content?: string; ratings?: number; rating?: number; reviewScore?: number };

type Loaded = {
  olive: OliveReview[];
  products: Map<string, ProductReview[]>;
};

let cache: Loaded | null = null;

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

// 쇼핑몰/네이버페이에서 자동으로 붙는 문구는 제품 소구가 아니므로
// 키워드 분석과 제품 리뷰 표본을 만들 때 제거한다.
function cleanProductReviewText(text: string) {
  return normalizeText(text)
    .replace(/\(?\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*에\s*등록된\s*네이버\s*페이\s*구매평\s*\)?/g, " ")
    .replace(/네이버\s*페이\s*구매평/g, " ")
    .replace(/등록된\s*구매평/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLowSignalProductReview(text: string) {
  const t = cleanProductReviewText(text);
  if (!t) return true;
  // 리뷰 위젯이 자동 생성한 반복 문구는 소구 분석에서 제외한다.
  if (/^(만족해요[.! ]*)?꽤 좋은 선택이었던 것 같아요[.! ]*[\p{Extended_Pictographic}\s]*감사합니다!?$/u.test(t)) return true;
  if (/^만족할 만큼 좋은 상품이에요[.! ]*[\p{Extended_Pictographic}\s]*감사합니다[.!]?$/u.test(t)) return true;
  if (/^잘 산 것 같아 기분이 좋아요[.! ]*[\p{Extended_Pictographic}\s]*$/u.test(t)) return true;
  if (/^무난한 상품이에요[.! ]*[\p{Extended_Pictographic}\s]*감사합니다[.!]?$/u.test(t)) return true;
  if (/^나쁘지 않은 선택이었던 것 같아요[.! ]*[\p{Extended_Pictographic}\s]*$/u.test(t)) return true;
  return false;
}

function dedupe<T extends { content?: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = normalizeText(row.content || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unwrapProductJson(raw: unknown): ProductReview[] {
  if (Array.isArray(raw)) return raw as ProductReview[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["reviews", "data", "items", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as ProductReview[];
    }
  }
  throw new Error("제품 리뷰 JSON 형식을 읽을 수 없습니다. 배열 또는 reviews/data/items/results 배열이 필요합니다.");
}

function data(): Loaded {
  if (cache) return cache;
  const m = loadJson<{ reviews: OliveReview[] }>(path.join(process.cwd(), "data", "oliveyoung_mediheal.json"));
  const d = loadJson<{ reviews: OliveReview[] }>(path.join(process.cwd(), "data", "oliveyoung_dermatory.json"));
  const products = new Map<string, ProductReview[]>();
  for (const product of getProducts()) {
    try {
      const raw = loadJson<unknown>(productDataPath(product));
      products.set(product.id, dedupe(unwrapProductJson(raw).filter((r) => r.content)));
    } catch {
      products.set(product.id, []);
    }
  }
  cache = {
    olive: dedupe([...m.reviews, ...d.reviews].filter((r) => r.content)),
    products,
  };
  return cache;
}

function shuffle<T>(rows: T[]) {
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniquePush(target: OliveReview[], candidates: OliveReview[], count: number) {
  const existing = new Set(target.map((r) => normalizeText(r.content || "")).filter(Boolean));
  for (const row of shuffle(candidates)) {
    const text = normalizeText(row.content || "");
    if (!text || existing.has(text)) continue;
    target.push(row);
    existing.add(text);
    count -= 1;
    if (count <= 0) break;
  }
}

const textOf = (row: OliveReview) => row.content || "";
const isShort = (row: OliveReview) => normalizeText(textOf(row)).length <= 60;
const isMedium = (row: OliveReview) => { const n = normalizeText(textOf(row)).length; return n >= 61 && n <= 150; };
const isLong = (row: OliveReview) => normalizeText(textOf(row)).length >= 151;
const isCasual = (row: OliveReview) => /ㅋㅋ|ㅎㅎ|ㅠㅠ|ㅜㅜ|걍|개좋|미쳤|아묻따|굳굳|요물|최애템|쌉가능|댕좋|ㄹㅈㄷ|좋음|잘먹음|쓰는중|같아여|좋아용|더라구요/.test(textOf(row));
const hasEmoji = (row: OliveReview) => /[❤️🩷💙🖤🤍💜💚🧡💕💞💓💗💖✨⭐👍✔️🥹😭😍😳🥲]/u.test(textOf(row));
const isLifestyle = (row: OliveReview) => /아침|저녁|밤에|세안 후|세안하고|화장 전|화장하기 전|메이크업 전|머리 말|드라이|샤워|냉장고|여행|휴대|출근|잠들기|자기 전에/.test(textOf(row));
const isUsageSpecific = (row: OliveReview) => /닦토|팩토|부분팩|스킨팩|붙여|올려두|닦아내|쓱쓱|슥슥|톡톡/.test(textOf(row));
const isSkinConcern = (row: OliveReview) => /수부지|건성|지성|민감성|민감|왕지성|속건조|트러블|모공|피지|각질|블랙헤드|화이트헤드|여드름/.test(textOf(row));
const hasProsAndCons = (row: OliveReview) => /근데|다만|아쉽|아쉬운|단점|그런데|조금 아쉬|좋긴 한데|좋은데|괜찮은데|만족하지만/.test(textOf(row));
const isRepurchaseStyle = (row: OliveReview) => Boolean(row.isRepurchase || /재구매|또 샀|또샀|몇 통|몇통|정착|다쓰면 또|다 쓰면 또|계속 사|아묻따 재구매|쟁여|쟁임/.test(textOf(row)));
const isPolished = (row: OliveReview) => {
  const t = textOf(row); const n = normalizeText(t).length;
  return n >= 180 && !isCasual(row) && (/사용감|장점|단점|총평|추천 대상|사용 방법|구성|특징|마무리감/.test(t) || /습니다|했습니다|느껴졌습니다/.test(t));
};
const isPlain = (row: OliveReview) => !isCasual(row) && !hasEmoji(row) && !isPolished(row);

function sampleOliveReferences(rows: OliveReview[]) {
  const selected: OliveReview[] = [];
  uniquePush(selected, rows.filter(isShort), 2);
  uniquePush(selected, rows.filter((r) => isMedium(r) && isPlain(r)), 2);
  uniquePush(selected, rows.filter((r) => isLifestyle(r) || isUsageSpecific(r)), 2);
  uniquePush(selected, rows.filter(isSkinConcern), 1);
  uniquePush(selected, rows.filter(isCasual), 1);
  uniquePush(selected, rows.filter(hasEmoji), 1);
  uniquePush(selected, rows.filter(hasProsAndCons), 1);
  uniquePush(selected, rows.filter(isRepurchaseStyle), 1);
  uniquePush(selected, rows.filter((r) => isLong(r) && !isPolished(r)), 1);
  uniquePush(selected, rows.filter(isPolished), 1);
  if (selected.length < 13) uniquePush(selected, rows, 13 - selected.length);
  return shuffle(selected).slice(0, 13).map((r) => r.content || "");
}

function productKeywords(rows: ProductReview[]) {
  const stop = new Set([
    "그리고","근데","진짜","너무","사용","제품","상품","피부","패드","이거","저는","해서","있어요","좋아요","같아요","정말","그냥","조금","쓰고","하는","하고","되게","완전",
    "감사합니다","만족해요","만족합니다","구매","구매평","네이버","페이","등록된","배송","빠르고","좋은","좋네요","좋습니다","같습니다","같네요","선택","선택이었던","상품이에요",
    "아이","아이가","아이들","먹고","먹는","먹여","먹이고","먹어요","잘먹어요","잘먹고","잘먹네요","꾸준히","계속","이번","항상","정착","재구매"
  ]);
  const freq = new Map<string, number>();
  const usable = rows.filter((r) => !isLowSignalProductReview(r.content || ""));
  for (const row of usable) {
    const clean = cleanProductReviewText(row.content || "");
    const tokens = clean.match(/[가-힣A-Za-z]{2,}/g) || [];
    for (const raw of new Set(tokens.map((x) => x.toLowerCase()))) {
      const token = raw.replace(/^(등록된|네이버|페이)$/g, "");
      if (!token || stop.has(token)) continue;
      if (/^\d+$/.test(token)) continue;
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 24)
    .map(([x]) => x);
}

type Theme = { label: string; re: RegExp };
const PRODUCT_THEMES: Theme[] = [
  { label: "맛·섭취 편의", re: /맛|맛있|잘\s*먹|거부감|츄어블|씹어|사탕|초코|사과맛|포도맛|먹기\s*편/ },
  { label: "성장기·키 고민", re: /키가|키\s*성장|성장기|성장통|쑥쑥|크길|컸|자라/ },
  { label: "영양성분·균형", re: /영양|성분|비타민|칼슘|마그네슘|아연|미네랄|무기질|종합비타민|멀티비타민/ },
  { label: "꾸준한 섭취·재구매", re: /재구매|몇\s*통|몇년|몇\s*년|꾸준히|계속\s*구매|쟁여|정착/ },
  { label: "입냄새·상쾌함", re: /입냄새|구취|상쾌|개운|텁텁|입안|숨결|프레시/ },
  { label: "미백·착색 케어", re: /미백|하얘|하얗|착색|누런|누렁|커피|치아\s*색|화이트닝/ },
  { label: "양치 사용감", re: /양치|치약|거품|맵지|잇몸|치아|칫솔/ },
  { label: "촉촉함·수분감", re: /촉촉|수분|에센스|앰플|건조|당김|물광/ },
  { label: "진정·저자극", re: /진정|자극|예민|민감|붉|편안|부드럽|보들|코튼볼|목화/ },
  { label: "피부결·각질 정돈", re: /피부결|각질|매끈|화장\s*뜸|화장잘|메이크업|들뜸/ },
  { label: "피지·모공 케어", re: /피지|유분|모공|블랙헤드|화이트헤드|콧볼/ },
  { label: "간편한 루틴", re: /아침|하루\s*한|한알|한\s*알|챙겨주기|간편|편해서|등교|등원|아침세안|물세안/ },
];

function productSummary(rows: ProductReview[]) {
  if (!rows.length) return "리뷰 JSON 준비 중";
  const usable = rows.filter((r) => !isLowSignalProductReview(r.content || ""));
  const scored = PRODUCT_THEMES.map((theme) => ({
    label: theme.label,
    count: usable.reduce((n, r) => n + (theme.re.test(cleanProductReviewText(r.content || "")) ? 1 : 0), 0),
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const themes = scored.slice(0, 3).map((x) => x.label);
  if (themes.length) return themes.join(" · ");
  const words = productKeywords(usable).slice(0, 3);
  return words.length ? words.join(" · ") : "실제 리뷰 기반 소구 자동 분석";
}

function sampleProductReferences(rows: ProductReview[]) {
  const usefulRows = rows.filter((r) => !isLowSignalProductReview(r.content || ""));
  const sourceRows = usefulRows.length >= 10 ? usefulRows : rows;
  const selected: ProductReview[] = [];
  const seen = new Set<string>();
  const add = (candidates: ProductReview[], amount: number) => {
    for (const row of shuffle(candidates)) {
      const key = normalizeText(row.content || "");
      if (!key || seen.has(key)) continue;
      selected.push(row); seen.add(key); amount -= 1;
      if (amount <= 0) break;
    }
  };
  const keywords = productKeywords(sourceRows);
  for (const keyword of keywords.slice(0, 8)) {
    if (selected.length >= 14) break;
    add(sourceRows.filter((r) => cleanProductReviewText(r.content || "").toLowerCase().includes(keyword)), 1);
  }
  const short = sourceRows.filter((r) => cleanProductReviewText(r.content || "").length <= 100);
  const medium = sourceRows.filter((r) => { const n=cleanProductReviewText(r.content || "").length; return n >= 101 && n <= 250; });
  const long = sourceRows.filter((r) => cleanProductReviewText(r.content || "").length >= 251);
  add(short, 3); add(medium, 4); add(long, 3);
  if (selected.length < 14) add(sourceRows, 14 - selected.length);
  return { examples: shuffle(selected).slice(0, 14).map((r) => cleanProductReviewText(r.content || "")), keywords };
}

export function sampleOliveOnly() {
  const d = data();
  return sampleOliveReferences(d.olive);
}

export function sampleReferences(productId: string) {
  const d = data();
  const product = getProduct(productId);
  const productRows = d.products.get(product.id) || [];
  const sampled = sampleProductReferences(productRows);
  return {
    product,
    olive: sampleOliveReferences(d.olive),
    productExamples: sampled.examples,
    productKeywords: sampled.keywords,
    productReviewCount: productRows.length,
  };
}

export function publicProducts() {
  const d = data();
  return getProducts().map((p) => {
    const rows = d.products.get(p.id) || [];
    return {
      id: p.id,
      brand: p.brand,
      name: p.name,
      label: p.label,
      summary: p.detailSummary || "상세페이지 FACT 기반",
      reviewCount: rows.length,
      detailPageCount: detailPageCount(p),
      ready: rows.length > 0,
    };
  });
}
