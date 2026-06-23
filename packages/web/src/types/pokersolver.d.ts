declare module 'pokersolver' {
  interface HandInstance {
    name: string
    rank: number
    descr: string
  }
  export const Hand: {
    solve(cards: string[]): HandInstance
    winners(hands: HandInstance[]): HandInstance[]
  }
}
