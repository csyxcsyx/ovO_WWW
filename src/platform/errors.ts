export interface FriendlyError { message: string; retryAfterMs: number; code: string }
export function friendlyError(error: unknown): FriendlyError {
  const candidate = error && typeof error === 'object' ? error as { code?: unknown; data?: { retryAfterMs?: unknown } } : {};
  const code = typeof candidate.code === 'string' ? candidate.code : 'UNKNOWN';
  const messages: Record<string, string> = {
    UNAUTHORIZED: '请先在小黑盒客户端登录，再提交成绩。',
    LEADERBOARD_DEFAULT_NOT_FOUND: '排行榜尚未开通，个人纪录已保留。',
    LEADERBOARD_NOT_FOUND: '排行榜尚未开通，个人纪录已保留。',
    NOT_FOUND: '排行榜尚未开通，个人纪录已保留。',
    RATE_LIMITED: '操作较频繁，请稍后再试。',
    RATE_LIMITED_BY_RUNTIME: '操作较频繁，请稍后再试。',
    METHOD_FORBIDDEN: '当前客户端暂不支持这项功能。',
    METHOD_NOT_FOUND: '当前客户端暂不支持这项功能。',
    REQUEST_UNSUPPORTED: '当前客户端暂不支持这项功能。',
    PERMISSION_NOT_IN_SNAPSHOT: '当前小程序尚未启用这项能力。',
    PERMISSION_DENIED: '当前小程序尚未启用这项能力。',
    STORAGE_QUOTA_EXCEEDED: '本地存储空间不足，本局成绩仍可查看。',
    LOCAL_PREVIEW: '本地体验可直接游玩；排行和分享请在小黑盒中使用。',
    RUNTIME_UNLOADED: '小程序连接已结束，请重新打开后再试。',
  };
  const limited = code === 'RATE_LIMITED' || code === 'RATE_LIMITED_BY_RUNTIME';
  const delay = Number(candidate.data?.retryAfterMs);
  return { code, message: messages[code] || '连接暂时不可用，请稍后再试。',
    retryAfterMs: limited ? Math.max(30000, Number.isFinite(delay) && delay > 0 ? delay : 60000) : 0 };
}
export const isUnsupported = (error: unknown) => ['METHOD_FORBIDDEN', 'METHOD_NOT_FOUND', 'REQUEST_UNSUPPORTED'].includes(friendlyError(error).code);
