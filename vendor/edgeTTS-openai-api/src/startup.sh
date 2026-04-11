#!/bin/sh

cat $HOMEDIR/edgeTTS-openai-api/src/api/.env

# 检查 OPENAI_EDGE_TTS_INSTALL是否为true
if [ "$OPENAI_EDGE_TTS_INSTALL" = true ]; then
    cd ${HOMEDIR}/edgeTTS-openai-api/src/api    
    # 先尝试删除已存在的实例
    pm2 delete openai-edge-tts 2>/dev/null || true
    # 启动新的实例
    pm2 start python --name openai-edge-tts -- ${HOMEDIR}/edgeTTS-openai-api/src/api/app/server.py
    pm2 save
fi

cd ${HOMEDIR}

# 只输出日志
pm2 logs --lines 50
