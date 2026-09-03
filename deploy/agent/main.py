"""
LocInsights AgentCore Agent — location intelligence for MAP Active retail expansion.

Runs on Amazon Bedrock AgentCore Runtime (networkMode PUBLIC).
Capabilities (tools):
  1. scrape_locations      — live OSM/Overpass scrape via the platform scraper API
  2. save_scraped_items    — route scraped rows to staging/master tables (review workflow)
  3. get_platform_data     — read any platform data API (stores, competitors, pois, kelurahan...)
  4. analyze_opportunities — ranked site opportunities (PostGIS + scoring engine)
  5. get_ml_predictions    — GBR model registry + top-N predictions
  6. predict_revenue       — single-kelurahan GBR prediction with feature contributions
  7. train_model           — (re)train the in-platform GBR model

Auth: service account (NextAuth credentials flow) against the platform itself.
Model: Claude Sonnet 4.6 (default) / Nova 2 Lite via BedrockModel.
"""

import json
import os
import time

import boto3
import httpx
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent, tool
from strands.models import BedrockModel

APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://d2gnr4sy8jyexi.cloudfront.net")
# Model routing (per-request): default = fast+cheap chatbot-grade; 'deep' = premium reasoning.
# Research 2026-09: Nova 2 Lite ($0.30/$2.50 per 1M) for default chat,
# Claude Sonnet 4.6 ($3/$15) for deep analysis. Both verified in us-east-1.
AGENT_MODEL_ID = os.environ.get("AGENT_MODEL_ID", "amazon.nova-2-lite-v1:0")
DEEP_MODEL_ID = os.environ.get("DEEP_MODEL_ID", "anthropic.claude-sonnet-4-6")
FAST_MODEL_ID = os.environ.get("FAST_MODEL_ID", "amazon.nova-2-lite-v1:0")
AGENT_SERVICE_SECRET = os.environ.get("AGENT_SERVICE_SECRET", "locinsights/agent-service")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# ---------------------------------------------------------------- service auth
_session = {"cookie": None, "expires": 0.0}


def _load_service_credentials() -> tuple:
    """Read the service account credentials from Secrets Manager."""
    client = boto3.client("secretsmanager", region_name=AWS_REGION)
    raw = client.get_secret_value(SecretId=AGENT_SERVICE_SECRET)["SecretString"]
    data = json.loads(raw)
    return data["username"], data["password"]


def _get_session_cookie() -> str:
    """Login to the platform via NextAuth credentials flow (cached 30 min)."""
    if _session["cookie"] and time.time() < _session["expires"]:
        return _session["cookie"]

    username, password = _load_service_credentials()
    with httpx.Client(base_url=APP_BASE_URL, timeout=30, follow_redirects=False) as c:
        csrf_res = c.get("/api/auth/csrf")
        csrf_res.raise_for_status()
        csrf = csrf_res.json()["csrfToken"]
        login = c.post(
            "/api/auth/callback/credentials",
            data={"csrfToken": csrf, "username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded", "Origin": APP_BASE_URL},
        )
        # NextAuth answers 302 with a session cookie on success
        cookies = c.cookies
        auth_cookie = cookies.get("next-auth.session-token") or cookies.get("__Secure-next-auth.session-token")
        if not auth_cookie:
            raise RuntimeError(f"login failed: HTTP {login.status_code}")
        _session["cookie"] = auth_cookie
        _session["expires"] = time.time() + 30 * 60
        return auth_cookie


def _api(method: str, path: str, json_body=None, params=None, timeout: int = 55):
    cookie = _get_session_cookie()
    with httpx.Client(base_url=APP_BASE_URL, timeout=timeout, follow_redirects=False) as c:
        res = c.request(
            method,
            path,
            json=json_body,
            params=params,
            cookies={"next-auth.session-token": cookie, "__Secure-next-auth.session-token": cookie},
            headers={"Accept": "application/json"},
        )
        if res.status_code == 401:  # session expired mid-flight
            _session["expires"] = 0
            return {"error": "session expired - retry the call"}
        if res.status_code >= 400:
            return {"error": f"HTTP {res.status_code}", "body": res.text[:500]}
        return res.json()


