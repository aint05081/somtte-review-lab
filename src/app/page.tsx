"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Length = "auto" | "short" | "medium" | "long";
type Product = {
  id: string;
  name: string;
  label: string;
  summary: string;
  reviewCount: number;
  custom?: boolean;
};

type CustomProductRecord = Product & {
  custom: true;
  reviews: string[];
  keywords: string[];
};

const STORAGE_KEY = "bnr-review-lab-custom-products-v1";

function normalizeReviewArray(raw: unknown): string[] {
  let rows: unknown = raw;
  if (!Array.isArray(rows) && raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["reviews", "data", "items", "results"]) {
      if (Array.isArray(obj[key])) {
        rows = obj[key];
        break;
      }
    }
  }
  if (!Array.isArray(rows)) {
    throw new Error("JSON 안에서 리뷰 배열을 찾지 못했습니다. 배열 또는 reviews/data/items/results 형식을 사용해주세요.");
  }
  const texts = rows
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const obj = item as Record<string, unknown>;
      for (const key of ["content", "review", "text", "body", "comment", "message"]) {
        if (typeof obj[key] === "string") return String(obj[key]);
      }
      return "";
    })
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return [...new Set(texts)];
}

function topKeywords(reviews: string[]) {
  const stop = new Set([
    "그리고", "근데", "진짜", "너무", "사용", "제품", "피부", "패드", "이거", "저는", "해서", "있어요", "좋아요", "같아요", "정말", "그냥", "조금", "쓰고", "하는", "하고", "되게", "완전", "그런", "같은", "때문", "정도", "느낌", "써요", "좋은", "좋고", "했어요",
  ]);
  const freq = new Map<string, number>();
  for (const review of reviews) {
    const words = review.match(/[가-힣A-Za-z]{2,}/g) || [];
    for (const token of new Set(words.map((x) => x.toLowerCase()))) {
      if (stop.has(token)) continue;
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([word]) => word);
}

function sampleReviews(reviews: string[], max = 90) {
  if (reviews.length <= max) return reviews;
  const short = reviews.filter((x) => x.length <= 100);
  const medium = reviews.filter((x) => x.length > 100 && x.length <= 250);
  const long = reviews.filter((x) => x.length > 250);
  const pick = (rows: string[], count: number) => {
    if (!rows.length) return [];
    const step = Math.max(1, Math.floor(rows.length / count));
    const out: string[] = [];
    for (let i = 0; i < rows.length && out.length < count; i += step) out.push(rows[i]);
    return out;
  };
  return [...pick(short, 30), ...pick(medium, 35), ...pick(long, 25)].slice(0, max);
}

function loadCustomProducts(): CustomProductRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomProductRecord[]) : [];
  } catch {
    return [];
  }
}

