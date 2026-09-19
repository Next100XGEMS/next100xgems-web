import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AcceptanceChain } from "@/lib/radar/acceptance/contracts";

const execFileAsync = promisify(execFile);
const READ_ONLY_COMMANDS = new Set(["token info", "token security", "token holders", "token traders", "market kline"]);

export type GmgnAcceptanceResult = {
  provider: "gmgn";
  command: string;
  exitCode: number;
  success: boolean;
  responseBytes: number;
  responseKeys: readonly string[];
  errorCode: string | null;
};

type GmgnRunner = (args: readonly string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const defaultRunner: GmgnRunner = async (args) => {
  try {
    const result = await execFileAsync("npx", ["--yes", "gmgn-cli", ...args], { maxBuffer: 2 * 1024 * 1024 });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: number | string };
    return { stdout: failure.stdout ?? "", stderr: failure.stderr ?? "", exitCode: typeof failure.code === "number" ? failure.code : 1 };
  }
};

export class GmgnCliAcceptanceClient {
  constructor(private readonly runner: GmgnRunner = defaultRunner) {}

  async tokenInfo(chain: AcceptanceChain, tokenAddress: string): Promise<GmgnAcceptanceResult> {
    return this.runReadOnly(["token", "info", "--chain", gmgnChain(chain), "--address", tokenAddress, "--raw"]);
  }

  private async runReadOnly(args: readonly string[]): Promise<GmgnAcceptanceResult> {
    const command = args.slice(0, 2).join(" ");
    if (!READ_ONLY_COMMANDS.has(command)) throw new Error("GMGN acceptance permits documented read-only commands only.");
    const result = await this.runner(args);
    let responseKeys: readonly string[] = [];
    let errorCode: string | null = result.exitCode === 0 ? null : "CLI_ERROR";
    if (result.stdout.trim()) {
      try {
        const payload = JSON.parse(result.stdout) as Record<string, unknown>;
        responseKeys = Object.keys(payload).sort();
        if (typeof payload.code === "string" || typeof payload.code === "number") errorCode = result.exitCode === 0 ? null : String(payload.code);
      } catch {
        errorCode = result.exitCode === 0 ? "MALFORMED_JSON" : errorCode;
      }
    }
    return { provider: "gmgn", command, exitCode: result.exitCode, success: result.exitCode === 0 && responseKeys.length > 0 && errorCode === null, responseBytes: Buffer.byteLength(result.stdout), responseKeys, errorCode };
  }
}

function gmgnChain(chain: AcceptanceChain): string {
  const mapping: Partial<Record<AcceptanceChain, string>> = { solana: "sol", bnb: "bsc", ethereum: "eth" };
  return mapping[chain] ?? chain;
}
