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
export type PolishLevel = "clean" | "natural" | "loose";
export type PunctuationStyle = "clean" | "mixed" | "loose";
export type CasualLevel = "none" | "light" | "medium" | "strong";
export type EmojiMode = "none" | "light";

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

function shuffle<T>(a: T[]) { const out=[...a]; for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; }
function randomBool(p:number){ return Math.random()<p; }
function weightedPick<T>(items:Array<{value:T;weight:number}>):T{const total=items.reduce((s,x)=>s+x.weight,0);let r=Math.random()*total;for(const x of items){r-=x.weight;if(r<=0)return x.value;}return items[items.length-1].value;}

function styleDefaults(style: ReviewStyle) {
  if (style === "친근한 구어체·커뮤니티형") return { polish: weightedPick<PolishLevel>([{value:"loose",weight:65},{value:"natural",weight:30},{value:"clean",weight:5}]), punctuation: weightedPick<PunctuationStyle>([{value:"loose",weight:60},{value:"mixed",weight:35},{value:"clean",weight:5}]), casual: weightedPick<CasualLevel>([{value:"strong",weight:45},{value:"medium",weight:40},{value:"light",weight:15},{value:"none",weight:0}]) };
  if (style === "정돈된 리뷰어·체험후기형") return { polish: weightedPick<PolishLevel>([{value:"clean",weight:75},{value:"natural",weight:25},{value:"loose",weight:0}]), punctuation: weightedPick<PunctuationStyle>([{value:"clean",weight:70},{value:"mixed",weight:30},{value:"loose",weight:0}]), casual: weightedPick<CasualLevel>([{value:"none",weight:65},{value:"light",weight:35},{value:"medium",weight:0},{value:"strong",weight:0}]) };
  if (style === "초단문·툭 던지는 형" || style === "재구매·정착템형") return { polish: weightedPick<PolishLevel>([{value:"natural",weight:45},{value:"loose",weight:40},{value:"clean",weight:15}]), punctuation: weightedPick<PunctuationStyle>([{value:"loose",weight:45},{value:"mixed",weight:45},{value:"clean",weight:10}]), casual: weightedPick<CasualLevel>([{value:"light",weight:35},{value:"medium",weight:40},{value:"strong",weight:15},{value:"none",weight:10}]) };
  return { polish: weightedPick<PolishLevel>([{value:"natural",weight:60},{value:"clean",weight:22},{value:"loose",weight:18}]), punctuation: weightedPick<PunctuationStyle>([{value:"mixed",weight:60},{value:"clean",weight:20},{value:"loose",weight:20}]), casual: weightedPick<CasualLevel>([{value:"light",weight:48},{value:"medium",weight:24},{value:"none",weight:24},{value:"strong",weight:4}]) };
}

function buildEmojiFlags(count:number){ if(count<=1)return[randomBool(.24)];const ratio=.2+Math.random()*.1;const n=Math.max(1,Math.min(count,Math.round(count*ratio)));return shuffle([...Array(n).fill(true),...Array(count-n).fill(false)]); }
function expressionFlags(style:ReviewStyle){let laugh=.08,cry=.06;if(style==="친근한 구어체·커뮤니티형"){laugh=.3;cry=.16;}if(style==="재구매·정착템형")laugh=.18;if(style==="피부 고민 선제시형")cry=.18;if(style==="정돈된 리뷰어·체험후기형"){laugh=.02;cry=.01;}return{allowLaugh:randomBool(laugh),allowCry:randomBool(cry)};}

export function buildStylePlan(count:number,requested:"auto"|"short"|"medium"|"long"):ReviewPlanItem[]{
  const lengths:ReviewLength[]=[];
  if(requested!=="auto") for(let i=0;i<count;i++) lengths.push(requested);
  else {let s=Math.round(count*.35),m=Math.round(count*.345),l=count-s-m;if(l<0){m+=l;l=0;}lengths.push(...Array(s).fill("short"),...Array(m).fill("medium"),...Array(l).fill("long"));}
  const pool:ReviewStyle[]=[];while(pool.length<count)pool.push(...shuffle(weightedStyles));
  const styles=pool.slice(0,count), mixed=shuffle(lengths), emoji=buildEmojiFlags(count);
  return Array.from({length:count},(_,i)=>{const base=styleDefaults(styles[i]),expr=expressionFlags(styles[i]);return{index:i+1,length:mixed[i],style:styles[i],polish:base.polish,punctuation:base.punctuation,casual:base.casual,emoji:emoji[i]?"light":"none",allowLaugh:expr.allowLaugh,allowCry:expr.allowCry};});
}

export function stylePlanText(plan:ReturnType<typeof buildStylePlan>){
  const lt={short:"짧은형(대체로 60자 이하)",medium:"중간형(대체로 61~150자)",long:"상세형(대체로 151자 이상)"} as const;
  const pt={clean:"정돈도 높음",natural:"정돈도 보통",loose:"정돈도 느슨함"} as const;
  const qt={clean:"구두점 비교적 정확",mixed:"구두점 혼합",loose:"구두점 느슨/마침표 생략 가능"} as const;
  const ct={none:"구어체 거의 없음",light:"가벼운 구어체",medium:"구어체 중간",strong:"인터넷 구어체 강함"} as const;
  return plan.map(x=>{const e=[x.emoji==="light"?"이모지 1~2개 허용":"이모지 없음"];if(x.allowLaugh)e.push("ㅎㅎ/ㅋㅋ 자연스럽게 허용");if(x.allowCry)e.push("ㅠㅠ/ㅜㅜ 자연스럽게 허용");return `${x.index}. ${lt[x.length]} / ${x.style} / ${pt[x.polish]} / ${qt[x.punctuation]} / ${ct[x.casual]} / ${e.join(", ")}`;}).join("\n");
}
