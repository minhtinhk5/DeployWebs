module.exports = {
  apps: [{
    name: 'studynotion',
    script: 'npm',
    args: 'start',
    cwd: '/home/deploy/apps/studynotion',
    env: { NODE_ENV: 'production', PORT: 3000 },
    max_memory_restart: '600M',
    autorestart: true,
    out_file: '/home/deploy/logs/studynotion.out.log',
    error_file: '/home/deploy/logs/studynotion.err.log',
    time: true
  }]
};
