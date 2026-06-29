import { useState, useCallback, useMemo } from 'react'
import { useI18n } from '@smart-files/shared/src/i18n'
import { Hand } from 'pokersolver'
import { PokerIcon, ArrowPathIcon } from '../components/icons'

type Suit = 's' | 'h' | 'd' | 'c'
type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2'

interface Card {
  rank: Rank
  suit: Suit
}

type Phase = 0 | 1 | 2 | 3 | 4 | 5
// 0 = 设置人数
// 1 = 选手牌
// 2 = 选翻牌(Flop)
// 3 = 选转牌(Turn)
// 4 = 选河牌(River)
// 5 = 摊牌(Showdown)

interface Odds {
  win: number
  tie: number
  lose: number
  topHands: { name: string; pct: number }[]
  topOpponentHands: { name: string; pct: number }[]
}

const ALL_RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const ALL_SUITS: Suit[] = ['s', 'h', 'd', 'c']
const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_COLORS: Record<Suit, string> = { s: 'text-zinc-900', h: 'text-red-500', d: 'text-red-500', c: 'text-zinc-900' }

const HAND_NAMES_CN: Record<string, string> = {
  'Royal Flush': '皇家同花顺',
  'Straight Flush': '同花顺',
  'Four of a Kind': '四条',
  'Full House': '葫芦',
  'Flush': '同花',
  'Straight': '顺子',
  'Three of a Kind': '三条',
  'Two Pair': '两对',
  'Pair': '一对',
  'High Card': '高牌',
}

const QUICK_HANDS: { label: string; cards: [string, string] }[] = [
  { label: 'AA', cards: ['As', 'Ac'] },
  { label: 'KK', cards: ['Ks', 'Kc'] },
  { label: 'QQ', cards: ['Qs', 'Qc'] },
  { label: 'JJ', cards: ['Js', 'Jc'] },
  { label: 'TT', cards: ['Ts', 'Tc'] },
  { label: 'AKs', cards: ['As', 'Ks'] },
  { label: 'AK', cards: ['As', 'Kc'] },
  { label: 'AQ', cards: ['As', 'Qc'] },
]

function createDeck(): string[] {
  const deck: string[] = []
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push(rank + suit)
    }
  }
  return deck
}

function cardToString(card: Card): string {
  return card.rank + card.suit
}

