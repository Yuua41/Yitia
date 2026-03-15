import type { TutorialStep } from './TutorialOverlay'

export const dashboardSteps: TutorialStep[] = [
  { target: '[data-tutorial="tournament-cards"]', content: '作成した大会がここに表示されます。カードをクリックすると大会の管理画面に移動します。', placement: 'bottom' },
  { target: '[data-tutorial="new-tournament"]', content: 'ここから新しい大会を作成できます。大会名・日付・参加者を入力してスタートしましょう。', placement: 'left' },
]

export const settingsSteps: TutorialStep[] = [
  { target: '[data-tutorial="basic-info"]', content: '大会名や開催日など、基本情報を設定します。', placement: 'bottom' },
  { target: '[data-tutorial="players-input"]', content: '参加者を改行区切りで入力します。あとから追加・削除も可能です。', placement: 'top' },
  { target: '[data-tutorial="start-button"]', content: '設定が完了したら、ここから大会を開始します。開始すると卓組が自動生成されます。', placement: 'top' },
]

export const scheduleSteps: TutorialStep[] = [
  { target: '[data-tutorial="round-tabs"]', content: 'ラウンドのタブを切り替えて、各ラウンドの卓組と成績を確認できます。', placement: 'bottom' },
  { target: '[data-tutorial="table-card"]', content: '各卓の点数を入力します。参加者がQRコードから入力した点数もここに反映されます。', placement: 'bottom' },
  { target: '[data-tutorial="validate-button"]', content: '点数を確認したら「確定」を押して成績を確定します。', placement: 'top' },
]

export const standingsSteps: TutorialStep[] = [
  { target: '[data-tutorial="standings-table"]', content: '全参加者の順位と合計ポイントを確認できます。ラウンドごとの成績も表示されます。', placement: 'top' },
]

export const qrSteps: TutorialStep[] = [
  { target: '[data-tutorial="qr-section"]', content: 'このQRコードを参加者に共有すると、スマホから直接点数を入力できるようになります。', placement: 'top' },
]

export const playerSteps: TutorialStep[] = [
  { target: '[data-tutorial="player-score-input"]', content: 'ここから自分の卓の点数を入力して送信できます。', placement: 'bottom' },
  { target: '[data-tutorial="player-standings"]', content: '全体の順位と各ラウンドの成績を確認できます。', placement: 'top' },
  { target: '[data-tutorial="player-chart"]', content: 'ポイント推移のグラフで、大会を通じた成績の変化を確認できます。', placement: 'top' },
]
