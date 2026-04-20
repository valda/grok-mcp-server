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

// trim して返す変数のセット。
// JWT_SECRET は意図的に除外する — 署名・検証は対称なので trim する実益が無く、
// 既存発行済み JWT（特に無期限の client_id）を壊すリスクだけが残るため、
// 検出（hasWhitespace）のみ行い値は raw のまま返す。
const TRIM_ON_READ = new Set<EnvName>(["XAI_API_KEY", "AUTHORIZE_PASSWORD"]);

export interface EnvInfo {
  value: string | undefined;
  hasWhitespace: boolean;
}

export function readEnv(name: EnvName): EnvInfo {
  const raw = process.env[name];
  if (raw === undefined) return { value: undefined, hasWhitespace: false };
  const trimmed = raw.trim();
  return {
    value: TRIM_ON_READ.has(name) ? trimmed : raw,
    hasWhitespace: trimmed !== raw,
  };
}

/** 前後に空白が混入している変数名の一覧を返す */
export function listWhitespaceIssues(): EnvName[] {
  return ENV_NAMES.filter((name) => readEnv(name).hasWhitespace);
}
