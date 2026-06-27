import { Connection } from "@solana/web3.js";

export function getConnection(): Connection {
  const url =
    process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}
