import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { initializeSchema } from "../db/migrations";

const TEST_USER_DATA = "/tmp/work-tracker-test-userdata";

const mocks = vi.hoisted(() => ({
  paginate: vi.fn(),
  searchIssuesAndPullRequests: vi.fn(),
  pullsList: vi.fn(),
  pullsListCommits: vi.fn(),
  pullsListFiles: vi.fn(),
  reposListCommits: vi.fn(),
  reposGetCommit: vi.fn(),
  reposGet: vi.fn(),
  reposListBranches: vi.fn(),
  reposCompareCommits: vi.fn(),
  getAuthenticated: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => TEST_USER_DATA },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s, "utf8"),
    decryptString: (b: Buffer) => b.toString("utf8"),
  },
}));

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    rest = {
      search: { issuesAndPullRequests: mocks.searchIssuesAndPullRequests },
      pulls: {
        list: mocks.pullsList,
        listCommits: mocks.pullsListCommits,
        listFiles: mocks.pullsListFiles,
      },
      repos: {
        listCommits: mocks.reposListCommits,
        getCommit: mocks.reposGetCommit,
        get: mocks.reposGet,
        listBranches: mocks.reposListBranches,
        compareCommits: mocks.reposCompareCommits,
      },
    };
    users = { getAuthenticated: mocks.getAuthenticated };
    paginate = mocks.paginate;
  },
}));

// vi.mock se eleva (hoisting), así que el import estático ya recibe los mocks
import { GitHubService, validateGitHubToken } from "./github";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initializeSchema(db);
  db.prepare("INSERT INTO accounts (label, username) VALUES (?, ?)").run(
    "Trabajo",
    "octocat",
  );
  return db;
}

function seedToken(accountId: number): void {
  fs.mkdirSync(TEST_USER_DATA, { recursive: true });
  fs.writeFileSync(
    path.join(TEST_USER_DATA, `token_${accountId}.bin`),
    "test-token",
  );
}

const SINCE = new Date("2026-07-01T00:00:00.000Z").getTime();
const UNTIL = new Date("2026-07-31T23:59:59.999Z").getTime();

function searchItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    number: 42,
    title: "Add feature",
    state: "open",
    created_at: "2026-07-10T10:00:00Z",
    updated_at: "2026-07-11T10:00:00Z",
    html_url: "https://github.com/acme/widgets/pull/42",
    pull_request: { merged_at: null },
    ...overrides,
  };
}

