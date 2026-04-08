# 請求書管理 Slack ボット

請求書送付リマインダー（フェーズ1）とインターン生の給与・請求書管理（フェーズ2）を一体化した Slack ボットです。

---

## フェーズ1: 請求書リマインダー

### 機能

- 専用チャンネルのボタンからリマインダーを登録（送付先・期日）
- 期日の **3日前から当日**（および期日超過後）まで毎朝 DM で通知
- DM 内の「✅ 送付完了」ボタンを押すと通知が止まる

---

## フェーズ2: インターン生請求書管理

### 機能

- 毎月1日にインターン給与チャンネルへ「給与情報を提出する」ボタンを投稿
- Slack モーダルで稼働時間・経費・口座情報を入力・確認・送信
- 提出後に請求書 PDF を自動生成し、インターン本人と管理者の DM へ送付
- 請求書 PDF を Google Drive へ自動アップロード
- 月末3日前から未提出者に DM でリマインド
- 来月末3日前から管理者に振込サマリーを DM 送付
- 管理者が「✅ 振込完了」ボタンを押すと支払い済みとして記録
- 個人情報（住所・電話・口座番号）は AES-256-GCM で暗号化して Redis に保存

---

## 技術スタック

| レイヤー | 採用技術 |
|---|---|
| フレームワーク | Next.js 14 (App Router) |
| ホスティング | Vercel (Hobby プラン) |
| Slack SDK | @slack/web-api |
| データストア | Upstash Redis |
| スケジューラー | cron-job.org |
| PDF 生成 | @react-pdf/renderer |
| ファイル保存 | Google Drive API |

---

## ディレクトリ構成

```
app/
  api/
    cron/
      notify/route.ts             # フェーズ1: 日次リマインダー通知（cron-job.org から呼び出し）
      intern-notify/route.ts      # フェーズ2: インターン給与 月次通知（cron-job.org から呼び出し）
    setup/route.ts                # 初回セットアップ（チャンネルにボタン投稿）
    slack/interactions/route.ts   # Slack インタラクション受信（両フェーズ共通）
lib/
  redis.ts                        # Upstash Redis クライアント
  crypto.ts                       # 個人情報暗号化（AES-256-GCM）
  reminders.ts                    # フェーズ1: リマインダー CRUD
  slack.ts                        # Slack WebClient・署名検証
  intern-profiles.ts              # フェーズ2: インターンプロファイル CRUD
  intern-salaries.ts              # フェーズ2: 給与提出データ CRUD
  invoice-pdf.ts                  # フェーズ2: 請求書 PDF 生成
  google-drive.ts                 # フェーズ2: Google Drive アップロード
types/
  reminder.ts                     # フェーズ1: 型定義
  intern-salary.ts                # フェーズ2: 型定義
```

---

## セットアップ

### 1. 環境変数

`.env.local.example` をコピーして `.env.local` を作成し、各値を入力します。

```bash
# Mac / Linux
cp .env.local.example .env.local

# Windows
copy .env.local.example .env.local
```

| 変数名 | 説明 | 取得元 | フェーズ |
|---|---|---|---|
| `SLACK_BOT_TOKEN` | Bot OAuth トークン（`xoxb-...`） | Slack App 管理画面 | 共通 |
| `SLACK_SIGNING_SECRET` | 署名検証用シークレット | Slack App 管理画面 | 共通 |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis の REST URL | Upstash ダッシュボード | 共通 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis の REST トークン | Upstash ダッシュボード | 共通 |
| `CRON_SECRET` | cron・setup エンドポイントの認証トークン | 自分で生成（例: `openssl rand -hex 32`） | 共通 |
| `REMINDER_CHANNEL_ID` | リマインダー専用チャンネルの ID（`C` から始まる） | Slack チャンネル詳細 | フェーズ1 |
| `INTERN_SALARY_CHANNEL_ID` | インターン給与チャンネルの ID（`C` から始まる） | Slack チャンネル詳細 | フェーズ2 |
| `MANAGER_SLACK_ID` | 管理者の Slack ユーザー ID（`U` から始まる） | Slack プロフィール | フェーズ2 |
| `COMPANY_NAME` | 請求書に記載する会社名 | 自分で設定 | フェーズ2 |
| `ENCRYPTION_KEY` | 個人情報暗号化キー（64文字 hex、AES-256-GCM） | `openssl rand -hex 32` | フェーズ2 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google サービスアカウントのメールアドレス | Google Cloud コンソール | フェーズ2 |
| `GOOGLE_PRIVATE_KEY` | Google サービスアカウントの秘密鍵 | Google Cloud コンソール | フェーズ2 |
| `GOOGLE_DRIVE_FOLDER_ID` | 請求書 PDF の保存先フォルダ ID | Google Drive URL | フェーズ2 |

