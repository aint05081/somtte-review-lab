"use client";

import { useEffect, useMemo, useState } from "react";

type Length = "auto" | "short" | "medium" | "long";
type Product = { id: string; name: string; label: string; summary: string; reviewCount: number };

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [product, setProduct] = useState("");
  const [experience, setExperience] = useState("");
  const [length, setLength] = useState<Length>("auto");
  const [count, setCount] = useState(5);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.products || []) as Product[];
        setProducts(rows);
        if (rows.length) setProduct((p) => p || rows[0].id);
      })
      .catch(() => setError("제품 목록을 불러오지 못했습니다."));
  }, []);

  const selected = useMemo(() => products.find((x) => x.id === product), [products, product]);
  const hasExperience = experience.trim().length > 0;

  async function generate() {
    if (!product) return;
    setLoading(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, experience, length, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성에 실패했습니다.");
      setResult(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally { setLoading(false); }
  }

  async function copy() { if (result) await navigator.clipboard.writeText(result); }

  return (
    <main className="shell">
      <div className="wrap">
        <header className="header">
          <div>
            <div className="eyebrow">SOMTTE · INTERNAL TOOL</div>
            <h1>SOMTTE Review Lab</h1>
            <p className="subtitle">올리브영 실제 리뷰는 소비자 문체용, 각 제품의 공홈 리뷰 JSON은 제품별 소구용으로 분리해 사용합니다.</p>
          </div>
          <div className="badge">제품 자동 등록 구조</div>
        </header>

        <section className="grid compactGrid">
          <div className="card controlCard">
            <h2>리뷰 생성</h2>
            <span className="label">제품</span>
            <div className="products dynamicProducts">
              {products.map((p, i) => (
                <button key={p.id} className={`product ${product === p.id ? "active dynamicActive" : ""}`} onClick={() => setProduct(p.id)}>
                  <strong>{p.label}</strong>
                  <span>{p.summary}</span>
                </button>
              ))}
              {!products.length && <div className="placeholder">제품 목록 불러오는 중…</div>}
            </div>

            <label className="label" htmlFor="experience">넣고 싶은 경험 / 포인트 <span className="optional">선택</span></label>
            <textarea
              id="experience"
              className="experienceBox"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder={'비워두면 선택한 제품 리뷰 데이터에서 소구와 가상 상황을 자동으로 조합해요.\n\n직접 넣고 싶은 내용이 있다면 메모하듯 적어주세요.'}
            />
            <div className={`modePill ${hasExperience ? "guided" : "auto"}`}>
              {hasExperience ? "입력 반영 모드 · 적어둔 내용을 중심으로 생성" : "자동 생성 모드 · 선택 제품 리뷰에서 소구 자동 구성"}
            </div>

            <div className="row optionsRow">
              <div><label className="label">길이</label><select value={length} onChange={(e) => setLength(e.target.value as Length)}><option value="auto">데이터 기반 자동</option><option value="short">짧게</option><option value="medium">보통</option><option value="long">길게</option></select></div>
              <div><label className="label">결과 수</label><select value={count} onChange={(e) => setCount(Number(e.target.value))}><option value={1}>1개</option><option value={3}>3개</option><option value={5}>5개</option><option value={10}>10개</option><option value={20}>20개</option></select></div>
            </div>

            <button className="primary bigPrimary" onClick={generate} disabled={loading || !product}>{loading ? "리뷰 만드는 중…" : `${count}개 리뷰 만들기`}</button>

            <div className="profileInfo">
              <div><b>문체</b><span>올리브영 실질 분석 4,290개 기반</span></div>
              <div><b>제품 소구</b><span>{selected ? `${selected.reviewCount}개 실제 리뷰 기반` : "-"}</span></div>
              <div><b>입력</b><span>{hasExperience ? "작성한 포인트 우선 반영" : "제품별 소구 자동 조합"}</span></div>
            </div>
            <div className="notice">새 제품은 <b>data/products/</b>에 리뷰 JSON을 넣고 <b>data/products.json</b>에 제품명과 파일명만 등록하면 자동으로 목록에 나타납니다.</div>
            {error && <div className="error">{error}</div>}
          </div>

          <div className="card">
            <div className="resultTop"><h2>생성된 리뷰 샘플</h2><div className="actions"><button className="ghost" onClick={copy} disabled={!result}>전체 복사</button><button className="ghost" onClick={generate} disabled={loading || !product}>다시 만들기</button></div></div>
            <div className={`resultBox ${result ? "" : "placeholder"}`}>{result || "① 제품 선택\n② 필요하면 경험/포인트 입력\n③ 길이와 결과 수 선택\n④ 리뷰 만들기\n\n새 제품도 JSON 등록만 하면 같은 방식으로 사용할 수 있습니다."}</div>
            <div className="meta">원본 리뷰 JSON은 브라우저에 공개하지 않고 서버에서만 읽습니다. 제품별 실제 리뷰에서 소구를, 올리브영 데이터에서 문체를 참고합니다.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