function parseCardCode(code: string): Card {
  return { rank: code[0] as Rank, suit: code[1] as Suit }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CHUNK_SIZE = 500

async function runSimulation(
  holeCards: Card[],
  communityCards: Card[],
  numPlayers: number,
  iterations: number,
): Promise<Odds> {
  const deck = new Set(createDeck())
  for (const c of holeCards) deck.delete(cardToString(c))
  for (const c of communityCards) deck.delete(cardToString(c))
  const remainingDeck = [...deck]
  const needed = 5 - communityCards.length

  let wins = 0
  let ties = 0
  const handCounts: Record<string, number> = {}
  const opponentCounts: Record<string, number> = {}
  let processed = 0

  while (processed < iterations) {
    const end = Math.min(processed + CHUNK_SIZE, iterations)
    for (let i = processed; i < end; i++) {
      const shuffled = shuffle(remainingDeck)

      const fullCommunity = [
        ...communityCards.map(cardToString),
        ...shuffled.slice(0, needed),
      ]

      const myHandStr = [...holeCards.map(cardToString), ...fullCommunity]

      const opponentStrs: string[][] = []
      let idx = needed
      for (let j = 0; j < numPlayers - 1; j++) {
        const oppCards = shuffled.slice(idx, idx + 2)
        const oppFull = [...oppCards, ...fullCommunity]
        opponentStrs.push(oppFull)

        const oppHand = Hand.solve(oppFull)
        opponentCounts[oppHand.name] = (opponentCounts[oppHand.name] || 0) + 1

        idx += 2
        if (idx + 5 > shuffled.length) break
      }

      const myHand = Hand.solve(myHandStr)
      const allHands = [myHand, ...opponentStrs.map((h) => Hand.solve(h))]
      const winners = Hand.winners(allHands)

      if (winners.some((w: any) => w === myHand)) {
        handCounts[myHand.name] = (handCounts[myHand.name] || 0) + 1
        if (winners.length > 1) ties++
        else wins++
      }
    }
    processed = end
    if (processed < iterations) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  const losses = iterations - wins - ties
  const totalWinTie = wins + ties
  const topHands = Object.entries(handCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({
      name,
      pct: Math.round((count / totalWinTie) * 1000) / 10,
    }))

  const topOpponentHands = Object.entries(opponentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({
      name,
      pct: Math.round((count / ((numPlayers - 1) * iterations)) * 1000) / 10,
    }))

  return {
    win: Math.round((wins / iterations) * 1000) / 10,
    tie: Math.round((ties / iterations) * 1000) / 10,
    lose: Math.round((losses / iterations) * 1000) / 10,
    topHands,
    topOpponentHands,
  }
}

function getPhaseLabel(phase: Phase, t: any): string {
  switch (phase) {
    case 0: return t.pokerWaiting
    case 1: return t.pokerPreFlop
    case 2: return t.pokerFlop
    case 3: return t.pokerTurn
    case 4: return t.pokerRiver
    case 5: return t.pokerShowdown
  }
}

function getSelectionPrompt(phase: Phase, t: any): string {
  switch (phase) {
    case 0: return t.pokerWaiting
    case 1: return t.pokerSelectHand
    case 2: return t.pokerSelectFlop
    case 3: return t.pokerSelectTurn
    case 4: return t.pokerSelectRiver
    case 5: return t.pokerShowdown
  }
}

export function PokerPage() {
  const { t } = useI18n()

  const [phase, setPhase] = useState<Phase>(0)
  const [numPlayers, setNumPlayers] = useState(6)
  const [holeCards, setHoleCards] = useState<Card[]>([])
  const [communityCards, setCommunityCards] = useState<Card[]>([])
  const [odds, setOdds] = useState<Odds | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [iterations] = useState(10000)

  const selectedCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const c of holeCards) codes.add(cardToString(c))
    for (const c of communityCards) codes.add(cardToString(c))
    return codes
  }, [holeCards, communityCards])

  const handleCardClick = useCallback(
    (code: string) => {
      if (simulating || phase === 0) return

      if (phase === 1) {
        // 选手牌
        const idx = holeCards.findIndex((c) => cardToString(c) === code)
        if (idx >= 0) {
          setHoleCards((prev) => prev.filter((_, i) => i !== idx))
          return
        }
        if (holeCards.length >= 2) return
        const card = parseCardCode(code)
        const newCards = [...holeCards, card]
        setHoleCards(newCards)
        if (newCards.length === 2) {
          setSimulating(true)
          ;(async () => {
            const result = await runSimulation(newCards, communityCards, numPlayers, iterations)
            setOdds(result)
            setSimulating(false)
            setPhase(2)
          })()
        }
      } else if (phase === 2) {
        const idx = communityCards.findIndex((c) => cardToString(c) === code)
        if (idx >= 0) {
          setCommunityCards((prev) => prev.filter((_, i) => i !== idx))
          return
        }
        if (communityCards.length >= 3) return
        const card = parseCardCode(code)
        const newCards = [...communityCards, card]
        setCommunityCards(newCards)
        if (newCards.length === 3) {
          setSimulating(true)
          ;(async () => {
            const result = await runSimulation(holeCards, newCards, numPlayers, iterations)
            setOdds(result)
            setSimulating(false)
            setPhase(3)
          })()
        }
      } else if (phase === 3) {
        const idx = communityCards.findIndex((c) => cardToString(c) === code)
        if (idx >= 0) {
          setCommunityCards((prev) => prev.filter((_, i) => i !== idx))
          return
        }
        if (communityCards.length >= 4) return
        const card = parseCardCode(code)
        const newCards = [...communityCards, card]
        setCommunityCards(newCards)
        if (newCards.length === 4) {
          setSimulating(true)
          ;(async () => {
            const result = await runSimulation(holeCards, newCards, numPlayers, iterations)
            setOdds(result)
            setSimulating(false)
            setPhase(4)
          })()
        }
      } else if (phase === 4) {
        const idx = communityCards.findIndex((c) => cardToString(c) === code)
        if (idx >= 0) {
          setCommunityCards((prev) => prev.filter((_, i) => i !== idx))
          return
        }
        if (communityCards.length >= 5) return
        const card = parseCardCode(code)
        const newCards = [...communityCards, card]
        setCommunityCards(newCards)
        if (newCards.length === 5) {
          setSimulating(true)
          ;(async () => {
            const result = await runSimulation(holeCards, newCards, numPlayers, iterations)
            setOdds(result)
            setSimulating(false)
            setPhase(5)
          })()
        }
      } else if (phase === 5) {
        // 摊牌后点击任意已选牌可删除，退回对应阶段重新选
        const holeIdx = holeCards.findIndex((c) => cardToString(c) === code)
        if (holeIdx >= 0) {
          setHoleCards((prev) => prev.filter((_, i) => i !== holeIdx))
          setOdds(null)
          setPhase(1)
          return
        }
        const commIdx = communityCards.findIndex((c) => cardToString(c) === code)
        if (commIdx >= 0) {
          const newCommunityCards = communityCards.filter((_, i) => i !== commIdx)
          setCommunityCards(newCommunityCards)
          setOdds(null)
          // 根据剩余公共牌数量退回对应阶段
          if (newCommunityCards.length < 3) setPhase(2)
          else if (newCommunityCards.length === 3) setPhase(3)
          else if (newCommunityCards.length === 4) setPhase(4)
          return
        }
      }
    },
    [phase, holeCards, communityCards, numPlayers, iterations, simulating],
  )

  const handleQuickHand = useCallback(
    (codes: [string, string]) => {
      if (simulating || phase !== 1) return
      const cards = codes.map(parseCardCode)
      setHoleCards(cards)
      setSimulating(true)
      ;(async () => {
        const result = await runSimulation(cards, communityCards, numPlayers, iterations)
        setOdds(result)
        setSimulating(false)
        setPhase(2)
      })()
    },
    [phase, communityCards, numPlayers, iterations, simulating],
  )

  const handleNewGame = useCallback(() => {
    setPhase(0)
    setHoleCards([])
    setCommunityCards([])
    setOdds(null)
    setSimulating(false)
  }, [])

  const handleStartGame = useCallback(() => {
    setPhase(1)
  }, [])

  const isCardSelected = (code: string) => selectedCodes.has(code)

  const canSelectCard = (code: string) => {
    if (phase === 0 || simulating) return false
    if (isCardSelected(code)) return true // can deselect (any phase except 0)
    if (phase === 1) return holeCards.length < 2
    if (phase === 2) return communityCards.length < 3
    if (phase === 3) return communityCards.length < 4
    if (phase === 4) return communityCards.length < 5
    return false
  }

  const progressBar = (value: number, color: string) => (
    <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(value, 0.5)}%` }}
      />
    </div>
  )

  const renderCard = (code: string, size: 'sm' | 'md' | 'lg' = 'lg', onClick?: () => void) => {
    const card = parseCardCode(code)
    const color = SUIT_COLORS[card.suit]
    const symbol = SUIT_SYMBOLS[card.suit]
    const sizeClasses = size === 'sm' ? 'w-8 h-12 text-xs' : size === 'md' ? 'w-14 h-20 text-sm' : 'w-[60px] h-[86px] text-base'
    const classes = `${sizeClasses} rounded-xl border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 flex flex-col items-center justify-center shadow-sm ${color} font-bold select-none`

    if (onClick) {
      return (
        <button
          onClick={onClick}
          className={`${classes} hover:ring-2 hover:ring-red-400 hover:border-red-300 dark:hover:border-red-500 cursor-pointer active:scale-95 transition-all`}
        >
          <span className={size === 'lg' ? 'text-lg' : size === 'md' ? 'text-base' : 'text-xs'}>{card.rank}</span>
          <span className={`${size === 'lg' ? 'text-xl' : 'text-lg'} leading-none mt-0.5`}>{symbol}</span>
        </button>
      )
    }

    return (
      <div className={classes}>
        <span className={size === 'lg' ? 'text-lg' : size === 'md' ? 'text-base' : 'text-xs'}>{card.rank}</span>
        <span className={`${size === 'lg' ? 'text-xl' : 'text-lg'} leading-none mt-0.5`}>{symbol}</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <PokerIcon className="w-7 h-7 text-blue-500" />
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{t.pokerTitle}</h1>
      </div>

      {/* Players Setup */}
      <div className="mb-6 p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.pokerPlayers}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNumPlayers((p) => Math.max(2, p - 1))}
              disabled={phase > 0}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-lg flex items-center justify-center disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-600"
            >
              −
            </button>
            <span className="text-2xl font-bold text-blue-500 min-w-[3rem] text-center">{numPlayers}</span>
            <button
              onClick={() => setNumPlayers((p) => Math.min(9, p + 1))}
              disabled={phase > 0}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-lg flex items-center justify-center disabled:opacity-40 hover:bg-zinc-200 dark:hover:bg-zinc-600"
            >
              +
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          {'你 + ' + (numPlayers - 1) + ' ' + (numPlayers - 1 > 1 ? 'opponents' : 'opponent')}
        </p>
      </div>

      {/* Card Selector - Horizontal Scroll */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">Card Selector — scroll horizontally</span>
        </div>
        <div className="space-y-2">
          {ALL_SUITS.map((suit) => {
            const suitSymbol = SUIT_SYMBOLS[suit]
            const suitColor = SUIT_COLORS[suit]
            return (
              <div key={suit} className="flex items-center gap-1">
                <span className={`text-lg font-bold ${suitColor} w-5 text-center shrink-0`}>
                  {suitSymbol}
                </span>
                <div className="overflow-x-auto pb-1 scrollbar-thin flex-1">
                  <div className="flex gap-1.5 min-w-max">
                    {ALL_RANKS.map((rank) => {
                      const code = rank + suit
                      const selected = isCardSelected(code)
                      const canSelect = canSelectCard(code)
                      const color = SUIT_COLORS[suit]
                      const symbol = SUIT_SYMBOLS[suit]

                      return (
                        <button
                          key={code}
                          onClick={() => canSelect && handleCardClick(code)}
                          disabled={!canSelect}
                          className={`shrink-0 w-[52px] h-[74px] rounded-xl border-2 text-xs font-bold flex flex-col items-center justify-center leading-tight transition-all ${
                            selected
                              ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 scale-105 shadow-md'
                              : canSelect
                                ? 'border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:border-blue-400 hover:shadow-md hover:-translate-y-1 cursor-pointer active:scale-95'
                                : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-300 dark:text-zinc-700 cursor-not-allowed opacity-35'
                          } ${color}`}
                        >
                          <span className="text-sm leading-none">{rank}</span>
                          <span className="text-lg leading-none mt-0.5">{symbol}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Your Hand */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t.pokerYourHand}</h2>
        </div>
        <div className="flex items-start gap-4">
          <div className="flex gap-3 min-h-[5.5rem] items-center flex-1">
            {holeCards.length === 0 ? (
              <div className="flex gap-3">
                <div className="w-[60px] h-[86px] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-300 dark:text-zinc-600 text-lg">?</div>
                <div className="w-[60px] h-[86px] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-300 dark:text-zinc-600 text-lg">?</div>
              </div>
            ) : (
              holeCards.map((c, i) => (
                <div key={i}>{renderCard(cardToString(c), 'md', (phase === 1 || phase === 5) ? () => handleCardClick(cardToString(c)) : undefined)}</div>
              ))
            )}

            {/* Quick hand shortcuts */}
            {phase === 1 && holeCards.length === 0 && (
              <div className="ml-4 flex flex-wrap gap-1.5">
                {QUICK_HANDS.map((qh) => (
                  <button
                    key={qh.label}
                    onClick={() => handleQuickHand(qh.cards)}
                    className="px-2 py-1 text-xs font-mono font-bold rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {qh.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center shrink-0 pt-1">
            {phase === 0 && (
              <button
                onClick={handleStartGame}
                className="px-5 py-3 rounded-xl bg-blue-500 text-white font-semibold shadow-lg hover:bg-blue-600 active:scale-95 transition-all whitespace-nowrap"
              >
                {t.pokerYourHand}
              </button>
            )}
            {phase === 5 && (
              <button
                onClick={handleNewGame}
                className="px-5 py-3 rounded-xl bg-red-500 text-white font-semibold shadow-lg hover:bg-red-600 active:scale-95 transition-all whitespace-nowrap"
              >
                {t.pokerEndGame}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Community Cards */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t.pokerCommunity}</h2>
        <div className="flex gap-3 min-h-[5.5rem] items-center">
          {[0, 1, 2, 3, 4].map((idx) => {
            if (idx < communityCards.length) {
              const canClick = phase >= 2 && phase <= 5
              return (
                <div key={idx}>
                  {renderCard(cardToString(communityCards[idx]), 'md', canClick ? () => handleCardClick(cardToString(communityCards[idx])) : undefined)}
                </div>
              )
            }
            const showActive = (phase === 2 && idx < 3) || (phase === 3 && idx === 3) || (phase === 4 && idx === 4)
            return (
              <div
                key={idx}
                className={`w-[60px] h-[86px] rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-colors ${
                  showActive
                    ? 'border-blue-400 dark:border-blue-500 text-blue-400 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-300 dark:text-zinc-600'
                }`}
              >
                {idx + 1}
              </div>
            )
          })}
        </div>
      </div>

      {/* Current Stage / Odds Panel */}
      <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            {phase === 0 ? '▶ ' : ''}{getPhaseLabel(phase, t)}
          </span>
        </div>

        {phase === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.pokerSelectHand}</p>
        )}

        {simulating && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            Simulating {iterations.toLocaleString()} hands...
          </div>
        )}

        {odds && !simulating && (
          <div className="space-y-2 mt-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-green-600 dark:text-green-400 w-8">{t.pokerWinRate}</span>
              <div className="flex-1">{progressBar(odds.win, 'bg-green-500')}</div>
              <span className="text-sm font-bold text-green-600 dark:text-green-400 w-14 text-right">{odds.win}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 w-8">{t.pokerTieRate}</span>
              <div className="flex-1">{progressBar(odds.tie, 'bg-yellow-500')}</div>
              <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400 w-14 text-right">{odds.tie}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-red-600 dark:text-red-400 w-8">{t.pokerLoseRate}</span>
              <div className="flex-1">{progressBar(odds.lose, 'bg-red-500')}</div>
              <span className="text-sm font-bold text-red-600 dark:text-red-400 w-14 text-right">{odds.lose}%</span>
            </div>
          </div>
        )}

        {odds && !simulating && odds.topHands.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">赢牌时最可能牌型：</div>
            <div className="flex gap-2">
              {odds.topHands.map((h) => (
                <div
                  key={h.name}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-white/60 dark:bg-zinc-800/60 text-center"
                >
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{HAND_NAMES_CN[h.name] || h.name}</div>
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{h.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {odds && !simulating && odds.topOpponentHands.length > 0 && (
          <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">对手最可能牌型：</div>
            <div className="flex gap-2">
              {odds.topOpponentHands.map((h) => (
                <div
                  key={h.name}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-white/60 dark:bg-zinc-800/60 text-center"
                >
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{HAND_NAMES_CN[h.name] || h.name}</div>
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{h.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!odds && !simulating && phase > 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">{getSelectionPrompt(phase, t)}</p>
        )}
      </div>

    </div>
  )
}
