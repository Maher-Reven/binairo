/**
 * v1 has no backend. These ports are the seams for a later version.
 * Nothing in the app calls them.
 */

export interface ScorePort {
  submit(entry: { points: number; puzzleStreak: number; dailyStreak: number }): Promise<void>;
}

export interface AccountPort {
  current(): Promise<{ id: string; name: string } | null>;
}

export interface SharePort {
  shareBoard(summary: string): Promise<void>;
}

export interface LeaderboardPort {
  top(limit: number): Promise<readonly { name: string; points: number }[]>;
}
