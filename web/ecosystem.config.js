module.exports = {
  apps: [
    {
      name: 'fce-quiz',
      cwd: '/var/www/fce-quiz/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      min_uptime: '10s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
