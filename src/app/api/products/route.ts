import { NextResponse } from "next/server";
import { publicProducts } from "@/lib/reviews";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ products: publicProducts() });
}
