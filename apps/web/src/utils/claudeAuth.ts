const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

export type ClaudeBaseType = 'anthropic' | 'custom';

export interface ClaudeRequestHeaderOptions {
  url: string;
  apiKey?: string;
  authIndex?: string;
  customHeaders?: Record<string, string>;
  contentType?: string;
}

export interface ClaudeRequestHeaderResolution {
  headers: Record<string, string>;
  baseType: ClaudeBaseType;
  effectiveXApiKey: boolean;
  effectiveAuthorization: boolean;
}

const findHeaderKey = (headers: Record<string, string>, name: string): string | undefined => {
  const target = name.toLowerCase();
  return Object.keys(headers).find((key) => key.toLowerCase() === target);
};

export const hasClaudeHeader = (headers: Record<string, string>, name: string): boolean =>
  findHeaderKey(headers, name) !== undefined;

const setHeader = (headers: Record<string, string>, name: string, value: string) => {
  const target = name.toLowerCase();
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === target) delete headers[key];
  });
  headers[name] = value;
};

const applyCustomHeaders = (
  headers: Record<string, string>,
  customHeaders: Record<string, string>
) => {
  Object.entries(customHeaders).forEach(([rawName, rawValue]) => {
    const name = String(rawName ?? '').trim();
    const value = String(rawValue ?? '').trim();
    if (!name || !value) return;
    setHeader(headers, name, value);
  });
};

export const isAnthropicFirstPartyUrl = (value: string): boolean => {
  try {
    const parsed = new URL(String(value ?? '').trim());
    return (
      parsed.protocol.toLowerCase() === 'https:' &&
      parsed.hostname.toLowerCase() === 'api.anthropic.com' &&
      (parsed.port === '' || parsed.port === '443') &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
};

export const isClaudeOAuthToken = (value: string): boolean =>
  String(value ?? '').includes('sk-ant-oat');

export const buildClaudeRequestHeaders = (
  options: ClaudeRequestHeaderOptions
): ClaudeRequestHeaderResolution => {
  const customHeaders = options.customHeaders ?? {};
  const headers: Record<string, string> = {};
  const apiKey = String(options.apiKey ?? '').trim();
  const authIndex = String(options.authIndex ?? '').trim();
  const firstParty = isAnthropicFirstPartyUrl(options.url);
  const hasCustomAuth = Object.entries(customHeaders).some(([name, value]) => {
    const normalizedName = name.trim().toLowerCase();
    return (
      (normalizedName === 'authorization' || normalizedName === 'x-api-key') &&
      String(value ?? '').trim() !== ''
    );
  });

  if (apiKey) {
    if (firstParty && !isClaudeOAuthToken(apiKey)) {
      setHeader(headers, 'x-api-key', apiKey);
    } else {
      setHeader(headers, 'Authorization', `Bearer ${apiKey}`);
    }
  } else if (authIndex && !hasCustomAuth) {
    if (firstParty) {
      setHeader(headers, 'x-api-key', '$TOKEN$');
    } else {
      setHeader(headers, 'Authorization', 'Bearer $TOKEN$');
    }
  }

  setHeader(headers, 'anthropic-version', DEFAULT_ANTHROPIC_VERSION);
  if (options.contentType) {
    setHeader(headers, 'Content-Type', options.contentType);
  }
  applyCustomHeaders(headers, customHeaders);

  return {
    headers,
    baseType: firstParty ? 'anthropic' : 'custom',
    effectiveXApiKey: hasClaudeHeader(headers, 'x-api-key'),
    effectiveAuthorization: hasClaudeHeader(headers, 'authorization'),
  };
};

export const formatClaudeAuthDiagnostic = (
  resolution: ClaudeRequestHeaderResolution,
  apiKey?: string,
  authIndex?: string
): string =>
  `[diag: apiKeyField=${String(apiKey ?? '').trim() ? 'yes' : 'no'}, authIndex=${
    String(authIndex ?? '').trim() ? 'yes' : 'no'
  }, baseType=${resolution.baseType}, effectiveXApiKey=${
    resolution.effectiveXApiKey ? 'yes' : 'no'
  }, effectiveAuthorization=${resolution.effectiveAuthorization ? 'yes' : 'no'}]`;
