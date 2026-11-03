module.exports = {
  apps: [
    {
      name: "ecap-plus-pmp-backend",
      script: "server.js", // Adjust if your entry point is different
      instances: 1, // Adjust based on your server's capabilities
      autorestart: true,
      watch: false, // Set to true if you want PM2 to watch for file changes
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development", // or "production" based on your environment
        PORT: 9003, // Set to new port
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 9003, // Set to new port
      },
    },
  ],
};