---
name: commit
description: This skill should be used when the user asks to "commit", "/commit", "コミットして", "変更をコミット", or wants to create a git commit. Runs tests before committing to ensure code quality.
---

# Commit with Pre-commit Test

コミット前に必ずテストを実行し、全テストがパスした場合のみコミットを作成する。

## ワークフロー

1. `npm test` を実行してテスト結果を確認する
2. テストが失敗した場合、コミットを中止しエラー内容を報告する
3. テストが全パスした場合のみ、通常のコミットフローに進む

## テスト実行

```bash
npm test
```

テスト失敗時はコミットを作成せず、失敗したテストの内容をユーザーに報告して修正を促す。

## コミット作成

テスト成功後、以下の手順でコミットを作成する：

1. `git status` で変更ファイルを確認する
2. `git diff` でステージ済み・未ステージの差分を確認する
3. `git log --oneline -5` で直近のコミットメッセージのスタイルを確認する
4. 変更内容に基づいて Conventional Commits 形式（日本語）のコミットメッセージを作成する
5. 関連ファイルを `git add` でステージする（`git add -A` は使わない）
6. コミットを作成する（Co-Authored-By 行を含める）
