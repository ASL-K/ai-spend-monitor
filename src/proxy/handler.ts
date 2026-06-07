// src/proxy/handler.ts
// OpenAI 兼容反向代理 handler
//
// v0.1: 只支持非流式（stream=false）
// 流程:
//   1. 解析请求头（x-provider 决定转发到哪个 provider）
//   2. 用 provider.extractApiKey() 提取真 API key
//   3. 重写 body.model 为 normalizeModel(model)
//   4. POST 到 provider.baseUrl/chat/completions
//   5. 把响应原样返回（透传）
//   6. 解析 usage, 准备返回给调用方
//
// 注意: 实际写入 SQLite 在 caller 处做（这个函数不依赖 db）

import { getProvider } from '../providers/registry.js';
import { MissingApiKeyError, UnknownProviderError, UpstreamError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { CallRecord } from '../types.js';

export interface ProxyRequest {
  provider: string;
  authHeader: string | undefined;
  body: OpenAIRequestBody;
}

export interface OpenAIRequestBody {
  model: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface ProxyResult {
  statusCode: number;
  responseBody: string;
  record: Omit<CallRecord, 'id'>;
}

export async function handleProxy(req: ProxyRequest): Promise<ProxyResult> {
  const provider = getProvider(req.provider);
  if (!provider) {
    throw new UnknownProviderError(req.provider);
  }

  const apiKey = provider.extractApiKey(req.authHeader);
  if (!apiKey) {
    throw new MissingApiKeyError(req.provider);
  }

  // 拒绝流式（v0.1 不支持）
  if (req.body.stream === true) {
    throw new UpstreamError(req.provider, 400, 'Stream mode is not supported in v0.1');
  }

  const upstreamModel = provider.normalizeModel(req.body.model);
  const upstreamBody = { ...req.body, model: upstreamModel, stream: false };
  const url = `${provider.baseUrl}/chat/completions`;

  const start = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error(`[${req.provider}] network error: ${(err as Error).message}`);
    return {
      statusCode: 502,
      responseBody: JSON.stringify({ error: { message: 'Network error', detail: String(err) } }),
      record: {
        timestamp: start,
        provider: req.provider,
        model: req.body.model,
        upstreamModel,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costCNY: 0,
        durationMs,
        status: 'error',
        errorMessage: (err as Error).message,
      },
    };
  }

  const durationMs = Date.now() - start;
  const responseText = await response.text();

  if (!response.ok) {
    return {
      statusCode: response.status,
      responseBody: responseText,
      record: {
        timestamp: start,
        provider: req.provider,
        model: req.body.model,
        upstreamModel,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costCNY: 0,
        durationMs,
        status: 'error',
        errorMessage: `HTTP ${response.status}`,
      },
    };
  }

  // 成功：解析 usage
  let responseJson: unknown;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    responseJson = null;
  }

  const usage = provider.extractUsage(responseJson);
  return {
    statusCode: response.status,
    responseBody: responseText,
    record: {
      timestamp: start,
      provider: req.provider,
      model: req.body.model,
      upstreamModel,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      costCNY: 0, // 由 caller 用 pricing 模块算
      durationMs,
      status: 'success',
    },
  };
}
