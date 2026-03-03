import csv
import sys
import argparse
from datetime import datetime

try:
    import mysql.connector
except ImportError:
    print("mysql-connector-python not found. Install with: pip install mysql-connector-python")
    sys.exit(1)

CSV_FILE = "Psj Spring 2026 Master schedule - Sheet1.csv"

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS games (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    game_date   DATE NOT NULL,
    game_time   VARCHAR(10),
    location    VARCHAR(50),
    age         VARCHAR(10),
    gender      VARCHAR(10),
    division    VARCHAR(100),
    home_team   VARCHAR(150),
    away_team   VARCHAR(150)
)
"""

INSERT_ROW = """
INSERT INTO games (game_date, game_time, location, age, gender, division, home_team, away_team)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""


def parse_date(raw):
    return datetime.strptime(raw.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")


def parse_time(raw):
    # Strip timezone suffix (EST, EDT) if present
    parts = raw.strip().split()
    return parts[0] if parts else None


def main():
    parser = argparse.ArgumentParser(description="Import soccer schedule CSV into MySQL")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", default="")
    parser.add_argument("--database", default="soccer_schedule")
    args = parser.parse_args()

    conn = mysql.connector.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
    )
    cursor = conn.cursor()
    cursor.execute(CREATE_TABLE)

    inserted = 0
    skipped = 0

    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # skip header row

        for row in reader:
            # Skip blank/separator rows
            if not row[0].strip():
                continue

            try:
                game_date = parse_date(row[0])
                game_time = parse_time(row[1])
                location  = row[2].strip() or None
                age       = row[3].strip() or None
                gender    = row[4].strip() or None
                division  = row[5].strip() or None
                home_team = row[6].strip() or None
                away_team = row[7].strip() or None
            except (ValueError, IndexError) as e:
                print(f"Skipping row {reader.line_num}: {e} — {row}")
                skipped += 1
                continue

            cursor.execute(INSERT_ROW, (game_date, game_time, location, age, gender, division, home_team, away_team))
            inserted += 1

    conn.commit()
    cursor.close()
    conn.close()
    print(f"Done: {inserted} rows inserted, {skipped} skipped.")


if __name__ == "__main__":
    main()
