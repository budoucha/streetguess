# StreetGuess

Google Street View を使ったロケーション当てゲームです。GeoGuessr ライクに、ランダムなパノラマを見て世界地図上にピンを立て、正解地点との距離を競います。

🎮 **今すぐ遊ぶ: [https://budoucha.github.io/streetguess/](https://budoucha.github.io/streetguess/)**

## 特徴

- ビルド不要の単一 HTML ファイル構成
- 自前の Google Maps API キーで動作（ブラウザの `localStorage` に保存）
- PC・スマホ両対応のレスポンシブレイアウト
- 公式画像のみ／全パノラマの切り替え
- ラウンドをまたいだ正解・推測地点の累積表示

## 必要なもの

Google Maps API キー（以下の API を有効化）

- Maps JavaScript API

キーの取得方法はアプリ内の「API キーの取得方法」を参照してください。

## 使い方

### 🌐 ブラウザで遊ぶ (インストール不要)

**[https://budoucha.github.io/streetguess/](https://budoucha.github.io/streetguess/)** にアクセスしてすぐに遊ぶことができます。

### ブラウザで直接開く (ローカル環境)

```sh
# リポジトリをクローン
git clone <repo-url>
# index.html をブラウザで開く
```

公開ページ用に URL 制限した API キーでは、ローカルで直接開いた `index.html` が動かない場合があります。ローカルでもキーの利用元を制限したい場合は、公開ページ用とは別のキーを用意し、ローカルでの開き方に合わせた許可先を設定してください。

### ローカルサーバーで開く（PWA 機能を使う場合）

```sh
python -m http.server 8080
# http://localhost:8080 をブラウザで開く
```

ローカルサーバーで使うキーに URL 制限を設定する場合は、実際に開く URL（例: `http://localhost:8080/*`）を許可先に追加してください。

初回起動時に API キー入力モーダルが表示されます。キーを入力して「保存してプレイ」を押すと開始できます。

## ゲームの流れ

1. ランダムなストリートビューが表示される
2. 右下（スマホは下部）のミニマップをタップしてピンを立てる
3. 「確定する」を押すと正解地点との距離が表示される
4. 「もう一回遊ぶ」で次のラウンドへ

## 開発

ビルドシステムなし。`index.html` を直接編集してブラウザでリロードするだけです。

バージョン管理には [Jujutsu (jj)](https://github.com/jj-vcs/jj) を使用しています。