### 2. Slack App の作成

> Interactivity の Request URL は Vercel デプロイ（Step 3）後に設定します。

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From Scratch**
2. **Interactivity & Shortcuts** → Interactivity を **On** にして Request URL を設定（Step 3 のデプロイ後）:
   ```
   https://{your-app}.vercel.app/api/slack/interactions
   ```
3. **OAuth & Permissions** → Bot Token Scopes に以下を追加:
   - `chat:write`
   - `im:write`
   - `files:write`（フェーズ2: PDF 送付に必要）
   - `pins:write`
4. **Install to Workspace**（ワークスペース管理者が実施）
5. 発行された Bot Token と Signing Secret を環境変数に設定

### 3. Google Drive の設定（フェーズ2）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **Google Drive API** を有効化
3. **サービスアカウント**を作成し、JSON キーをダウンロード
4. JSON キーから `client_email` を `GOOGLE_SERVICE_ACCOUNT_EMAIL` に、`private_key` を `GOOGLE_PRIVATE_KEY` に設定
5. 請求書保存用の Google Drive フォルダを作成し、そのフォルダをサービスアカウントのメールアドレスと共有（編集権限）
6. フォルダ URL の末尾 ID を `GOOGLE_DRIVE_FOLDER_ID` に設定

### 4. Vercel へデプロイ

```bash
npm install
npx vercel --prod
```

Vercel ダッシュボードの **Settings → Deployment Protection** で **Vercel Authentication を Disabled** にします（Slack からのリクエストを通すため）。

### 5. 専用チャンネルの準備

#### フェーズ1: リマインダーチャンネル

1. Slack でチャンネルを作成（例: `#請求書リマインダー`）
2. チャンネルに Bot を招待: `/invite @Bot名`
3. チャンネル ID を `REMINDER_CHANNEL_ID` に設定

#### フェーズ2: インターン給与チャンネル

1. Slack でチャンネルを作成（例: `#インターン給与`）
2. チャンネルにインターン全員と Bot を招待
3. チャンネル ID を `INTERN_SALARY_CHANNEL_ID` に設定

### 6. 初期セットアップ（一度だけ）

フェーズ1のリマインダーチャンネルにボタンメッセージを投稿・ピン留めします。

```bash
# Windows
curl.exe -X POST https://{your-app}.vercel.app/api/setup -H "Authorization: Bearer {CRON_SECRET}"

# Mac / Linux
curl -X POST https://{your-app}.vercel.app/api/setup -H "Authorization: Bearer {CRON_SECRET}"
```

### 7. cron-job.org の設定

[cron-job.org](https://cron-job.org) で以下の2つの Cronjob を作成します。

#### フェーズ1: 請求書リマインダー通知

| 項目 | 設定値 |
|---|---|
| URL | `https://{your-app}.vercel.app/api/cron/notify` |
| メソッド | POST |
| スケジュール | 毎日 00:00 UTC（= 09:00 JST） |
| ヘッダー | `Authorization: Bearer {CRON_SECRET}` |

#### フェーズ2: インターン給与通知

| 項目 | 設定値 |
|---|---|
| URL | `https://{your-app}.vercel.app/api/cron/intern-notify` |
| メソッド | POST |
| スケジュール | 毎日 00:00 UTC（= 09:00 JST） |
| ヘッダー | `Authorization: Bearer {CRON_SECRET}` |

---

## フェーズ2 の動作フロー

```
毎月1日
  └─ インターン給与チャンネルに「給与情報を提出する」ボタンを投稿

月末3日前〜月末日
  └─ 未提出のインターン生へ DM でリマインド送信

インターン操作（月中いつでも）
  1. ボタン or DM のリンクからモーダルを開く
  2. 稼働時間・経費・口座情報を入力
  3. 確認画面で内容を確認 → 「確定して送信」
  4. 請求書 PDF が自動生成され本人と管理者の DM へ送付
  5. PDF が Google Drive へ自動アップロード

来月末3日前〜来月末日
  └─ 管理者の DM に振込サマリー（提出済み一覧・未提出者一覧）を送付
  └─ 各提出データに「✅ 振込完了」ボタン → 押すと支払い済みとして記録
```

---

## ローカル開発

```bash
npm install
npm run dev
```

Slack からローカルへリクエストを届けるには [ngrok](https://ngrok.com) を使用します。

```bash
npx ngrok http 3000
# 発行された URL を Slack App の Interactivity Request URL に一時設定
```
