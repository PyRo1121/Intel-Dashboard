import type { AuthFlowMode } from "./auth-flow.ts";

export type AuthCopy = {
  title: string;
  description: string;
  xLabel: string;
  githubLabel: string;
  switchLabel: string;
};

export function getAuthCopy(mode: AuthFlowMode): AuthCopy {
  if (mode === "signup") {
    return {
      title: "Create your SentinelStream access",
      description: "OAuth-only onboarding. Start in seconds with X or GitHub.",
      xLabel: "Create Account with X",
      githubLabel: "Create Account with GitHub",
      switchLabel: "Already have access? Sign in",
    };
  }

  return {
    title: "Sign in to SentinelStream",
    description: "Continue your intelligence workflow with secure OAuth authentication.",
    xLabel: "Continue with X",
    githubLabel: "Continue with GitHub",
    switchLabel: "Need access? Create account",
  };
}
