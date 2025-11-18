require("dotenv").config();
const fs = require("fs");
const yaml = require("js-yaml");
const { Client } = require("pg");
const vaultFactory = require("node-vault");

const MODE = process.env.SECRET_MODE || "env";

function getConfigFromEnv() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "labdb",
    user: process.env.DB_USER || "labuser",
    password: process.env.DB_PASSWORD, 
  };
}

function getConfigFromFile() {
  const file = fs.readFileSync("db_secrets.yaml", "utf8");
  const data = yaml.load(file);
  return {
    host: data.db.host,
    port: Number(data.db.port),
    database: data.db.name,
    user: data.db.user,
    password: data.db.password,
  };
}

async function getConfigFromVault() {
  const vault = vaultFactory({
    endpoint: process.env.VAULT_ADDR || "http://127.0.0.1:8200",
    token: process.env.VAULT_TOKEN,
  });

  const res = await vault.read("secret/data/app/db"); 
  const d = res.data.data;
  return {
    host: d.host,
    port: Number(d.port),
    database: d.name,
    user: d.user,
    password: d.password,
  };
}

async function main() {
  console.log("SECRET_MODE =", MODE);

  let cfg;
  if (MODE === "env") {
    cfg = getConfigFromEnv();
  } else if (MODE === "file") {
    cfg = getConfigFromFile();
  } else if (MODE === "vault") {
    cfg = await getConfigFromVault();
  } else {
    throw new Error("Unknown SECRET_MODE");
  }

  console.log("DB config (without password) =", {
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
  });

  const client = new Client(cfg);
  await client.connect();
  const result = await client.query("SELECT 1");
  console.log("DB SELECT 1 result:", result.rows[0]);
  await client.end();

  console.log("OK: DB connection successful");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
