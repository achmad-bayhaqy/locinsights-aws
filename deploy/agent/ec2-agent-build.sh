#!/bin/bash
# LocInsights AGENT build FINAL (ARM64 via QEMU, RUN pip native)
set -euxo pipefail
export HOME=/root
exec > /var/log/locinsights-agent-build.log 2>&1

ACCOUNT=715841354009
REGION=us-east-1
ECR_AGENT="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/locinsights/agentcore"

echo "=== [1/4] ECR login ==="
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT".dkr.ecr."$REGION".amazonaws.com

echo "=== [2/4] QEMU arm64 ==="
docker run --privileged --rm tonistiigi/binfmt --install arm64 2>&1 | tail -1 || true

echo "=== [3/4] context ==="
rm -rf /opt/build/agent/ctx2 && mkdir -p /opt/build/agent/ctx2
cd /opt/build/agent/ctx2
aws s3 cp "s3://locinsights-artifacts-${ACCOUNT}/scripts/agent-main-v3.py" main.py
cat > requirements.txt << 'REQ'
strands-agents>=1.10.0
bedrock-agentcore>=1.0.0
boto3>=1.40.0
httpx>=0.28.0
REQ
cat > Dockerfile << 'DOCKER'
FROM --platform=linux/arm64 python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
ENV PYTHONUNBUFFERED=1 PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/ping', timeout=4)" || exit 1
CMD ["python", "main.py"]
DOCKER

echo "=== [4/4] buildx arm64 + push ==="
docker buildx create --use --name locbuilder4 2>/dev/null || docker buildx use locbuilder3 2>/dev/null || true
docker buildx build --platform linux/arm64 \
  -t "$ECR_AGENT":latest -t "$ECR_AGENT":v3 \
  --push /opt/build/agent/ctx2

aws ecr describe-images --repository-name locinsights/agentcore --query 'imageDetails[].{tags:imageTags,pushed:imagePushedAt}' --output json
echo "AGENT_DONE" > /opt/build/agent/DONE
echo "=== LOCINSIGHTS AGENT BUILD v3 SELESAI ==="
