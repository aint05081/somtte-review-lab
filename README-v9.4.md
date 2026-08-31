# BNR Review Lab v9.4 — Review Image Generation

## Added
- Review cards are rendered individually after text generation.
- Each review card has `이미지 생성 / 다시 생성 / 저장` controls.
- Optional `리뷰 이미지도 함께 생성` mode.
- Image quality selector: low / medium / high (default high).
- Images per review: 1–4.
- Product-specific real customer photo-review references are selected from `ordered_media`.
- Official detail-page images are passed as product/package visual references.
- Real customer photos are used only as shooting-style references; prompts explicitly request a new composition and no identity reproduction.
- AI-generated images are visibly labeled in the UI.

## Current attached JSON files merged
- betterday_growday.json
- betterday_calmadi.json
- betterday_kidsday_apple_grape.json
- betterday_kidsday_daily.json
- candide_toothpaste.json

## Environment variables
```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4
OPENAI_IMAGE_MODEL=gpt-image-2
```

`OPENAI_IMAGE_MODEL` is optional. If omitted, the app uses `gpt-image-2`.

## Deploy
```bash
npm install
npm run build
git add -A
git commit -m "Add review image generation"
git push origin main
```
