"use client";

import { useState } from "react";

type Product = "centella" | "solanum";
type Length = "auto" | "short" | "medium" | "long";

export default function Home() {
  const [product, setProduct] = useState<Product>("centella");
  const [experience, setExperience] = useState("");
  const [length, setLength] = useState<Length>("auto");
  const [count, setCount] = useState(5);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
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

  const hasExperience = experience.trim().length > 0;

  return (
    <main className="shell">
      <div className="wrap">
        <header className="header">
          <div>
            <div className="eyebrow">SOMTTE · INTERNAL TOOL</div>
            <h1>SOMTTE Review Lab</h1>
            <p className="subtitle">올리브영 실제 리뷰에서는 소비자 문체를, 솜떼 실제 리뷰에서는 제품별 소구를 분리해 참고합니다. 경험 입력은 선택사항입니다.</p>
          </div>
          <div className="badge">4,594 reviews embedded</div>
        </header>

        <section className="grid compactGrid">
          <div className="card controlCard">
            <h2>리뷰 생성</h2>
            <span className="label">제품</span>
            <div className="products">
              <button className={`product centella ${product === "centella" ? "active" : ""}`} onClick={() => setProduct("centella")}>
                <strong>센텔라 카밍</strong><span>진정 · 촉촉함 · 코튼볼 부드러움</span>
              </button>
              <button className={`product solanum ${product === "solanum" ? "active" : ""}`} onClick={() => setProduct("solanum")}>
                <strong>솔라눔 올클리어</strong><span>유분 · 피지 · 모공 · 피부결 정돈</span>
              </button>
            </div>

            <label className="label" htmlFor="experience">넣고 싶은 경험 / 포인트 <span className="optional">선택</span></label>
            <textarea
              id="experience"
              className="experienceBox"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder={'비워두면 제품 데이터에서 소구와 가상 상황을 자동으로 조합해요.\n\n직접 넣고 싶은 내용이 있다면 편하게 메모하듯 적어주세요.\n예) 코 옆 유분이 신경 쓰였는데 닦고 나면 피부결이 매끈한 느낌'}
            />
            <div className={`modePill ${hasExperience ? "guided" : "auto"}`}>
              {hasExperience ? "입력 반영 모드 · 적어둔 내용을 중심으로 생성" : "자동 생성 모드 · 제품 소구에서 알아서 구성"}
            </div>

            <div className="row optionsRow">
              <div><label className="label">길이</label><select value={length} onChange={(e) => setLength(e.target.value as Length)}><option value="auto">데이터 기반 자동</option><option value="short">짧게</option><option value="medium">보통</option><option value="long">길게</option></select></div>
              <div><label className="label">결과 수</label><select value={count} onChange={(e) => setCount(Number(e.target.value))}><option value={1}>1개</option><option value={3}>3개</option><option value={5}>5개</option><option value={10}>10개</option><option value={20}>20개</option></select></div>
            </div>

            <button className="primary bigPrimary" onClick={generate} disabled={loading}>{loading ? "리뷰 만드는 중…" : `${count}개 리뷰 만들기`}</button>

            <div className="profileInfo">
              <div><b>문체</b><span>올리브영 리뷰 4,380개 분포 기반</span></div>
              <div><b>소구</b><span>{product === "centella" ? "센텔라 실제 리뷰 106개 기반" : "솔라눔 올클리어 실제 리뷰 108개 기반"}</span></div>
              <div><b>입력</b><span>{hasExperience ? "작성한 포인트 우선 반영" : "제품별 소구 자동 조합"}</span></div>
            </div>
            <div className="notice">입력창이 비어 있으면 제품별 실제 리뷰에서 확인된 소구로 <b>가상 리뷰 샘플</b>을 만들고, 입력하면 그 내용을 중심으로 표현을 구성합니다.</div>
            {error && <div className="error">{error}</div>}
          </div>

          <div className="card">
            <div className="resultTop"><h2>생성된 리뷰 샘플</h2><div className="actions"><button className="ghost" onClick={copy} disabled={!result}>전체 복사</button><button className="ghost" onClick={generate} disabled={loading}>다시 만들기</button></div></div>
            <div className={`resultBox ${result ? "" : "placeholder"}`}>{result || "입력창은 선택사항이에요.\n\n① 제품만 고르고 바로 만들기 → 제품별 소구를 자동 조합\n② 원하는 경험이나 포인트를 적고 만들기 → 입력 내용을 중심으로 리뷰 구성\n\n두 경우 모두 올리브영 실제 리뷰 데이터의 말투·길이·이모지·인터넷 표현 분포를 참고합니다."}</div>
            <div className="meta">원본 JSON은 브라우저에 공개하지 않고 서버에서만 읽습니다. 매 생성마다 전체 4,594개를 API로 보내지 않고 문체 표본과 해당 제품 표본 일부만 전달합니다.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
