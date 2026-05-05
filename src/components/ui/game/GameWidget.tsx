'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { Gamepad2 } from 'lucide-react'

type Cell = 'X' | 'O' | null

const GRID_SIZE = 3
const OUTER_SIZE = 4
const TOTAL_SIZE = GRID_SIZE + OUTER_SIZE * 2
const CENTER_OFFSET = OUTER_SIZE

function posToIndex(row: number, col: number): number {
  return row * TOTAL_SIZE + col
}

function isCenterGrid(row: number, col: number): boolean {
  return (
    row >= CENTER_OFFSET &&
    row < CENTER_OFFSET + GRID_SIZE &&
    col >= CENTER_OFFSET &&
    col < CENTER_OFFSET + GRID_SIZE
  )
}

function checkWinner(board: Cell[]): 'X' | 'O' | 'draw' | null {
  for (let r = 0; r < TOTAL_SIZE; r++) {
    for (let c = 0; c <= TOTAL_SIZE - 3; c++) {
      const a = posToIndex(r, c),
        b = posToIndex(r, c + 1),
        cc = posToIndex(r, c + 2)
      if (board[a] && board[a] === board[b] && board[a] === board[cc]) return board[a]
    }
  }
  for (let c = 0; c < TOTAL_SIZE; c++) {
    for (let r = 0; r <= TOTAL_SIZE - 3; r++) {
      const a = posToIndex(r, c),
        b = posToIndex(r + 1, c),
        cc = posToIndex(r + 2, c)
      if (board[a] && board[a] === board[b] && board[a] === board[cc]) return board[a]
    }
  }
  for (let r = 0; r <= TOTAL_SIZE - 3; r++) {
    for (let c = 0; c <= TOTAL_SIZE - 3; c++) {
      const a = posToIndex(r, c),
        b = posToIndex(r + 1, c + 1),
        cc = posToIndex(r + 2, c + 2)
      if (board[a] && board[a] === board[b] && board[a] === board[cc]) return board[a]
    }
  }
  for (let r = 0; r <= TOTAL_SIZE - 3; r++) {
    for (let c = 2; c < TOTAL_SIZE; c++) {
      const a = posToIndex(r, c),
        b = posToIndex(r + 1, c - 1),
        cc = posToIndex(r + 2, c - 2)
      if (board[a] && board[a] === board[b] && board[a] === board[cc]) return board[a]
    }
  }

  const centerCells: Cell[] = []
  for (let r = CENTER_OFFSET; r < CENTER_OFFSET + GRID_SIZE; r++) {
    for (let c = CENTER_OFFSET; c < CENTER_OFFSET + GRID_SIZE; c++) {
      centerCells.push(board[posToIndex(r, c)])
    }
  }
  if (centerCells.every((c) => c !== null)) return 'draw'
  return null
}

function getAIMove(board: Cell[]): number {
  const empty: number[] = []
  for (let r = CENTER_OFFSET; r < CENTER_OFFSET + GRID_SIZE; r++) {
    for (let c = CENTER_OFFSET; c < CENTER_OFFSET + GRID_SIZE; c++) {
      const idx = posToIndex(r, c)
      if (board[idx] === null) empty.push(idx)
    }
  }
  if (empty.length === 0) return -1
  return empty[Math.floor(Math.random() * empty.length)]
}

const STORAGE_KEY = 'tictactoe_v14'

function loadStats() {
  if (typeof window === 'undefined') return { games: 0, wins: 0, losses: 0, draws: 0 }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { games: 0, wins: 0, losses: 0, draws: 0 }
}

function saveStats(stats: ReturnType<typeof loadStats>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {}
}

