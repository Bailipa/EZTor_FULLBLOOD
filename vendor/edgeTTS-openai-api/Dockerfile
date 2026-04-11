FROM nikolaik/python-nodejs:python3.10-nodejs20

# 添加 CACHEBUST 参数
ARG CACHEBUST=1

ENV USER=pn \
    HOMEDIR=/home/pn \
    PORT=7860 \
    SSHX_INSTALL=true \
    OPENAI_EDGE_TTS_INSTALL=true

RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils \
    build-essential \
    libpq-dev \
    neofetch \
    git \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*

WORKDIR ${HOMEDIR}

# 使用 CACHEBUST 参数来强制更新
RUN git clone https://github.com/aigem/edgeTTS-openai-api.git \
    && chmod +x ${HOMEDIR}/edgeTTS-openai-api/src/*.sh \
    && ls -la ${HOMEDIR}/edgeTTS-openai-api/src \
    && ls -la ${HOMEDIR}/edgeTTS-openai-api \
    && ${HOMEDIR}/edgeTTS-openai-api/src/setup.sh \
    && if [ "$SSHX_INSTALL" = true ]; then ${HOMEDIR}/edgeTTS-openai-api/src/sshx.sh; fi \
    && if [ "$OPENAI_EDGE_TTS_INSTALL" = true ]; then ${HOMEDIR}/edgeTTS-openai-api/src/openai-edge-tts.sh; fi

# 暴露 Remix 端口
EXPOSE ${PORT}

# 在启动时设置 API_KEY 环境变量
ENTRYPOINT /home/pn/edgeTTS-openai-api/src/startup.sh
