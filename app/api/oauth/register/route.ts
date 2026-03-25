/**
 * OAuth 2.1 Dynamic Client Registration (RFC 7591)
 *
 * クライアント（claude.ai 等）が自身を動的に登録するためのエンドポイント。
 * Public client として登録し client_id を発行する（client_secret は不要）。
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, optionsResponse } from "../cors";
import { clients, type ClientInfo } from "../clients";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const clientId = crypto.randomUUID();
  const clientName = body.client_name || "Unknown Client";

  const clientInfo: ClientInfo = {
    client_id: clientId,
    client_name: clientName,
    redirect_uris: body.redirect_uris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
  };

  clients.set(clientId, clientInfo);

  return NextResponse.json(clientInfo, { status: 201, headers: corsHeaders });
}

export async function OPTIONS() {
  return optionsResponse();
}
