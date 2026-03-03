const express = require("express");
const session = require("express-session");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET ?? "soccer-secret",
  resave: false,
  saveUninitialized: false,
}));

const pool = mysql.createPool({
  host:     process.env.DB_HOST ?? "localhost",
  port:     parseInt(process.env.DB_PORT ?? "3306"),
  user:     process.env.DB_USER,
  password: process.env.DB_PWD ?? "",
  database: process.env.DB_NAME ?? "soccer_schedule",
});

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect("/login");
}

// List all games
app.get("/", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM games ORDER BY game_date, game_time");
  res.render("index", { games: rows, isAdmin: !!req.session.isAdmin });
});

// Login form
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PWD) {
    req.session.isAdmin = true;
    return res.redirect("/");
  }
  res.render("login", { error: "Invalid credentials" });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Create form
app.get("/games/new", requireAdmin, (req, res) => {
  res.render("form", { game: null, action: "/games" });
});

// Create game
app.post("/games", requireAdmin, async (req, res) => {
  const { game_date, game_time, location, age, gender, division, home_team, away_team } = req.body;
  await pool.query(
    "INSERT INTO games (game_date, game_time, location, age, gender, division, home_team, away_team) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [game_date, game_time, location, age, gender, division, home_team, away_team]
  );
  res.redirect("/");
});

// Edit form
app.get("/games/:id/edit", requireAdmin, async (req, res) => {
  const [[game]] = await pool.query("SELECT * FROM games WHERE id = ?", [req.params.id]);
  if (!game) return res.status(404).send("Not found");
  res.render("form", { game, action: `/games/${game.id}/update` });
});

// Update game
app.post("/games/:id/update", requireAdmin, async (req, res) => {
  const { game_date, game_time, location, age, gender, division, home_team, away_team } = req.body;
  await pool.query(
    "UPDATE games SET game_date=?, game_time=?, location=?, age=?, gender=?, division=?, home_team=?, away_team=? WHERE id=?",
    [game_date, game_time, location, age, gender, division, home_team, away_team, req.params.id]
  );
  res.redirect("/");
});

// Delete game
app.post("/games/:id/delete", requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM games WHERE id = ?", [req.params.id]);
  res.redirect("/");
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
