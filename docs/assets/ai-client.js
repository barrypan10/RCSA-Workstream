// Browser-side LLM client for the RCSA demo.
//
// - Calls an OpenAI-compatible chat-completions endpoint (POST {baseUrl}/v1/chat/completions).
// - Designed for an organization-issued LLM gateway. The original Anthropic-direct
//   path is gone; the gateway picks the model unless the user names one.
// - Three settings live in sessionStorage (tab-lifetime only):
//     rcsa.llm_base_url   e.g. https://gateway.example.com
//     rcsa.llm_api_key    Bearer token
//     rcsa.llm_model      optional — leave blank to use the gateway default
// - Translates the legacy { system, messages, maxTokens, cacheSystem, jsonSchema }
//   shape (Anthropic-style) into OpenAI-compatible bodies so app.js call sites
//   (runLiveAi, runLiveAiReview) keep their existing signatures.
//   * cacheSystem is silently ignored (Anthropic-only feature).
//   * jsonSchema → response_format: { type: 'json_object' } (broadly compatible
//     across gateways; strict json_schema is intentionally avoided).
// - Throws typed errors (AuthError / RateLimitError / NetworkError / ParseError /
//   APIError). NetworkError is CORS-aware and includes an actionable message.
//
// Exposed as window.AIClient — loaded before app.js by index.html.

