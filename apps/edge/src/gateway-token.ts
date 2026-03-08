export interface AiGatewayTokenEnv {
  AI_GATEWAY_TOKEN?: string;
  CF_API_TOKEN?: string;
  ALLOW_CF_API_TOKEN_AS_AIG?: string;
}

function readNonEmptyValue(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function parseBooleanFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function resolveAiGatewayToken(env: AiGatewayTokenEnv): string | undefined {
  const explicitGatewayToken = readNonEmptyValue(env.AI_GATEWAY_TOKEN);
  if (explicitGatewayToken) {
    return explicitGatewayToken;
  }
  if (!parseBooleanFlag(env.ALLOW_CF_API_TOKEN_AS_AIG)) {
    return undefined;
  }
  return readNonEmptyValue(env.CF_API_TOKEN) ?? undefined;
}
