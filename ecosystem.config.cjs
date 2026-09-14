module.exports = {
  apps: [{
    name: 'tatipos',
    cwd: '/home/ubuntu/tatipos',
    script: 'server/index.js',
    node_args: '--no-warnings',
    env: { NODE_ENV: 'production', PUERTO: '3520', TZ: 'America/Bogota' },
    max_memory_restart: '300M',
    time: true,
  }],
};