function saveCustomProducts(rows: CustomProductRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export default function Home() {
  const [serverProducts, setServerProducts] = useState<Product[]>([]);
  const [customProducts, setCustomProducts] = useState<CustomProductRecord[]>([]);
  const [product, setProduct] = useState("");
  const [experience, setExperience] = useState("");
  const [length, setLength] = useState<Length>("auto");
  const [count, setCount] = useState(5);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadReviews, setUploadReviews] = useState<string[]>([]);
  const [modalError, setModalError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCustomProducts(loadCustomProducts());
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.products || []) as Product[];
        setServerProducts(rows);
        if (rows.length) setProduct((p) => p || rows[0].id);
      })
      .catch(() => setError("제품 목록을 불러오지 못했습니다."));
  }, []);

  const products = useMemo(() => [...serverProducts, ...customProducts], [serverProducts, customProducts]);
  const selected = useMemo(() => products.find((x) => x.id === product), [products, product]);
  const selectedCustom = useMemo(() => customProducts.find((x) => x.id === product), [customProducts, product]);
  const hasExperience = experience.trim().length > 0;

  async function generate() {
    if (!product) return;
    setLoading(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          experience,
          length,
          count,
          customProduct: selectedCustom
            ? {
                id: selectedCustom.id,
                name: selectedCustom.name,
                label: selectedCustom.label,
                summary: selectedCustom.summary,
                reviewCount: selectedCustom.reviewCount,
                keywords: selectedCustom.keywords,
                reviews: selectedCustom.reviews,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성에 실패했습니다.");
      setResult(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (result) await navigator.clipboard.writeText(result);
  }

  function resetModal() {
    setNewName("");
    setNewLabel("");
    setNewSummary("");
    setUploadName("");
    setUploadReviews([]);
    setModalError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onJsonFile(file?: File) {
    if (!file) return;
    setModalError("");
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const reviews = normalizeReviewArray(raw);
      if (!reviews.length) throw new Error("리뷰 본문을 찾지 못했습니다.");
      setUploadReviews(reviews);
      setUploadName(file.name);
      if (!newName) setNewName(file.name.replace(/\.json$/i, "").replace(/[_-]+/g, " "));
    } catch (e) {
      setUploadReviews([]);
      setUploadName("");
      setModalError(e instanceof Error ? e.message : "JSON 파일을 읽지 못했습니다.");
    }
  }

  function registerProduct() {
    const name = newName.trim();
    if (!name) return setModalError("제품명을 입력해주세요.");
    if (!uploadReviews.length) return setModalError("공홈 리뷰 JSON 파일을 업로드해주세요.");

    const id = `custom-${Date.now()}`;
    const sampled = sampleReviews(uploadReviews, 90);
    const record: CustomProductRecord = {
      id,
      name,
      label: newLabel.trim() || name,
      summary: newSummary.trim() || "공홈 실제 리뷰 기반",
      reviewCount: uploadReviews.length,
      custom: true,
      reviews: sampled,
      keywords: topKeywords(uploadReviews),
    };

    const next = [...customProducts, record];
    setCustomProducts(next);
    saveCustomProducts(next);
    setProduct(id);
    setModalOpen(false);
    resetModal();
  }

  function removeSelectedCustom() {
    if (!selectedCustom) return;
    if (!window.confirm(`${selectedCustom.label} 제품을 이 브라우저에서 삭제할까요?`)) return;
    const next = customProducts.filter((x) => x.id !== selectedCustom.id);
    setCustomProducts(next);
    saveCustomProducts(next);
    setProduct(serverProducts[0]?.id || next[0]?.id || "");
  }

  return (
    <main className="shell">
      <div className="bgGlow glowOne" />
      <div className="bgGlow glowTwo" />
      <div className="wrap">
        <header className="header">
          <div>
            <div className="eyebrow">BNR · INTERNAL TOOL</div>
            <h1><span>BNR</span> Review Lab</h1>
            <p className="subtitle">올리브영 실제 리뷰는 소비자 문체용, 각 제품의 공홈 리뷰 JSON은 제품별 소구용으로 분리해 사용합니다.</p>
          </div>
          <button className="registerButton" onClick={() => setModalOpen(true)}>
            <span className="plus">＋</span> 제품 등록
          </button>
        </header>

        <section className="grid compactGrid">
          <div className="card controlCard">
            <h2><span className="sectionIcon">✎</span> 리뷰 생성</h2>
            <span className="label">제품</span>
            <div className="products dynamicProducts">
              {products.map((p) => (
                <button key={p.id} className={`product ${product === p.id ? "active" : ""}`} onClick={() => setProduct(p.id)}>
                  <strong>{p.label}</strong>
                  <span>{p.summary}</span>
                  {p.custom && <em>직접 등록</em>}
                </button>
              ))}
              {!products.length && <div className="placeholder">제품 목록 불러오는 중…</div>}
            </div>
            {selectedCustom && <button className="deleteProduct" onClick={removeSelectedCustom}>선택한 직접 등록 제품 삭제</button>}

            <label className="label" htmlFor="experience">넣고 싶은 경험 / 포인트 <span className="optional">선택</span></label>
            <textarea
              id="experience"
              className="experienceBox"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder={'비워두면 선택한 제품 리뷰 데이터에서 소구와\n가상 상황을 자동으로 조합해요.\n\n직접 넣고 싶은 내용이 있다면 메모하듯 적어주세요.'}
            />
            <div className={`modePill ${hasExperience ? "guided" : "auto"}`}>
              {hasExperience ? "입력 반영 모드 · 적어둔 내용을 중심으로 생성" : "자동 생성 모드 · 선택 제품 리뷰에서 소구 자동 구성"}
            </div>

            <div className="row optionsRow">
              <div><label className="label">길이</label><select value={length} onChange={(e) => setLength(e.target.value as Length)}><option value="auto">데이터 기반 자동</option><option value="short">짧게</option><option value="medium">보통</option><option value="long">길게</option></select></div>
              <div><label className="label">결과 수</label><select value={count} onChange={(e) => setCount(Number(e.target.value))}><option value={1}>1개</option><option value={3}>3개</option><option value={5}>5개</option><option value={10}>10개</option><option value={20}>20개</option></select></div>
            </div>

            <button className="primary bigPrimary" onClick={generate} disabled={loading || !product}>{loading ? "리뷰 만드는 중…" : `✧ ${count}개 리뷰 만들기`}</button>

            <div className="profileInfo">
              <div><b>문체</b><span>올리브영 실질 분석 4,290개 기반</span></div>
              <div><b>제품 소구</b><span>{selected ? `${selected.reviewCount}개 실제 리뷰 기반` : "-"}</span></div>
              <div><b>입력</b><span>{hasExperience ? "작성한 포인트 우선 반영" : "제품별 소구 자동 조합"}</span></div>
            </div>
            <div className="notice"><b>새 제품은 오른쪽 상단 ‘제품 등록’ 버튼</b>을 눌러 제품명과 공홈 리뷰 JSON만 업로드하면 바로 사용할 수 있습니다.</div>
            {error && <div className="error">{error}</div>}
          </div>

          <div className="card resultCard">
            <div className="resultTop"><h2><span className="sectionIcon">✧</span> 생성된 리뷰 샘플</h2><div className="actions"><button className="ghost" onClick={copy} disabled={!result}>전체 복사</button><button className="ghost accentGhost" onClick={generate} disabled={loading || !product}>다시 만들기</button></div></div>
            <div className={`resultBox ${result ? "" : "placeholder"}`}>
              {result || <div className="emptyState"><div className="fileIcon">▤</div><strong>리뷰를 생성해 보세요!</strong><span>왼쪽에서 조건을 설정하고<br />‘리뷰 만들기’ 버튼을 눌러주세요.</span></div>}
            </div>
            <div className="meta">원본 리뷰 JSON은 브라우저 화면에 노출하지 않습니다. 기본 제품은 서버에서, 직접 등록 제품은 현재 브라우저에만 저장되어 사용됩니다.</div>
          </div>
        </section>
        <footer>© <b>BNR</b> Review Lab · Internal Tool</footer>
      </div>

      {modalOpen && (
        <div className="modalBackdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setModalOpen(false); resetModal(); } }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="제품 등록">
            <div className="modalHeader">
              <div><span className="modalEyebrow">NEW PRODUCT</span><h3>제품 등록</h3></div>
              <button className="closeButton" onClick={() => { setModalOpen(false); resetModal(); }} aria-label="닫기">×</button>
            </div>

            <label className="label">제품명</label>
            <input className="textInput" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: BNR 수딩 토너패드" />

            <label className="label">화면 표시명 <span className="optional">선택</span></label>
            <input className="textInput" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="비우면 제품명 그대로 표시됩니다." />

            <label className="label">짧은 소구 설명 <span className="optional">선택</span></label>
            <input className="textInput" value={newSummary} onChange={(e) => setNewSummary(e.target.value)} placeholder="예: 수분 · 진정 · 피부결" />

            <label className="label">공홈 리뷰 JSON</label>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onJsonFile(e.target.files?.[0])} />
            <button className={`uploadBox ${uploadReviews.length ? "uploaded" : ""}`} onClick={() => fileRef.current?.click()} type="button">
              <span className="uploadIcon">⇧</span>
              <strong>{uploadReviews.length ? `${uploadReviews.length.toLocaleString()}개 리뷰 확인됨` : "JSON 파일 업로드"}</strong>
              <small>{uploadName || "클릭해서 공홈 리뷰 JSON을 선택하세요"}</small>
            </button>

            <div className="formatGuide">
              <b>JSON 형식 안내</b>
              <span>리뷰 배열 또는 reviews / data / items / results 배열을 읽습니다.</span>
              <code>{`[{ "content": "리뷰 내용", "ratings": 5 }]`}</code>
            </div>

            {modalError && <div className="error modalError">{modalError}</div>}
            <div className="modalActions">
              <button className="cancelButton" onClick={() => { setModalOpen(false); resetModal(); }}>취소</button>
              <button className="registerSubmit" onClick={registerProduct}>등록하기</button>
            </div>
            <p className="storageNote">※ 직접 등록한 제품은 이 브라우저에 저장됩니다. 다른 기기에도 공통 적용하려면 추후 DB 연결이 필요합니다.</p>
          </div>
        </div>
      )}
    </main>
  );
}
