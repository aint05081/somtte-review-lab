"use client";

import { useEffect, useMemo, useState } from "react";

type Length = "auto" | "short" | "medium" | "long";
type AgeGroup = "auto" | "teens" | "20s" | "30s" | "40s" | "50plus";
type ImageQuality = "low" | "medium" | "high";
type Product = {
  id: string;
  brand: string;
  name: string;
  label: string;
  summary: string;
  reviewCount: number;
  detailPageCount: number;
  photoReviewCount: number;
  ready: boolean;
};
type ImageState = { urls: string[]; loading: boolean; error: string };

function splitReviews(text: string) {
  if (!text.trim()) return [];
  const blocks = text
    .split(/(?:^|\n)\s*\d+\s*[.)]\s*/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (blocks.length) return blocks.map((x) => x.replace(/^\d+\s*[.)]\s*/, "").trim());
  return [text.trim()];
}

function qualityLabel(q: ImageQuality) {
  return q === "low" ? "저화질" : q === "medium" ? "중화질" : "고화질";
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [product, setProduct] = useState("");
  const [experience, setExperience] = useState("");
  const [length, setLength] = useState<Length>("auto");
  const [count, setCount] = useState(5);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("auto");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [withImages, setWithImages] = useState(false);
  const [imageQuality, setImageQuality] = useState<ImageQuality>("high");
  const [imagesPerReview, setImagesPerReview] = useState(1);
  const [reviewImages, setReviewImages] = useState<Record<number, ImageState>>({});

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.products || []) as Product[];
        setProducts(rows);
        const firstReady = rows.find((x) => x.ready) || rows[0];
        if (firstReady) setProduct(firstReady.id);
      })
      .catch(() => setError("제품 목록을 불러오지 못했습니다."));
  }, []);

  const selected = useMemo(() => products.find((x) => x.id === product), [products, product]);
  const reviews = useMemo(() => splitReviews(result), [result]);
  const hasExperience = experience.trim().length > 0;
  const brands = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      if (!map.has(p.brand)) map.set(p.brand, []);
      map.get(p.brand)!.push(p);
    }
    return [...map.entries()];
  }, [products]);

  async function generateImage(review: string, index: number, amount = imagesPerReview) {
    setReviewImages((prev) => ({
      ...prev,
      [index]: { urls: prev[index]?.urls || [], loading: true, error: "" },
    }));
    try {
      const urls: string[] = [];
      for (let i = 0; i < amount; i++) {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, review, quality: imageQuality }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const main = data.error || "이미지 생성에 실패했습니다.";
          const extra = data.detail && data.detail !== main ? `\n상세: ${data.detail}` : "";
          const model = data.model ? `\n모델: ${data.model}` : "";
          throw new Error(`${main}${extra}${model}`);
        }
        const blob = await res.blob();
        urls.push(URL.createObjectURL(blob));
      }
      setReviewImages((prev) => ({ ...prev, [index]: { urls, loading: false, error: "" } }));
    } catch (e) {
      let message = e instanceof Error ? e.message : "이미지 생성 오류";
      if (/failed to fetch|networkerror|load failed/i.test(message)) {
        message = imageQuality === "high"
          ? "고화질 생성 요청이 서버 응답 전에 끊겼습니다. Vercel 함수 시간 제한 또는 네트워크 문제일 수 있어요. 잠시 후 다시 시도해주세요."
          : "이미지 생성 서버 연결이 끊겼습니다. 잠시 후 다시 시도해주세요.";
      }
      setReviewImages((prev) => ({
        ...prev,
        [index]: { urls: prev[index]?.urls || [], loading: false, error: message },
      }));
    }
  }

  async function generate() {
    if (!product || !selected?.ready) return;
    setLoading(true);
    setError("");
    setResult("");
    setReviewImages({});
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, experience, length, count, ageGroup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성에 실패했습니다.");
      setResult(data.text);

      if (withImages) {
        const generatedReviews = splitReviews(data.text);
        for (let i = 0; i < generatedReviews.length; i++) {
          await generateImage(generatedReviews[i], i, imagesPerReview);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (result) await navigator.clipboard.writeText(result);
  }

  function saveImage(url: string, index: number, imageIndex: number) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected?.label || "review"}-review-${index + 1}-${imageIndex + 1}.jpg`;
    a.click();
  }

  return (
    <main className="shell">
      <div className="bgGlow glowOne" />
      <div className="bgGlow glowTwo" />
      <div className="wrap">
        <header className="header simpleHeader">
          <div>
            <div className="eyebrow">BNR · INTERNAL TOOL</div>
            <h1><span>BNR</span> Review Lab</h1>
            <p className="subtitle">올리브영 실제 리뷰는 소비자 문체용, 공홈 리뷰는 개인 사용 경험·생활 맥락용, 제품 상세페이지는 공식 소구와 제품 FACT 확인용으로 사용합니다.</p>
          </div>
        </header>

        <section className="grid compactGrid">
          <div className="card controlCard">
            <h2><span className="sectionIcon">✎</span> 리뷰 생성</h2>

            <span className="label">제품</span>
            <div className="brandGroups">
              {brands.map(([brand, rows]) => (
                <div className="brandGroup" key={brand}>
                  <div className="brandTitle"><span>{brand}</span><small>{rows.filter((x) => x.ready).length}/{rows.length} READY</small></div>
                  <div className="products">
                    {rows.map((p) => (
                      <button
                        key={p.id}
                        className={`product ${product === p.id ? "active" : ""} ${!p.ready ? "notReady" : ""}`}
                        onClick={() => { setProduct(p.id); setReviewImages({}); }}
                      >
                        <strong>{p.label}</strong>
                        <span>{p.summary}</span>
                        {!p.ready && <em>JSON 필요</em>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!products.length && <div className="placeholder">제품 목록 불러오는 중…</div>}
            </div>

            <label className="label" htmlFor="experience">넣고 싶은 경험 / 포인트 <span className="optional">선택</span></label>
            <textarea
              id="experience"
              className="experienceBox"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder={'비워두면 상세페이지 FACT와 실제 공홈 리뷰의\n사용 경험을 바탕으로 자동 생성해요.\n\n직접 넣고 싶은 내용이 있다면 메모하듯 적어주세요.'}
            />
            <div className={`modePill ${hasExperience ? "guided" : "auto"}`}>
              {hasExperience ? "입력 반영 모드 · 적어둔 내용을 중심으로 생성" : "자동 생성 모드 · 상세페이지 FACT + 실제 경험 자동 조합"}
            </div>

            <div className="row threeOptions optionsRow">
              <div><label className="label">연령대</label><select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}><option value="auto">자동</option><option value="teens">10대</option><option value="20s">20대</option><option value="30s">30대</option><option value="40s">40대</option><option value="50plus">50대+</option></select></div>
              <div><label className="label">길이</label><select value={length} onChange={(e) => setLength(e.target.value as Length)}><option value="auto">데이터 기반 자동</option><option value="short">짧게</option><option value="medium">보통</option><option value="long">길게</option></select></div>
              <div><label className="label">결과 수</label><select value={count} onChange={(e) => setCount(Number(e.target.value))}><option value={1}>1개</option><option value={3}>3개</option><option value={5}>5개</option><option value={10}>10개</option><option value={20}>20개</option></select></div>
            </div>

            <div className="imageOptionsPanel">
              <label className="imageToggle">
                <input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} />
                <span className="fakeCheck">✓</span>
                <div><b>리뷰 이미지도 함께 생성</b><small>제품은 공홈 후기·상세페이지 / 사진 유형·배치는 올리브영 포토리뷰까지 분석</small></div>
              </label>
              <div className={`imageOptionControls ${withImages ? "" : "disabledPanel"}`}>
                <div><label className="label">이미지 화질</label><select value={imageQuality} onChange={(e) => setImageQuality(e.target.value as ImageQuality)} disabled={!withImages}><option value="low">저화질</option><option value="medium">중화질</option><option value="high">고화질</option></select></div>
                <div><label className="label">리뷰당 이미지</label><select value={imagesPerReview} onChange={(e) => setImagesPerReview(Number(e.target.value))} disabled={!withImages}><option value={1}>1장</option><option value={2}>2장</option><option value={3}>3장</option><option value={4}>4장</option></select></div>
              </div>
              <div className="imageRefInfo">
                <span>📷 실제 사진 리뷰 <b>{selected?.photoReviewCount || 0}건</b></span>
                <span>▤ 상세페이지 <b>{selected?.detailPageCount || 0}장</b></span>
              </div>
            </div>

            <button className="primary bigPrimary" onClick={generate} disabled={loading || !product || !selected?.ready}>
              {loading ? (withImages ? "리뷰·이미지 만드는 중…" : "리뷰 만드는 중…") : selected?.ready ? `✧ ${count}개 리뷰 만들기${withImages ? " + 이미지" : ""}` : "이 제품의 리뷰 JSON을 먼저 넣어주세요"}
            </button>

            <div className="profileInfo">
              <div><b>문체</b><span>올리브영 실질 분석 4,290개 기반</span></div>
              <div><b>브랜드</b><span>{selected?.brand || "-"}</span></div>
              <div><b>연령대</b><span>{ageGroup === "auto" ? "자동 분산" : ageGroup === "teens" ? "10대 말투" : ageGroup === "50plus" ? "50대+ 말투" : `${ageGroup.replace("s", "")}대 말투`}</span></div>
              <div><b>제품 소구</b><span>{selected ? `상세페이지 ${selected.detailPageCount}개 이미지 기반` : "-"}</span></div>
              <div><b>리뷰 이미지</b><span>{selected ? `공홈 사진리뷰 ${selected.photoReviewCount || 0}건 + 올리브영 4,290개 패턴` : "-"}</span></div>
              <div><b>입력</b><span>{hasExperience ? "작성한 포인트 우선 반영" : "공식 소구 + 실제 경험 자동 조합"}</span></div>
            </div>
            <div className="notice"><b>이미지는 새로 생성됩니다.</b> 실제 고객 사진은 구도·생활감·촬영 패턴 참고용으로만 사용하며, 특정 고객이나 아이의 얼굴·방·포즈를 복제하지 않습니다. 생성된 사진에는 화면에서 AI 생성 표시가 붙습니다.</div>
            {error && <div className="error">{error}</div>}
          </div>

          <div className="card resultCard">
            <div className="resultTop"><h2><span className="sectionIcon">✧</span> 생성된 리뷰 샘플</h2><div className="actions"><button className="ghost" onClick={copy} disabled={!result}>전체 복사</button><button className="ghost accentGhost" onClick={generate} disabled={loading || !selected?.ready}>다시 만들기</button></div></div>

            {!reviews.length ? (
              <div className="resultBox placeholder"><div className="emptyState"><div className="fileIcon">▤</div><strong>리뷰를 생성해 보세요!</strong><span>왼쪽에서 제품과 조건을 고르고<br />‘리뷰 만들기’를 눌러주세요.</span></div></div>
            ) : (
              <div className="reviewCards">
                {reviews.map((review, index) => {
                  const imgState = reviewImages[index] || { urls: [], loading: false, error: "" };
                  return (
                    <article className="reviewCard" key={`${index}-${review.slice(0, 20)}`}>
                      <div className="reviewCardTop"><span className="reviewNo">REVIEW {index + 1}</span><span className="stars">★★★★★</span></div>
                      <div className="reviewText">{review}</div>

                      <div className="reviewImageBar">
                        <div><b>리뷰 이미지</b><small>{qualityLabel(imageQuality)} · {imagesPerReview}장 · 공홈 제품 맥락 + 올리브영 포토 패턴</small></div>
                        <button className="imageGenerateButton" onClick={() => generateImage(review, index)} disabled={imgState.loading}>
                          {imgState.loading ? "생성 중…" : imgState.urls.length ? "↻ 다시 생성" : "✦ 이미지 생성"}
                        </button>
                      </div>

                      {imgState.error && <div className="imageError">{imgState.error}</div>}
                      {imgState.loading && <div className="imageLoading"><div className="spinner" /><b>후기 사진 패턴을 참고해 생성 중…</b><span>고화질은 중화질보다 오래 걸릴 수 있어요. 창을 닫지 말고 기다려주세요.</span></div>}
                      {!!imgState.urls.length && !imgState.loading && (
                        <div className={`generatedImageGrid count${Math.min(imgState.urls.length, 4)}`}>
                          {imgState.urls.map((url, imageIndex) => (
                            <div className="generatedImage" key={url}>
                              <img src={url} alt={`AI 생성 리뷰 이미지 ${imageIndex + 1}`} />
                              <span className="aiBadge">AI 생성 이미지</span>
                              <button className="saveImageButton" onClick={() => saveImage(url, index, imageIndex)}>저장</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="meta">제품별 원본 리뷰와 상세페이지 이미지는 브라우저에 공개하지 않고 서버에서만 읽습니다. 이미지 생성 시 상세페이지는 제품 외형·FACT, 공홈 후기 사진은 해당 제품의 실제 사용 맥락, 올리브영 4,290개 리뷰의 포토리뷰 메타·문맥은 사진 유형·구도·배치 패턴 참고용으로 사용합니다.</div>
          </div>
        </section>
        <footer>© <b>BNR</b> Review Lab · Internal Tool</footer>
      </div>
    </main>
  );
}
