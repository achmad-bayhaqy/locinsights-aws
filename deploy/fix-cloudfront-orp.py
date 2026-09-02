#!/usr/bin/env python3
"""Fix CloudFront OriginRequestPolicy for LocInsights app distribution.

Root cause of the full-page-refresh bug: the custom ORP whitelists headers and
strips `RSC`, `Next-Router-State-Tree`, `Next-Router-Prefetch`,
`Next-Router-Segment-Prefetch` — Next.js App Router then returns HTML for RSC
requests and the client router falls back to MPA (full document) navigation.

Fix: switch to managed AllViewerExceptHostHeader (forwards ALL viewer headers
except Host, plus all cookies & query strings).
"""
import json
import os
import subprocess
import sys

DISTRIB = "d2gnr4sy8jyexi.cloudfront.net"  # app distribution (worklog Task 5)
POLICY_ID = "b689b0a8-53d0-40ab-baf2-68738e2966ac"  # Managed-AllViewerExceptHostHeader

env = dict(
    os.environ,
    AWS_DEFAULT_REGION="us-east-1",
    PATH=f"/home/z/.local/bin:{os.environ.get('PATH', '')}",
)

def aws(*args):
    return subprocess.run(
        ["aws", *args], capture_output=True, text=True, env=env, check=True
    ).stdout

# 1. Resolve distribution id from domain name
ids = json.loads(
    aws("cloudfront", "list-distributions", "--output", "json")
)
dist_id = None
for item in ids["DistributionList"]["Items"]:
    if DISTRIB in item.get("DomainName", ""):
        dist_id = item["Id"]
        break
if not dist_id:
    sys.exit(f"ERROR: distribution for {DISTRIB} not found")
print(f"Distribution: {dist_id}")

# 2. Fetch config + ETag
raw = aws("cloudfront", "get-distribution-config", "--id", dist_id, "--output", "json")
etag = json.loads(raw)["ETag"]
cfg = json.loads(raw)["DistributionConfig"]
print(f"ETag: {etag}")
print(f"Current ORP: {cfg['DefaultCacheBehavior'].get('OriginRequestPolicyId')}")

# 3. Patch ORP id on the app behavior
cfg["DefaultCacheBehavior"]["OriginRequestPolicyId"] = POLICY_ID

# 4. Update (write config to temp file — fileb:// stdin is unreliable)
cfg_path = "/tmp/cf-dist-config.json"
with open(cfg_path, "w") as f:
    json.dump(cfg, f)
p = subprocess.run(
    ["aws", "cloudfront", "update-distribution", "--id", dist_id,
     "--if-match", etag, "--distribution-config", f"fileb://{cfg_path}", "--output", "json"],
    capture_output=True, text=True, env=env,
)
if p.returncode != 0:
    sys.exit(f"ERROR updating: {p.stderr[:2000]}")
res = json.loads(p.stdout)
status = res["Distribution"]["Status"]
new_etag = res["ETag"]
print(f"Update submitted. Status={status}, NewETag={new_etag}")
print("Propagation usually takes ~1-5 minutes.")