export function GameWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [board, setBoard] = useState<Cell[]>(Array(TOTAL_SIZE * TOTAL_SIZE).fill(null))
  const [isUserTurn, setIsUserTurn] = useState(true)
  const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null)
  const [stats, setStats] = useState(loadStats)
  const outerAreaRef = useRef<HTMLDivElement>(null)

  const resetGame = useCallback(() => {
    setBoard(Array(TOTAL_SIZE * TOTAL_SIZE).fill(null))
    setIsUserTurn(true)
    setWinner(null)
  }, [])

  useEffect(() => {
    if (isOpen) resetGame()
  }, [isOpen, resetGame])

  useEffect(() => {
    if (!isUserTurn && !winner) {
      const timer = setTimeout(() => {
        const aiMove = getAIMove(board)
        if (aiMove !== -1) {
          const newBoard = [...board]
          newBoard[aiMove] = 'O'
          setBoard(newBoard)
          const result = checkWinner(newBoard)
          if (result) {
            setWinner(result)
            const ns = { ...stats, games: stats.games + 1 }
            if (result === 'X') ns.wins++
            else if (result === 'O') ns.losses++
            else ns.draws++
            setStats(ns)
            saveStats(ns)
          } else {
            setIsUserTurn(true)
          }
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isUserTurn, board, winner, stats])

  const handleClick = useCallback(
    (row: number, col: number) => {
      if (!isUserTurn || winner) return
      const idx = posToIndex(row, col)
      const newBoard = [...board]
      newBoard[idx] = 'X'
      setBoard(newBoard)
      const result = checkWinner(newBoard)
      if (result) {
        setWinner(result)
        const ns = { ...stats, games: stats.games + 1 }
        if (result === 'X') ns.wins++
        else if (result === 'O') ns.losses++
        else ns.draws++
        setStats(ns)
        saveStats(ns)
      } else {
        setIsUserTurn(false)
      }
    },
    [board, isUserTurn, winner, stats],
  )

  const handleAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if (!outerAreaRef.current) return
      const rect = outerAreaRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const cellSize = rect.width / TOTAL_SIZE
      const col = Math.floor(x / cellSize)
      const row = Math.floor(y / cellSize)

      e.stopPropagation()
      if (!isUserTurn || winner) return

      if (row >= 0 && row < TOTAL_SIZE && col >= 0 && col < TOTAL_SIZE) {
        handleClick(row, col)
      }
    },
    [handleClick, isUserTurn, winner],
  )

  const outerPieces: { row: number; col: number; cell: Cell }[] = []
  for (let r = 0; r < TOTAL_SIZE; r++) {
    for (let c = 0; c < TOTAL_SIZE; c++) {
      if (!isCenterGrid(r, c)) {
        const cell = board[posToIndex(r, c)]
        if (cell) outerPieces.push({ row: r, col: c, cell })
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-1.5 sm:gap-2 shadow-sm border-primary/20 text-primary hover:bg-primary/5 h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
        >
          <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>小游戏</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">小游戏</DialogTitle>
        <Card className="border-2 shadow-xl flex flex-col w-full bg-card overflow-hidden">
          <div className="p-6 flex flex-col items-center justify-center">
            <div
              ref={outerAreaRef}
              className="relative w-full max-w-[280px] aspect-square"
              onClick={handleAreaClick}
            >
              <div className="absolute inset-0 grid grid-cols-3 gap-2">
                {Array.from({ length: GRID_SIZE }).map((_, row) =>
                  Array.from({ length: GRID_SIZE }).map((_, col) => {
                    const actualRow = row + CENTER_OFFSET
                    const actualCol = col + CENTER_OFFSET
                    const idx = posToIndex(actualRow, actualCol)
                    const cell = board[idx]

                    return (
                      <button
                        key={`${row}-${col}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleClick(actualRow, actualCol)
                        }}
                        disabled={!isUserTurn || winner !== null}
                        className={`
                          aspect-square w-full rounded-lg border-2 text-4xl font-bold break-all
                          transition-all duration-150
                          ${
                            cell === null
                              ? 'border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer'
                              : 'border-border bg-muted/50'
                          }
                          ${cell === 'X' ? 'text-blue-500' : 'text-red-500'}
                          ${!isUserTurn || winner ? 'cursor-not-allowed opacity-80' : ''}
                        `}
                      >
                        {cell}
                      </button>
                    )
                  }),
                )}
              </div>

              {outerPieces.map(({ row, col, cell }) => {
                const left = `${(col / TOTAL_SIZE) * 100}%`
                const top = `${(row / TOTAL_SIZE) * 100}%`
                const size = `${(1 / TOTAL_SIZE) * 100}%`

                return (
                  <div
                    key={`outer-${row}-${col}`}
                    className="absolute z-10 rounded-lg flex items-center justify-center text-xl font-bold bg-white/80 dark:bg-black/80 backdrop-blur-sm shadow-sm border border-border/50 pointer-events-none"
                    style={{ left, top, width: size, height: size }}
                  >
                    <span className={cell === 'X' ? 'text-blue-500' : 'text-red-500'}>{cell}</span>
                  </div>
                )
              })}
            </div>

            {winner && (
              <div className="mt-4 text-center">
                <p className="text-xl font-bold">
                  {winner === 'X' && '你赢了！'}
                  {winner === 'O' && '你输了！'}
                  {winner === 'draw' && '平局！'}
                </p>
              </div>
            )}
          </div>

          <div className="p-4 bg-muted/30 border-t flex justify-center gap-3 shrink-0">
            <Button variant="outline" size="sm" onClick={resetGame}>
              重新开始
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
              关闭
            </Button>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
