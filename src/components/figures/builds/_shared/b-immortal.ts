/**
 * The Immortal Game — Anderssen v Kieseritzky, London 1851 — from 16…Bc5 to 23.Be7#.
 * Shared by the ChessLab figure (the board) and the transition into it (the move arrows).
 *
 * Squares are algebraic ("e7"). Positions are derived by applying the moves to the position
 * after 20…Na6, and the final one is checked against the published FEN of the mate.
 */

export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export interface Ply {
  /** Move number and side, e.g. "21." or "21…". */
  number: string;
  san: string;
  from: Square;
  to: Square;
  white: boolean;
}

/** The game's closing stretch, in order. The figure steps through the last five. */
export const CLOSING_PLIES: readonly Ply[] = [
  { number: "16…", san: "Bc5", from: "f8", to: "c5", white: false },
  { number: "17.", san: "Nd5", from: "c3", to: "d5", white: true },
  { number: "17…", san: "Qxb2", from: "f6", to: "b2", white: false },
  { number: "18.", san: "Bd6", from: "f4", to: "d6", white: true },
  { number: "18…", san: "Bxg1", from: "c5", to: "g1", white: false },
  { number: "19.", san: "e5", from: "e4", to: "e5", white: true },
  { number: "19…", san: "Qxa1+", from: "b2", to: "a1", white: false },
  { number: "20.", san: "Ke2", from: "f1", to: "e2", white: true },
  { number: "20…", san: "Na6", from: "b8", to: "a6", white: false },
  { number: "21.", san: "Nxg7+", from: "f5", to: "g7", white: true },
  { number: "21…", san: "Kd8", from: "e8", to: "d8", white: false },
  { number: "22.", san: "Qf6+", from: "f3", to: "f6", white: true },
  { number: "22…", san: "Nxf6", from: "g8", to: "f6", white: false },
  { number: "23.", san: "Be7#", from: "d6", to: "e7", white: true },
];

/** Position after 20…Na6, White to move. */
export const BEFORE_FINISH_FEN = "r1b1k1nr/p2p1ppp/n2B4/1p1NPN1P/6P1/3P1Q2/P1P1K3/q5b1";
/** Position after 23.Be7# (board field of the FEN). */
export const MATE_FEN = "r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1";

/** The plies the figure steps through: 21.Nxg7+ … 23.Be7#. */
export const FINISH = CLOSING_PLIES.slice(-5);

/** File 0–7 (a–h) and rank 0–7 (1–8) of a square. */
export const coords = (square: Square): readonly [number, number] => [
  square.charCodeAt(0) - 97,
  Number(square[1]) - 1,
];

/** A piece letter (FEN case: upper is White) per square. */
export type Board = ReadonlyMap<Square, string>;

export function parseBoard(fen: string): Board {
  const board = new Map<Square, string>();
  fen
    .split(" ")[0]
    .split("/")
    .forEach((row, r) => {
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) file += Number(ch);
        else {
          board.set(`${String.fromCharCode(97 + file)}${8 - r}` as Square, ch);
          file += 1;
        }
      }
    });
  return board;
}

export function boardToFen(board: Board): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = board.get(`${String.fromCharCode(97 + file)}${rank}` as Square);
      if (piece) {
        row += (empty || "") + piece;
        empty = 0;
      } else empty += 1;
    }
    rows.push(row + (empty || ""));
  }
  return rows.join("/");
}

const apply = (board: Board, ply: Ply): Board => {
  const next = new Map(board);
  const piece = next.get(ply.from);
  next.delete(ply.from);
  if (piece) next.set(ply.to, piece);
  return next;
};

/** Positions 0 … FINISH.length: before 21.Nxg7+, then after each ply. */
export const FINISH_POSITIONS: readonly Board[] = FINISH.reduce<Board[]>(
  (positions, ply) => [...positions, apply(positions[positions.length - 1], ply)],
  [parseBoard(BEFORE_FINISH_FEN)],
);
