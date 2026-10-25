// Shapes of API responses, shared so the web app is type-checked against the API.
import type { Category, Phase } from './domain.ts';

export type Role = 'admin' | 'club';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface Me {
  id: string;
  email: string;
  role: Role;
  name: string;
  city: string | null;
}

export interface CompetitionSummary {
  id: string;
  slug: string;
  title: string;
  sponsorName: string;
  region: string;
  budgetCents: number;
  prizeShares: number[];
  submissionStartsAt: string;
  votingStartsAt: string;
  votingEndsAt: string;
  phase: Phase;
  projectCount: number;
  totalVotes: number;
}

export interface CompetitionDetail extends CompetitionSummary {
  description: string;
}

export interface PublicProject {
  id: string;
  competitionId: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  fundingGoalCents: number;
  clubName: string;
  clubCity: string | null;
  votes: number;
  rank: number;
  submittedAt: string;
  photoUrl: string | null;
}

export interface LeaderboardEntry {
  projectId: string;
  title: string;
  clubName: string;
  category: Category;
  votes: number;
  rank: number;
  payoutCents: number;
}

export interface Leaderboard {
  competitionId: string;
  phase: Phase;
  totalVotes: number;
  updatedAt: string;
  entries: LeaderboardEntry[];
}

export interface StartVoteResponse {
  status: 'confirmation_sent';
  /** Only returned when the server runs in demo mode (no SMTP configured). */
  demoConfirmUrl?: string;
}

export interface ConfirmVoteResponse {
  status: 'confirmed' | 'already_confirmed';
  projectTitle: string;
  competitionSlug: string;
}

export interface ClubProject {
  id: string;
  competitionId: string;
  competitionTitle: string;
  competitionSlug: string;
  title: string;
  category: Category;
  status: ModerationStatus;
  rejectionReason: string | null;
  votes: number;
  submittedAt: string;
  photoUrl: string | null;
  phase: Phase;
}

export interface AdminProject {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  fundingGoalCents: number;
  clubName: string;
  clubEmail: string;
  status: ModerationStatus;
  rejectionReason: string | null;
  votes: number;
  submittedAt: string;
  photoUrl: string | null;
}

export interface CompetitionStats {
  competitionId: string;
  phase: Phase;
  projects: { total: number; pending: number; approved: number; rejected: number };
  votes: {
    confirmed: number;
    pending: number;
    expired: number;
    /** Share of started votes that were confirmed via email, 0..1 */
    confirmationRate: number;
  };
  votesPerDay: { day: string; votes: number }[];
  byCategory: { category: Category; projects: number; votes: number; payoutCents: number }[];
}

export interface ApiError {
  error: string;
  message: string;
  issues?: { path: string; message: string }[];
}

export interface ProjectDetailResponse {
  project: PublicProject;
  competition: { slug: string; title: string; phase: Phase; votingEndsAt: string };
}
