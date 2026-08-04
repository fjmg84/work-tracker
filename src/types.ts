// Los tipos compartidos con el proceso main viven en electron/shared/contract.ts
export * from "../electron/shared/contract";

import type {
  Project,
  PullRequest,
  Session,
} from "../electron/shared/contract";
import type { Commit } from "../electron/shared/contract";

// Tipos exclusivos del renderer
export interface ReportData {
  month: number;
  year: number;
  sessions: Session[];
  projects: Project[];
  prs: PullRequest[];
  commits?: Commit[];
}
