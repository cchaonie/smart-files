module.exports = {
  apps: [{
    name: 'smart-files-backend',
    script: './packages/backend/dist/main.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/backend-error.log',
    out_file: './logs/backend-out.log',
    merge_logs: true,
    pid_file: './pids/backend.pid',
    env: {
      NODE_ENV: 'production',
    },
  }]
};
