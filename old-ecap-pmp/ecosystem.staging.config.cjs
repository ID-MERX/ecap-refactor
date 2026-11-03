module.exports = {
  apps: [
    {
      name: "ecap-plus-pmp-staging",
      cwd: __dirname,
      script: "npm",
      args: "run preview -- --host 0.0.0.0 --port 3041 --strictPort",
      env: {
        NODE_ENV: "production",
        APP_ENV: "staging",
        PORT: "3041",
      },
      watch: false,
      instances: 1,
      exec_mode: "fork",
      error_file: "./logs/staging-pm2-err.log",
      out_file: "./logs/staging-pm2-out.log",
      merge_logs: true,
    },
  ],
};
