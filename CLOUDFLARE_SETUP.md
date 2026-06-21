# Cloudflare セットアップ手順（あなたがやること）

このドキュメントは、おまかせBGM のバックエンドを Cloudflare 上で動かすために
**あなた自身が Cloudflare ダッシュボード または Wrangler CLI で行う必要がある作業** をまとめたものです。

---

## 前提条件

- Cloudflare アカウントを持っている
- Node.js がインストールされている
- このリポジトリをローカルに clone している

```bash
# Wrangler をインストール（まだの場合）
npm install -g wrangler

# Cloudflare にログイン
wrangler login
```

---

## STEP 1: D1 データベースを作成する

```bash
wrangler d1 create omacase-bgm-db
```

実行後、以下のような出力が表示されます。

```
✅ Successfully created DB 'omacase-bgm-db'

[[d1_databases]]
binding = "DB"
database_name = "omacase-bgm-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← これをコピー
```

`wrangler.toml` の `database_id = "YOUR_D1_DATABASE_ID"` の部分を、上記の実際の ID に書き換えてください。

---

## STEP 2: D1 マイグレーションを実行する

```bash
# 本番 D1 にテーブルとダミーデータを適用
wrangler d1 migrations apply omacase-bgm-db

# ローカルでも確認したい場合
wrangler d1 migrations apply omacase-bgm-db --local
```

これにより `tracks` テーブルとダミーデータ8件が作成されます。

### 実際の楽曲データを追加する場合

ダミーデータを削除して実際の曲に差し替えるには、以下の SQL を実行します。

```bash
wrangler d1 execute omacase-bgm-db --command "DELETE FROM tracks;"
```

その後、次のような SQL で1曲ずつ追加してください（または SQL ファイルを `--file` オプションで流し込みます）。

```sql
INSERT INTO tracks (id, title, artist, r2_key, tags) VALUES
  (
    'xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx',  -- UUID（ランダムに生成）
    '曲のタイトル',
    'アーティスト名',
    'music/ファイル名.mp3',                   -- R2 に保存するときのキー名と一致させる
    'ALL,雑談・Chill'                         -- 該当するタグをカンマ区切りで
  );
```

利用可能なタグ:
- `ALL`（必ず含める）
- `雑談・Chill`
- `アップテンポ・Pop`
- `シネマティック・壮大`
- `ローファイ・BPM低め`

---

## STEP 3: R2 バケットを作成する

```bash
wrangler r2 bucket create stream-bgm-bucket
```

> バケット名は `wrangler.toml` の `bucket_name = "stream-bgm-bucket"` と一致させてください。

---

## STEP 4: R2 に音楽ファイルをアップロードする

各音楽ファイルのキー名は、D1 の `r2_key` カラムに登録した文字列と **完全一致** させる必要があります。

```bash
# 例: music/midnight_coffee.mp3 というキーでアップロード
wrangler r2 object put stream-bgm-bucket/music/midnight_coffee.mp3 \
  --file ./path/to/midnight_coffee.mp3 \
  --content-type "audio/mpeg"
```

### 複数ファイルをまとめてアップロードしたい場合

Wrangler CLI は現時点でフォルダごとの一括アップロードに対応していません。
その場合は **Cloudflare ダッシュボード** を使うか、以下のようなシェルスクリプトで対応してください。

```bash
# scripts/upload_music.sh の例
#!/bin/bash
BUCKET="stream-bgm-bucket"
DIR="./music"

for f in "$DIR"/*.mp3; do
  filename=$(basename "$f")
  echo "Uploading $filename ..."
  wrangler r2 object put "$BUCKET/music/$filename" \
    --file "$f" \
    --content-type "audio/mpeg"
done
```

---

## STEP 5: Workers をデプロイする

```bash
# 本番へデプロイ
wrangler deploy

# ローカルで動作確認（デプロイ前に確認したい場合）
wrangler dev
```

デプロイ後、以下のような URL が発行されます。

```
https://omacase-bgm.<あなたのサブドメイン>.workers.dev
```

---

## STEP 6: Vercel の環境変数に Workers URL を設定する

Vercel ダッシュボード または v0 の「Settings → Vars」から以下の環境変数を追加してください。

| キー | 値 |
|---|---|
| `NEXT_PUBLIC_WORKERS_URL` | `https://omacase-bgm.<サブドメイン>.workers.dev` |

設定後に Vercel を再デプロイすると、フロントエンドが Workers に接続されます。

---

## STEP 7: CORS の設定（本番環境向け）

デフォルトでは `ALLOWED_ORIGIN = "*"` になっているため、どのオリジンからでもアクセスできます。
本番環境では Vercel のデプロイ URL に絞ることを推奨します。

`wrangler.toml` を更新してください。

```toml
[vars]
ALLOWED_ORIGIN = "https://your-app.vercel.app"
```

その後 `wrangler deploy` で再デプロイしてください。

---

## 作業チェックリスト

- [ ] `wrangler d1 create` を実行し、`wrangler.toml` の `database_id` を更新した
- [ ] `wrangler d1 migrations apply` でテーブルを作成した
- [ ] `wrangler r2 bucket create` でバケットを作成した
- [ ] R2 に音楽ファイル（.mp3 等）をアップロードした
- [ ] D1 の `tracks` テーブルに実際の曲データを INSERT した（`r2_key` が R2 のキーと一致している）
- [ ] `wrangler deploy` で Workers をデプロイした
- [ ] Vercel に `NEXT_PUBLIC_WORKERS_URL` を設定し、再デプロイした
- [ ] 本番で `ALLOWED_ORIGIN` を Vercel の URL に制限した
