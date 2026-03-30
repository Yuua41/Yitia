import type { TutorialStep } from './TutorialOverlay'

/* ── SVG Icons ── */
const IconScore = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6"/><path d="M9 13h4"/><path d="M9 17h2"/>
  </svg>
)

const IconAdjust = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18"/><path d="M8 8l4-4 4 4"/><path d="M8 16l4 4 4-4"/>
  </svg>
)

const IconStandings = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>
  </svg>
)

const IconChart = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

const IconCards = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
  </svg>
)

const IconPlus = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
  </svg>
)

const IconSettings = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

const IconUsers = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const IconQR = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><path d="M21 14h-3v3"/><path d="M21 21h-3v-3"/>
  </svg>
)

const IconRound = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
  </svg>
)

const IconCheck = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)

const IconToggle = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/>
  </svg>
)

/* ── Dashboard ── */
export const dashboardSteps: TutorialStep[] = [
  { target: '', title: '大会一覧', icon: IconCards, content: '作成した大会がカード形式で表示されます。カードをクリックすると大会の管理画面に移動します。' },
  { target: '', title: '新しい大会を作成', icon: IconPlus, content: '「+」ボタンまたはカレンダーから新しい大会を作成できます。大会名・日付・参加者を入力してスタートしましょう。' },
]

/* ── Settings (ongoing) ── */
export const settingsOngoingSteps: TutorialStep[] = [
  { target: '', title: 'プレイヤー入力', icon: IconToggle, content: 'プレイヤーが自分でスコアを入力できるかどうかを切り替えられます。' },
]

/* ── Settings ── */
export const settingsSteps: TutorialStep[] = [
  { target: '', title: '基本情報', icon: IconSettings, content: '大会名や開催日など，基本情報を設定します。' },
  { target: '', title: '参加者', icon: IconUsers, content: '参加者の一覧です。クリックすると参加者管理ページに移動します。' },
  { target: '', title: 'ルール設定', icon: IconScore, content: '持ち点・返し・ウマ・同点処理などのルールを設定できます。' },
  { target: '', title: '詳細設定', icon: IconToggle, content: '「詳細設定」に切り替えると，細かくルールが設定できます。' },
  { target: '', title: '大会を開始', icon: IconCheck, content: '設定が完了したら，ここから大会を開始します。開始すると卓組が自動生成されます。' },
]

/* ── Schedule ── */
export const scheduleSteps: TutorialStep[] = [
  { target: '', title: 'ラウンド切り替え', icon: IconRound, content: 'ラウンドのタブを切り替えて，各ラウンドの卓組と成績を確認できます。' },
  { target: '', title: '点数入力', icon: IconScore, content: '各卓の点数を入力します。参加者がQRコードから入力した点数もここに反映されます。プレイヤーをドラッグ＆ドロップで入れ替えることもできます。' },
  { target: '', title: '成績を確定', icon: IconCheck, content: '点数を確認したら「確定」を押して成績を確定します。' },
]

/* ── Standings ── */
export const standingsSteps: TutorialStep[] = [
  { target: '', title: '総合成績', icon: IconStandings, content: '全参加者の順位と合計ポイントを確認できます。ラウンドごとの成績も表示されます。' },
  { target: '', title: 'ポイント調整', icon: IconAdjust, content: '「ポイント調整」でチョンボ等の調整ができます。セルをクリックして値を入力してください。' },
]

/* ── QR ── */
export const qrSteps: TutorialStep[] = [
  { target: '', title: 'QRコード共有', icon: IconQR, content: 'このQRコードを参加者に共有すると，スマホから直接点数を入力できるようになります。' },
]

/* ── Players ── */
export const playersSteps: TutorialStep[] = [
  { target: '', title: '参加者管理', icon: IconUsers, content: '参加者の一覧です。名前の編集，QRコード表示ができます。下書き中は追加・削除や一括編集も可能です。' },
]

/* ── Player (individual) ── */
export const playerSteps: TutorialStep[] = [
  { target: '', title: 'スコア入力・卓確認', icon: IconScore, content: 'ここから自分の卓の点数を入力して送信できます。席が固定でなければ，卓内でプレイヤーを入れ替えできます。' },
  { target: '', title: '得点調整', icon: IconAdjust, content: '「得点調整」でチョンボ等のポイント調整ができます。管理者が設定した調整値が反映されます。' },
  { target: '', title: '全体成績', icon: IconStandings, content: '全体の順位と各ラウンドの成績を確認できます。自分の順位がリアルタイムで更新されます。' },
  { target: '', title: 'ポイント推移', icon: IconChart, content: 'ポイント推移のグラフで，大会を通じた成績の変化を確認できます。' },
]
