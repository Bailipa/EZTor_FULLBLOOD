module.exports = {
  apps: [{
    name: 'cet4-web',
    script: 'server.js',
    cwd: '/www/wwwroot/114.55.58.90',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
