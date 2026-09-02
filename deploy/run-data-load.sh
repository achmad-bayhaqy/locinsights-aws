#!/usr/bin/env bash
# Run the data-expansion SQL load as an ECS one-off task (Fargate).
set -euo pipefail
source /home/z/my-project/workspace/aws/env.sh
export PATH="/home/z/.local/bin:$PATH"

LOADER_URL=$(tr -d '[:space:]' < /tmp/loader_url.txt)

aws ecs run-task \
  --cluster locinsights-cluster \
  --task-definition locinsights-sync:11 \
  --launch-type FARGATE \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["subnet-0fb31153aa7e0576c", "subnet-03d71c375a928d5d5"],
      "securityGroups": ["sg-0f8c9ce9fde40a767"],
      "assignPublicIp": "ENABLED"
    }
  }' \
  --overrides "{
    \"containerOverrides\": [{
      \"name\": \"locinsights-sync\",
      \"command\": [\"bash\", \"-c\", \"set -euo pipefail; curl -sS '$LOADER_URL' -o /tmp/loader.sh && bash /tmp/loader.sh\"]
    }]
  }" \
  --query "tasks[0].taskArn" --output text
