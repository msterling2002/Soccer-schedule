import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const CSV_FILE = path.join(__dirname, "Psj Spring 2026 Master schedule - Sheet1.csv");

const config = {
  host:     process.env.DB_HOST ?? "localhost",
  port:     parseInt(process.env.DB_PORT ?? "3306"),
  user:     process.env.DB_USER,
  password: process.env.DB_PWD ?? "",
  database: process.env.DB_NAME ?? "soccer_schedule",
};

if (!config.user) {
  console.error("DB_USER is not set in .env");
  process.exit(1);
}

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS games (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    game_date DATE NOT NULL,
    game_time VARCHAR(10),
    location  VARCHAR(50),
    age       VARCHAR(10),
    gender    VARCHAR(10),
    division  VARCHAR(100),
    home_team VARCHAR(150),
    away_team VARCHAR(150)
  )
`;

const INSERT_ROW = `
  INSERT INTO games (game_date, game_time, location, age, gender, division, home_team, away_team)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

function parseDate(raw: string): string {
  const [m, d, y] = raw.trim().split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseTime(raw: string): string {
  // Strip timezone suffix (EST, EDT)
  return raw.trim().split(" ")[0];
}

async function main() {
  const conn = await mysql.createConnection(config);
  await conn.execute(CREATE_TABLE);

  const records: string[][] = await new Promise((resolve, reject) => {
    const rows: string[][] = [];
    fs.createReadStream(CSV_FILE)
      .pipe(parse({ relaxColumnCount: true, skipEmptyLines: false }))
      .on("data", (row: string[]) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });

  // Skip header row
  const dataRows = records.slice(1);

  let inserted = 0;
  let skipped = 0;

  for (const row of dataRows) {
    // Skip blank separator rows
    if (!row[0]?.trim()) continue;

    try {
      const values = [
        parseDate(row[0]),
        parseTime(row[1]),
        row[2]?.trim() || null,
        row[3]?.trim() || null,
        row[4]?.trim() || null,
        row[5]?.trim() || null,
        row[6]?.trim() || null,
        row[7]?.trim() || null,
      ];
      await conn.execute(INSERT_ROW, values);
      inserted++;
    } catch (err) {
      console.warn(`Skipping row: ${err} — ${row}`);
      skipped++;
    }
  }

  await conn.end();
  console.log(`Done: ${inserted} rows inserted, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
