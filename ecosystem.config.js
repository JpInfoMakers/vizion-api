module.exports = {
  apps: [
    {
      name: "vizion",
      script: "dist/main.js",
      node_args: "-r tsconfig-paths/register",
      env: { NODE_ENV: "production" }
    }
  ]
}