# ------------------------------------------------------------------------ tools
@tool
def scrape_locations(mode: str, query: str = "", kab_code: str = "", kinds: list = None) -> dict:
    """Run a live scrape for Bali retail locations via the platform scraper.

    Args:
        mode: 'keyword' (free-text search) or 'brand' (sweep the 27-competitor catalog).
        query: free-text search term (keyword mode only).
        kab_code: optional kabupaten code to constrain (empty = all Bali).
        kinds: list of item kinds to include, e.g. ['store', 'mall', 'poi'].
    Returns: {run_id, total_found, results[]}. Results are NOT saved yet.
    """
    body: dict = {"mode": mode}
    if query:
        body["query"] = query
    if kab_code:
        body["location"] = {"kab_code": kab_code}
    if kinds:
        body["kinds"] = kinds
    return _api("POST", "/api/locinsight/scrape", json_body=body, timeout=55)


@tool
def save_scraped_items(run_id: str, items: list) -> dict:
    """Save reviewed scrape results into staging/master tables.

    Args:
        run_id: run identifier returned by scrape_locations.
        items: array of result rows (as returned by scrape_locations) to persist.
    Returns: {saved: {stores, competitors, malls, pois, total}, skipped, errors}.
    """
    return _api("POST", "/api/locinsight/scrape-save", json_body={"run_id": run_id, "items": items}, timeout=55)


@tool
def get_platform_data(endpoint: str, limit: int = 25, extra_params: dict = None) -> dict:
    """Read data from the platform API. Useful for data-grounded answers.

    Args:
        endpoint: one of stores, competitors, pois, malls, kelurahan, kabupaten,
                  brands, overview, reports, scraper_runs.
        limit: max rows (default 25).
        extra_params: optional query params dict (e.g. {"kab_code": "5101"}).
    """
    allowed = {"stores", "competitors", "pois", "malls", "kelurahan", "kabupaten",
               "brands", "overview", "reports", "scraper_runs", "mall-tenants", "field-survey"}
    if endpoint not in allowed:
        return {"error": f"endpoint must be one of {sorted(allowed)}"}
    params = dict(extra_params or {})
    params.setdefault("limit", limit)
    return _api("GET", f"/api/locinsight/{endpoint}", params=params)


@tool
def analyze_opportunities(limit: int = 10) -> dict:
    """Get ranked site opportunities in Bali (competition, POI density, demographics)."""
    return _api("GET", "/api/locinsight/opportunities", params={"limit": limit})


@tool
def get_ml_predictions(limit: int = 10) -> dict:
    """Get the current GBR model registry and top-N site predictions."""
    return _api("GET", "/api/locinsight/ml", params={"limit": limit})


@tool
def predict_revenue(kelurahan_id: str = "", brand_id: str = "") -> dict:
    """GBR revenue prediction (juta IDR/month) for ONE kelurahan x brand with
    per-feature contributions. kelurahan_id is the Kemendagri village code from
    the platform DB (e.g. from analyze_opportunities or get_platform_data);
    brand_id optional (default BR001 Starbucks)."""
    params = {"action": "predict_revenue"}
    if not kelurahan_id:
        return {"error": "kelurahan_id is required — get one from analyze_opportunities or get_platform_data first"}
    params["kelurahan_id"] = kelurahan_id
    if brand_id:
        params["brand_id"] = brand_id
    return _api("GET", "/api/locinsight/ml", params=params)


@tool
def record_actual_revenue(prediction_id: str, actual_revenue: float, note: str = "") -> dict:
    """Ground-truth capture (R4): record the OBSERVED monthly revenue (juta IDR)
    for a persisted prediction so drift can be measured and future retraining
    learns from reality. prediction_id comes from predict_revenue/list results
    or the predictions table."""
    if not prediction_id:
        return {"error": "prediction_id is required"}
    try:
        actual = float(actual_revenue)
    except (TypeError, ValueError):
        return {"error": "actual_revenue must be a number (juta IDR)"}
    body = {"prediction_id": prediction_id, "actual_revenue": actual}
    if note:
        body["note"] = note[:500]
    return _api("POST", "/api/locinsight/ml", json_body=body)


