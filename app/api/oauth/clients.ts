/**
 * 登録済みクライアント情報のインメモリストア
 *
 * token エンドポイント等から参照するため module スコープで export する。
 * プロセス再起動で失われる（永続化不要の要件）。
 */

export interface ClientInfo {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
}

export const clients = new Map<string, ClientInfo>();
