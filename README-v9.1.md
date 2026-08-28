# BNR Review Lab v9.1

v9.1 fixes product appeal extraction from review JSON.

- Removes Cafe24/Naver Pay boilerplate such as `(YYYY-MM-DD ... 에 등록된 네이버 페이 구매평)` before analysis.
- Excludes repeated low-information widget reviews such as `만족할 만큼 좋은 상품이에요 ... 감사합니다.` from appeal extraction and product reference sampling.
- Product cards now show semantic appeal themes (e.g. 맛·섭취 편의 / 영양성분·균형 / 성장기·키 고민) instead of raw high-frequency words.
- Keeps original review counts unchanged; filtering is only for appeal analysis/reference sampling.
