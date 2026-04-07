/**
 * OAuth 2.1 Dynamic Client Registration (RFC 7591)
 *
 * クライアント（claude.ai 等）が自身を動的に登録するためのエンドポイント。
 * Public client として登録し client_id を発行する（client_secret は不要）。
 * client_id は署名付き JWT で、登録情報（redirect_uris 等）を内包する。
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, optionsResponse } from "../cors";
import { signClientRegistration } from "../jwt";

/** client_id JWT の最大バイト数（ヘッダ肥大化防止） */
export const MAX_CLIENT_ID_BYTES = 1024;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
      { status: 400, headers: corsHeaders },
    );
  }

  // redirect_uris の各要素が文字列であることを検証
  if (!body.redirect_uris.every((uri: unknown) => typeof uri === "string")) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris must be an array of strings" },
      { status: 400, headers: corsHeaders },
    );
  }

  // client_name が指定されている場合は文字列であることを検証
  if (body.client_name !== undefined && typeof body.client_name !== "string") {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "client_name must be a string" },
      { status: 400, headers: corsHeaders },
    );
  }

  const clientName = body.client_name || "Unknown Client";

  const clientId = await signClientRegistration({
    client_name: clientName,
    redirect_uris: body.redirect_uris,
  });

  if (new TextEncoder().encode(clientId).byteLength > MAX_CLIENT_ID_BYTES) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Registration payload too large" },
      { status: 400, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: body.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: corsHeaders },
  );
}

export async function OPTIONS() {
  return optionsResponse();
}
