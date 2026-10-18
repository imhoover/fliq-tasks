# Fliq

iPhoneを優先したタスク管理Webアプリです。PCにも対応します。ホーム画面への追加に対応するPWAとして作成しており、ネイティブiOSアプリは今回の対象外です。

ローカル実装と主要操作の検証を終えています。公開レポジトリは [imhoover/fliq-tasks](https://github.com/imhoover/fliq-tasks) です。Cloudflareへの本番公開、実際のGoogleログインとWorkers AIの接続テストは未完了です。結果は [docs/VERIFICATION.md](docs/VERIFICATION.md) に記録します。

## 開いてすぐメモを残す

初期HTMLに入力欄と全画面スケルトンを置いています。アプリのJavaScriptを読み込んでいる間も入力できます。ログイン前から端末に保存し、Googleログイン後はアカウントごとにクラウドと同期します。ログイン前の保存済みメモは、アカウント画面から明示的に取り込みます。

1行目をタスク名、2行目以降を詳細として保存します。タスク名は300文字、詳細は5000文字以内です。右フリックで「未着手 → 進行中 → 完了」、左フリックで前の状態に戻ります。丸い状態ボタンでも変更でき、変更直後は取り消せます。

検索、重要指定、編集、ゴミ箱からの復元、JSON形式の書き出しに対応します。一覧は50件ずつ表示します。通信が途切れた場合も端末に保存し、クラウド同期の競合では両方の内容を保持します。

## 技術は入力の速さとCloudflareでの運用を基準に選定

以下は採用理由です。バージョンの解決結果は `package-lock.json` に記録しています。

| 技術 | 採用理由 |
| --- | --- |
| React 19.3.1 / React DOM 19.3.1 | 入力欄、一覧、シートの状態を管理するため。保存処理はReactの描画から分け、`useSyncExternalStore` で変更を受け取ります。 |
| TypeScript 6.0.3 | 画面とAPIでタスクの型を共有し、状態名や必須項目の食い違いをビルド時に確認するため。 |
| Vite 8.3.4 / Cloudflare Vite plugin 1.64.0 | 画面とWorkers APIを一緒に開発・ビルドし、Cloudflareの実行環境でローカル確認できるため。 |
| CSS / システムフォント | 半透明、背景ぼかし、縁の反射、影を細かく調整してLiquid Glassを表現するため。フォント取得による待ち時間も抑えます。 |
| Motion 14.3.0 | 指に追従するフリック、ばねによる戻り、タブ、一覧、シート、通知を統一して制御するため。移動は原則300ms以内とし、動きを減らす設定にも対応します。 |
| Lucide React 1.59.0 | 操作アイコンの形と線幅をそろえるため。必要なアイコンだけを読み込みます。 |
| Cloudflare Workers / Static Assets | Web画面とAPIを同じ配信元で運用し、認証Cookieや接続先の管理を簡潔にするため。 |
| Hono 4.13.13 | Workers上でAPI、認証、入力上限、セキュリティヘッダーを扱うため。 |
| Cloudflare D1 | 利用者、セッション、タスク、利用回数をSQLで保存するため。保存時の版番号（リビジョン）を照合し、別端末の変更を上書きする前に競合を確認します。 |
| Google OpenID Connect / jose 6.2.12 | Googleのみで本人確認し、IDトークンの署名、発行者、宛先、有効期限、nonceをサーバーで検証するため。認可コード方式にstateとPKCEを組み合わせます。 |
| Zod 4.6.7 | API入力、保存データ、AIの返答を実行時にも検査するため。ブラウザの型だけに依存しません。 |
| Cloudflare Workers AI | メモをタスク候補に分ける処理をCloudflareで実行するため。モデルは `@cf/meta/llama-3.3-70b-instruct-fp8-fast`。候補は確認後に追加し、自動確定しません。 |
| localStorage | 入力の直後に端末へ保存するため。下書きは小さな独立データとして書き込み、文字入力のたびにタスク一覧全体を書き直しません。認証トークンは保存しません。 |
| Service Worker / Web App Manifest | 一度オンラインで開いた後のオフライン起動と、ホーム画面への追加に対応するため。認証APIの応答はキャッシュしません。 |
| Vitest 5.0.5 / Miniflare 5.20261012.1-beta | 保存、フリック判定、競合、認可を自動検証するため。MiniflareはWranglerが使う実行環境に合わせています。ベータ版を含む開発依存関係はロックファイルで固定しています。 |
| ESLint 10.13.0 / typescript-eslint / React Hooks plugin | 未使用コードやHooksの誤用を検出するため。 |
| Wrangler 4.151.1 / Node.js 24 | D1の準備、本番向けのパッケージ確認、Workersへの公開を再現可能なコマンドで行うため。 |
| jsonc-parser 3.3.1 | 公開前のチェックで、設定ファイルのコメントと末尾カンマを正しく読み取るため。 |
| GitHub Actions | リポジトリへの変更時にテスト、静的検査、ビルド、依存関係の検査を実行するため。[初回の実行は成功しています](https://github.com/imhoover/fliq-tasks/actions/runs/39090526686)。 |

## ローカルで動かす

Node.js 24以上を使用します。

```sh
npm ci
npm run db:local
npm run dev
```

開発画面は `http://127.0.0.1:5178/` です。本番ビルドをローカルで確認する場合は、次を実行します。

```sh
npm run build
npm run preview
```

この確認画面は `http://127.0.0.1:5179/` です。GoogleやWorkers AIの設定がなくても、端末への保存を確認できます。未設定の機能を成功したように表示する処理は入れていません。

## 認証情報を設定してから本番を検証

設定手順は [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) に記載しています。公開用の設定は `wrangler.production.jsonc`、ローカル用は `wrangler.jsonc` です。本番の配信先とD1のIDが未設定の場合、`npm run release:check` が公開を止めます。

認証CookieはHttpOnly、HTTPSではSecure、SameSite=Laxです。書き込みは同じ配信元からのリクエストだけを受け付け、タスクはGoogleの利用者IDごとに分離します。AIは利用者ごとにUTCの1日あたり20回までに制限します。

端末のメモはブラウザの保存領域に平文で残ります。共有端末や機密情報の保管用途では、この保存方式が用途に合うか確認してください。ログイン前のデータはブラウザのデータ消去で失われます。

端末への保存は、同じアカウントにつき1つの編集タブで利用してください。複数タブから同時に変更する場合の競合処理は未対応です。

## 公式資料

- [Reactの外部ストア連携](https://react.dev/reference/react/useSyncExternalStore)
- [CloudflareのReact＋Vite構成](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [D1のプリペアドステートメント](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [Workers AIのモデル](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Motionのドラッグ操作](https://motion.dev/docs/react-drag)
- [HonoのCloudflare Workers対応](https://hono.dev/docs/getting-started/cloudflare-workers)
- [GitHub ActionsのNode.js設定](https://github.com/actions/setup-node)
