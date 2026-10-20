import axios from 'axios';
import { z } from '../config/validation';
export interface ApiProblem {
  type?: string;
  title?: string;
  instance?: string;
  timestamp?: string;
  path?: string;
  status: number;
  code: string;
  detail: string;
  correlationId?: string;
  errors?: { field: string; message: string }[];
  retryAt?: number;
}
const problemSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  instance: z.string().optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
  status: z.number().optional(),
  code: z.string().optional(),
  detail: z.string().optional(),
  correlationId: z.string().optional(),
  errors: z
    .array(z.object({ field: z.string(), message: z.string() }))
    .optional(),
});
export class ApiError extends Error {
  readonly problem: ApiProblem;
  constructor(problem: ApiProblem) {
    super(problem.detail);
    this.name = 'ApiError';
    this.problem = problem;
  }
}
export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const parsed = problemSchema.safeParse(error.response?.data);
    const p = parsed.success ? parsed.data : {};
    const retry = String(error.response?.headers['retry-after'] ?? '');
    const retryAt = retry
      ? /^\d+$/.test(retry)
        ? Date.now() + Number(retry) * 1000
        : Date.parse(retry)
      : undefined;
    return new ApiError({
      ...p,
      status: error.response?.status ?? 0,
      code: p.code ?? (error.response ? 'HTTP_ERROR' : 'NETWORK_ERROR'),
      detail:
        p.detail ??
        (error.response
          ? 'Не удалось выполнить запрос.'
          : 'Нет ответа сервера. Проверьте подключение.'),
      correlationId: p.correlationId,
      errors: p.errors,
      retryAt: retryAt && Number.isFinite(retryAt) ? retryAt : undefined,
    });
  }
  return new ApiError({
    status: 0,
    code: error instanceof z.ZodError ? 'INVALID_RESPONSE' : 'CLIENT_ERROR',
    detail:
      error instanceof z.ZodError
        ? 'Ответ сервера не соответствует контракту.'
        : error instanceof Error
          ? error.message
          : 'Неизвестная ошибка',
  });
}
const messages: Record<string, string> = {
  INVALID_TABLE_TOKEN:
    'QR-код устарел. Отсканируйте актуальный код на столике.',
  TABLE_INACTIVE: 'Столик сейчас недоступен. Обратитесь к сотруднику.',
  MENU_ITEM_UNAVAILABLE:
    'Некоторые блюда закончились. Обновите состав корзины и подтвердите заказ снова.',
  IDEMPOTENCY_CONFLICT:
    'Конфликт попытки заказа. Обратитесь к сотруднику; новый заказ автоматически не создаётся.',
  CATEGORY_IN_USE:
    'Категория связана с блюдами, включая неактивные. Сначала измените их категорию.',
  CONCURRENT_UPDATE:
    'Данные изменились. Обновите страницу и повторите действие.',
  UNAUTHORIZED: 'Войдите снова: сессия истекла или данные входа неверны.',
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  RATE_LIMITED: 'Слишком много запросов. Дождитесь окончания паузы.',
  INVALID_ORDER_STATUS_TRANSITION:
    'Статус заказа уже изменился. Обновите список.',
};
export function errorMessage(error: unknown) {
  const p = normalizeError(error).problem;
  return messages[p.code] ?? p.detail;
}