describe("GitHubService.getUserActivity", () => {
  let db: Database.Database;
  let service: InstanceType<typeof GitHubService>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createDb();
    seedToken(1);
    service = new GitHubService(db);
    mocks.paginate.mockImplementation(async (fn: unknown) => {
      if (fn === mocks.searchIssuesAndPullRequests) return [searchItem()];
      if (fn === mocks.pullsListCommits)
        return [
          {
            sha: "abc123",
            commit: {
              message: "feat: something\n\ndetails",
              committer: { date: "2026-07-10T11:00:00Z" },
            },
            author: { login: "octocat" },
            html_url: "https://github.com/acme/widgets/commit/abc123",
          },
          {
            sha: "def456",
            commit: {
              message: "chore: other",
              committer: { date: "2026-07-10T12:00:00Z" },
            },
            author: { login: "someone-else" },
            html_url: "https://github.com/acme/widgets/commit/def456",
          },
        ];
      return [];
    });
  });

  it("usa la Search API con autor y rango de fechas, y filtra commits por autor", async () => {
    const result = await service.getUserActivity({
      accountId: 1,
      repo: "acme/widgets",
      since: SINCE,
      until: UNTIL,
    });

    // La query va a la Search API (paginate la recibe como primer argumento)
    expect(mocks.paginate).toHaveBeenCalledWith(
      mocks.searchIssuesAndPullRequests,
      expect.objectContaining({ per_page: 100 }),
    );
    const { q } = mocks.paginate.mock.calls[0][1] as { q: string };
    expect(q).toContain("repo:acme/widgets");
    expect(q).toContain("is:pr");
    expect(q).toContain("author:octocat");
    expect(q).toContain(
      "created:2026-07-01T00:00:00.000Z..2026-07-31T23:59:59.999Z",
    );

    expect(result.prs).toHaveLength(1);
    const pr = result.prs[0] as any;
    expect(pr.number).toBe(42);
    expect(pr.account_username).toBe("octocat");
    // Solo el commit del propio usuario
    expect(pr.commits).toHaveLength(1);
    expect(pr.commits[0].sha).toBe("abc123");
    expect(pr.commits[0].message).toBe("feat: something");
  });

  it("hace fallback a pulls.list cuando la Search API falla con 403", async () => {
    mocks.paginate.mockImplementation(async (fn: unknown) => {
      if (fn === mocks.searchIssuesAndPullRequests) {
        const err = new Error("rate limit") as any;
        err.status = 403;
        throw err;
      }
      if (fn === mocks.pullsList)
        return [
          {
            id: 200,
            number: 7,
            title: "Legacy PR",
            state: "closed",
            created_at: "2026-07-05T09:00:00Z",
            updated_at: "2026-07-06T09:00:00Z",
            merged_at: "2026-07-06T10:00:00Z",
            html_url: "https://github.com/acme/widgets/pull/7",
            user: { login: "octocat" },
          },
          {
            id: 201,
            number: 8,
            title: "PR de otra persona",
            state: "open",
            created_at: "2026-07-05T09:00:00Z",
            updated_at: "2026-07-05T09:00:00Z",
            merged_at: null,
            html_url: "https://github.com/acme/widgets/pull/8",
            user: { login: "someone-else" },
          },
          {
            id: 202,
            number: 9,
            title: "PR fuera de rango",
            state: "open",
            created_at: "2026-01-05T09:00:00Z",
            updated_at: "2026-01-05T09:00:00Z",
            merged_at: null,
            html_url: "https://github.com/acme/widgets/pull/9",
            user: { login: "octocat" },
          },
        ];
      if (fn === mocks.pullsListCommits) return [];
      return [];
    });

    const result = await service.getUserActivity({
      accountId: 1,
      repo: "acme/widgets",
      since: SINCE,
      until: UNTIL,
    });

    // Filtra por autor y por rango de fechas en el fallback
    expect(result.prs).toHaveLength(1);
    const pr = result.prs[0] as any;
    expect(pr.number).toBe(7);
    expect(pr.merged_at).toBe("2026-07-06T10:00:00Z");
  });

  it("lanza un error claro cuando el repo no existe (404)", async () => {
    mocks.paginate.mockImplementation(async () => {
      const err = new Error("Not Found") as any;
      err.status = 404;
      throw err;
    });

    await expect(
      service.getUserActivity({
        accountId: 1,
        repo: "acme/widgets",
        since: SINCE,
        until: UNTIL,
      }),
    ).rejects.toThrow(/no encontrado/);
  });

  it("cachea resultados por (cuenta, repo, rango) durante el TTL", async () => {
    const params = {
      accountId: 1,
      repo: "acme/widgets",
      since: SINCE,
      until: UNTIL,
    };

    await service.getUserActivity(params);
    await service.getUserActivity(params);

    // La segunda llamada usa la caché: solo una paginación de search
    expect(
      mocks.paginate.mock.calls.filter(
        ([fn]) => fn === mocks.searchIssuesAndPullRequests,
      ),
    ).toHaveLength(1);
  });

  it("rechaza un formato de repo inválido", async () => {
    await expect(
      service.getUserActivity({
        accountId: 1,
        repo: "sin-barra",
        since: SINCE,
        until: UNTIL,
      }),
    ).rejects.toThrow(/usuario\/repo/);
  });
});

describe("validateGitHubToken", () => {
  it("devuelve valid:true con el username cuando el token es correcto", async () => {
    mocks.getAuthenticated.mockResolvedValue({ data: { login: "octocat" } });
    const result = await validateGitHubToken("good-token");
    expect(result).toEqual({ valid: true, username: "octocat" });
  });

  it("devuelve valid:false cuando el token falla", async () => {
    mocks.getAuthenticated.mockRejectedValue(new Error("Bad credentials"));
    const result = await validateGitHubToken("bad-token");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Bad credentials");
  });
});
