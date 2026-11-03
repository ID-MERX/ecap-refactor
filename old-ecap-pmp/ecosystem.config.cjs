module.exports = {
  apps: [
    {
      name: "ecap-plus-pmp",
      cwd: __dirname,
      script: "npm",
      args: "run preview -- --host 0.0.0.0 --port 3040 --strictPort",
      env: {
        NODE_ENV: "production",
        PORT: "3040",
      },
      watch: false,
      instances: 1,
      exec_mode: "fork",
      error_file: "./logs/pm2-err.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
    },
  ],
};
