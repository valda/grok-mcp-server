/**
 * 環境変数アクセスの共通ユーティリティ
 *
 * Vercel ダッシュボードへの貼り付けで末尾に改行・空白が混入する事故を
 * 吸収するため、全ての環境変数読み出しで自動 trim する。
 * 元の値と trim 後の値が異なる場合は `hasWhitespace: true` を返し、
 * ダッシュボード・認可画面で警告表示できるようにする。
 */

const ENV_NAMES = ["JWT_SECRET", "XAI_API_KEY", "AUTHORIZE_PASSWORD"] as const;
export type EnvName = (typeof ENV_NAMES)[number];

export interface EnvInfo {
  value: string | undefined;
  hasWhitespace: boolean;
}

export function readEnv(name: EnvName): EnvInfo {
  const raw = process.env[name];
  if (raw === undefined) return { value: undefined, hasWhitespace: false };
  const trimmed = raw.trim();
  return { value: trimmed, hasWhitespace: trimmed !== raw };
}

/** 前後に空白が混入している変数名の一覧を返す */
export function listWhitespaceIssues(): EnvName[] {
  return ENV_NAMES.filter((name) => readEnv(name).hasWhitespace);
}
