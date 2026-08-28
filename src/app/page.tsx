"use client";

import { useEffect, useMemo, useState } from "react";

type Length = "auto" | "short" | "medium" | "long";
type AgeGroup = "auto" | "teens" | "20s" | "30s" | "40s" | "50plus";
type Product = {
  id: string;
  brand: string;
  name: string;
  label: string;
  summary: string;
  reviewCount: number;
  detailPageCount: number;
  ready: boolean;
};

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
  const hasExperience = experience.trim().length > 0;
  const brands = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      if (!map.has(p.brand)) map.set(p.brand, []);
      map.get(p.brand)!.push(p);
    }
    return [...map.entries()];
  }, [products]);

  async function generate() {
    if (!product || !selected?.ready) return;
    setLoading(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, experience, length, count, ageGroup }),
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
                        onClick={() => setProduct(p.id)}
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

            <button className="primary bigPrimary" onClick={generate} disabled={loading || !product || !selected?.ready}>
              {loading ? "리뷰 만드는 중…" : selected?.ready ? `✧ ${count}개 리뷰 만들기` : "이 제품의 리뷰 JSON을 먼저 넣어주세요"}
            </button>

            <div className="profileInfo">
              <div><b>문체</b><span>올리브영 실질 분석 4,290개 기반</span></div>
              <div><b>브랜드</b><span>{selected?.brand || "-"}</span></div>
              <div><b>연령대</b><span>{ageGroup === "auto" ? "자동 분산" : ageGroup === "teens" ? "10대 말투" : ageGroup === "50plus" ? "50대+ 말투" : `${ageGroup.replace("s", "")}대 말투`}</span></div>
              <div><b>제품 소구</b><span>{selected ? `상세페이지 ${selected.detailPageCount}개 이미지 기반` : "-"}</span></div>
              <div><b>상세페이지</b><span>{selected ? `${selected.detailPageCount}개 이미지 구간 반영` : "-"}</span></div>
              <div><b>입력</b><span>{hasExperience ? "작성한 포인트 우선 반영" : "공식 소구 + 실제 경험 자동 조합"}</span></div>
            </div>
            <div className="notice"><b>제품 카드의 소구는 상세페이지 기준입니다.</b> 공홈 리뷰는 실제 소비자의 개인 경험·구매 계기·생활 맥락을 참고하고, 공식 성분·기능·사용법·핵심 소구는 전체 상품 상세페이지에서 확인합니다.</div>
            {error && <div className="error">{error}</div>}
          </div>

          <div className="card resultCard">
            <div className="resultTop"><h2><span className="sectionIcon">✧</span> 생성된 리뷰 샘플</h2><div className="actions"><button className="ghost" onClick={copy} disabled={!result}>전체 복사</button><button className="ghost accentGhost" onClick={generate} disabled={loading || !selected?.ready}>다시 만들기</button></div></div>
            <div className={`resultBox ${result ? "" : "placeholder"}`}>
              {result || <div className="emptyState"><div className="fileIcon">▤</div><strong>리뷰를 생성해 보세요!</strong><span>왼쪽에서 제품과 조건을 고르고<br />‘리뷰 만들기’를 눌러주세요.</span></div>}
            </div>
            <div className="meta">제품별 원본 리뷰와 상세페이지 이미지는 브라우저에 공개하지 않고 서버에서만 읽습니다. 올리브영은 문체, 공홈 리뷰는 개인 경험·생활 맥락, 상세페이지는 공식 소구와 FACT 확인에 사용합니다.</div>
          </div>
        </section>
        <footer>© <b>BNR</b> Review Lab · Internal Tool</footer>
      </div>
    </main>
  );
}