(function () {
  'use strict';

  const KEY_STORAGE      = 'rcsa.llm_api_key';
  const BASE_URL_STORAGE = 'rcsa.llm_base_url';
  const MODEL_STORAGE    = 'rcsa.llm_model';
  const DEFAULT_MODEL    = 'gpt-4o-mini'; // used only when both gateway + user blank

  class AIError extends Error {
    constructor(message, type) { super(message); this.name = 'AIError'; this.type = type; }
  }
  class AuthError       extends AIError { constructor(m) { super(m, 'auth');       this.name = 'AuthError'; } }
  class RateLimitError  extends AIError { constructor(m) { super(m, 'rate_limit'); this.name = 'RateLimitError'; } }
  class NetworkError    extends AIError { constructor(m) { super(m, 'network');    this.name = 'NetworkError'; } }
  class ParseError      extends AIError { constructor(m, raw) { super(m, 'parse'); this.name = 'ParseError'; this.raw = raw; } }
  class APIError        extends AIError { constructor(m, status) { super(m, 'api'); this.name = 'APIError'; this.status = status; } }

  // ---------- sessionStorage helpers ----------
  function read(k)        { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v)    { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function remove(k)      { try { sessionStorage.removeItem(k); } catch (e) {} }

  function getApiKey()    { return read(KEY_STORAGE); }
  function setApiKey(k)   { if (k && k.trim()) write(KEY_STORAGE, k.trim()); else remove(KEY_STORAGE); }
  function clearApiKey()  { remove(KEY_STORAGE); }
  function hasApiKey()    { const k = getApiKey(); return !!(k && k.trim().length > 0); }

  function getBaseUrl()   { return read(BASE_URL_STORAGE); }
  function setBaseUrl(u)  { if (u && u.trim()) write(BASE_URL_STORAGE, u.trim().replace(/\/+$/, '')); else remove(BASE_URL_STORAGE); }
  function clearBaseUrl() { remove(BASE_URL_STORAGE); }
  function hasBaseUrl()   { const u = getBaseUrl(); return !!(u && u.trim().length > 0); }

  function getModel()     { return read(MODEL_STORAGE); }
  function setModel(m)    { if (m && m.trim()) write(MODEL_STORAGE, m.trim()); else remove(MODEL_STORAGE); }
  function clearModel()   { remove(MODEL_STORAGE); }

  function isLive()       { return hasApiKey() && hasBaseUrl(); }

  // ---------- main entry ----------
  // callClaude is kept as the function name for back-compat with app.js call
  // sites; it is now provider-agnostic.
  //
  // Accepts the legacy shape:
  //   { system, messages, maxTokens, cacheSystem (ignored), jsonSchema (treated
  //     as a "want JSON" flag) }
  //
  // Returns:
  //   { text, parsed, usage, model } — same as before. `model` is whatever the
  //   gateway reports back so the UI can attribute the actual responder.
  async function callClaude({ system, messages, maxTokens = 1024, cacheSystem = false, jsonSchema = null }) {
    const apiKey  = getApiKey();
    const baseUrl = getBaseUrl();
    if (!apiKey) {
      throw new AuthError('No API key configured. Open ⚙ API in the topbar to set one.');
    }
    if (!baseUrl) {
      throw new AuthError('No gateway base URL configured. Open ⚙ API and paste your org gateway URL.');
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AIError('callClaude: messages must be a non-empty array.', 'usage');
    }

    // Anthropic → OpenAI-compatible message shape:
    //   - prepend the system prompt as { role: 'system', content }
    //   - cacheSystem is silently dropped (gateway-specific; not portable)
    const oaMessages = system
      ? [{ role: 'system', content: system }, ...messages]
      : messages.slice();

    const model = (getModel() && getModel().trim()) || DEFAULT_MODEL;

    const body = {
      model: model,
      messages: oaMessages,
      max_tokens: maxTokens
    };
    // jsonSchema → response_format. We use the broadly-supported `json_object`
    // hint; the prompt itself contains the explicit shape ("Format JSON: ...").
    if (jsonSchema) {
      body.response_format = { type: 'json_object' };
    }

    const url = baseUrl.replace(/\/+$/, '') + '/v1/chat/completions';

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      // A thrown fetch in the browser with no HTTP status is most often CORS or
      // a network/firewall issue. Surface a clear, actionable message.
      const raw = (e && e.message) ? e.message : String(e);
      const origin = (typeof location !== 'undefined' && location.origin) ? location.origin : 'this page';
      throw new NetworkError(
        'Could not reach ' + baseUrl + '. This usually means a CORS block ' +
        '(your gateway needs to allow ' + origin + ' as an origin) or a ' +
        'corporate-network firewall. Original: ' + raw
      );
    }

    if (!response.ok) {
      let errBody = null;
      try { errBody = await response.json(); } catch (_) {}
      const msg =
        (errBody && errBody.error && errBody.error.message) ||
        (errBody && errBody.message) ||
        ('HTTP ' + response.status + ' ' + (response.statusText || '')).trim();
      if (response.status === 401 || response.status === 403) throw new AuthError(msg);
      if (response.status === 429) throw new RateLimitError(msg);
      throw new APIError(msg, response.status);
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new ParseError('Could not parse gateway response as JSON: ' + e.message, null);
    }

    // OpenAI-compatible shape: choices[0].message.content (string).
    const choice = (data.choices && data.choices[0]) || null;
    const content = choice && choice.message && typeof choice.message.content === 'string'
      ? choice.message.content
      : null;
    if (content === null) {
      throw new ParseError('Gateway response had no message.content', data);
    }

    let parsed = null;
    if (jsonSchema) {
      // Some gateways wrap JSON in code fences even with response_format set.
      // Be defensive: strip ``` fences before parsing.
      const cleaned = content
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        throw new ParseError(
          'Response was not valid JSON despite response_format json_object: ' + e.message,
          content
        );
      }
    }

    return {
      text:   content,
      parsed: parsed,
      usage:  data.usage || {},
      model:  data.model || model
    };
  }

  window.AIClient = {
    callClaude:    callClaude,
    // Settings — used by initAiSettingsModal in app.js
    getApiKey:     getApiKey,
    setApiKey:     setApiKey,
    clearApiKey:   clearApiKey,
    hasApiKey:     hasApiKey,
    getBaseUrl:    getBaseUrl,
    setBaseUrl:    setBaseUrl,
    clearBaseUrl:  clearBaseUrl,
    hasBaseUrl:    hasBaseUrl,
    getModel:      getModel,
    setModel:      setModel,
    clearModel:    clearModel,
    isLive:        isLive,
    DEFAULT_MODEL: DEFAULT_MODEL,
    // Storage keys are exposed for diagnostics (not used in normal flow).
    KEY_STORAGE:      KEY_STORAGE,
    BASE_URL_STORAGE: BASE_URL_STORAGE,
    MODEL_STORAGE:    MODEL_STORAGE,
    // Error classes — call sites may type-check.
    AIError:        AIError,
    AuthError:      AuthError,
    RateLimitError: RateLimitError,
    NetworkError:   NetworkError,
    ParseError:     ParseError,
    APIError:       APIError
  };
})();