@tool
def get_model_health() -> dict:
    """ML drift & health report: ground-truth accuracy (MAPE/bias over recorded
    actuals), prediction coverage vs kelurahan in DB, data freshness watermark,
    and current model version + holdout metrics. Use it to decide whether a
    retrain is warranted."""
    return _api("GET", "/api/locinsight/ml", params={"action": "drift"})


@tool
def train_model() -> dict:
    """(Re)train the platform GBR prediction model on current data."""
    return _api("POST", "/api/locinsight/ml/train", json_body={}, timeout=55)


# ------------------------------------------------------------------------- agent
SYSTEM_PROMPT = """You are the LocInsights Agent — a location-intelligence agent for the
MAP Active Adiperkasa (MAA) retail expansion team, covering all 38 provinces of
Indonesia (Bali + Jabodetabek fully loaded; Kemendagri/OSM/BPS-grounded data).

Capabilities:
- Ingestion: run live scrapes (OSM/Overpass via the platform scraper), review results, and save
  high-confidence rows to staging/master tables (brand sweep or keyword mode).
- Insight: query platform data (stores, competitors, POIs, kelurahan demographics), read ranked
  opportunities, and synthesize concise business findings with numbers.
- Prediction: read GBR model registry/predictions, request single-kelurahan predictions
  (predict_revenue needs a kelurahan_id — fetch candidates first), and retrain the model
  when data changed materially.
- Model health: check drift (get_model_health) and record observed monthly revenues
  (record_actual_revenue) to feed the ground-truth flywheel — at least 10 actuals enable
  drift measurement and real-label retraining.

Rules:
- Always ground answers in tool results — cite the concrete numbers you fetched.
- Data changes: prefer scrape (brand mode, per kabupaten) then save only plausible rows; report
  exactly how many rows went to stores / competitors / malls / pois.
- Answer in the user's language (Indonesian or English).
- Be concise: lead with the answer, then the supporting data. Never invent locations or numbers.
- When the user reports a store's real revenue, call record_actual_revenue with the matching
  prediction_id.
"""

app = BedrockAgentCoreApp()


def _build_agent(model_id: str = "") -> Agent:
    model = BedrockModel(
        model_id=model_id or AGENT_MODEL_ID,
        temperature=0.2,
        max_tokens=2000,
    )
    return Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[scrape_locations, save_scraped_items, get_platform_data,
               analyze_opportunities, get_ml_predictions, predict_revenue, train_model],
        callback_handler=None,
    )


@app.entrypoint
def invoke(payload: dict) -> dict:
    prompt = (payload or {}).get("prompt", "")
    lang = (payload or {}).get("lang", "en")
    model_mode = (payload or {}).get("model", "")
    history = (payload or {}).get("history") or []
    if not prompt:
        return {"reply": "No prompt provided.", "error": "empty prompt"}

    # Model routing: payload.model = 'deep' | 'fast' | '' (default fast)
    model_id = DEEP_MODEL_ID if model_mode == "deep" else FAST_MODEL_ID

    context_lines = []
    for m in history[-6:]:
        role = "User" if m.get("role") == "user" else "Assistant"
        content = str(m.get("content", ""))[:1200]
        if content:
            context_lines.append(f"{role}: {content}")
    conversation_context = "\n".join(context_lines)
    full_prompt = prompt if not conversation_context else (
        f"Conversation so far (for context):\n{conversation_context}\n\n"
        f"Current user message: {prompt}"
    )

    try:
        agent = _build_agent(model_id)
        result = agent(full_prompt)
        reply = str(result)
        return {"reply": reply, "source": "agentcore", "model": model_id, "lang": lang}
    except Exception as exc:  # keep the payload contract stable for the web app
        return {"error": f"agent failure: {exc}", "reply": ""}


if __name__ == "__main__":
    app.run()
