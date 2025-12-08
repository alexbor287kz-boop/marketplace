console.log("🔥 Server code updated! Version 1.1");


require('dotenv').config({ path: './.env' });
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ---------------- Supabase ----------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = process.env.PORT || 3000;

// ---------------- CRUD Products ----------------

// Получить все продукты с именем владельца
app.get("/api/products", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        users:owner_id (full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const products = data.map(p => ({
      ...p,
      owner_name: p.users?.full_name || "Неизвестен"
    }));

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Добавить продукт — теперь через токен (автоматически берётся owner_id)
app.post("/api/products", authMiddleware, async (req, res) => {
  try {
    const owner_id = req.user.id; // получаем из токена

    const { title, short_description, icon_url, category, product_type, tags, product_url } = req.body;

    const newProduct = {
      owner_id,
      title,
      short_description,
      icon_url,
      category,
      product_type,
      tags: tags ? tags.split(",").map(t => t.trim()) : [],
      product_url
    };

    const { data, error } = await supabase
      .from("products")
      .insert([newProduct])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});



// Редактировать продукт
app.put("/api/products/:id", async (req, res) => {
  try {
    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("products").update(updateData).eq("id", req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Удалить продукт
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("products").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



// ---------------- AUTH ----------------

// Регистрация нового пользователя
app.post("/api/register", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password)
      return res.status(400).json({ error: "Все поля обязательны" });

    // проверяем email
    const { data: exists } = await supabase
      .from("users")
      .select("id")
      .eq("email", email);

    if (exists.length > 0)
      return res.status(400).json({ error: "Email уже используется" });

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([{ full_name, email, password_hash }])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Регистрация успешна" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Вход пользователя
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: users } = await supabase
      .from("users")
      .select("*")
      .eq("email", email);

    if (users.length === 0)
      return res.status(400).json({ error: "Пользователь не найден" });

    const user = users[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Неверный пароль" });

    const token = jwt.sign(
      { id: user.id, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ token, full_name: user.full_name });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


// Middleware для проверки токена
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Нет токена" });

  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Неверный токен" });
  }
}



// ---------------- Start Server ----------------
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
