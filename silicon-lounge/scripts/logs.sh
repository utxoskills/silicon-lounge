#!/bin/bash

# Silicon Lounge 日志脚本

docker-compose -f infra/docker-compose.prod.yml logs -f "$@"