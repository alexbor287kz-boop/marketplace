require('dotenv').config({ path: './.env' });
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const multer = require('multer');

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage }); // файлы хранятся в памяти

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ---------------- Supabase ----------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);


const PORT = process.env.PORT || 3000;

// ---------------- Middleware ----------------
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

// ---------------- CRUD Products ----------------

// Получить все продукты
app.get("/api/products", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(`*, users:owner_id(full_name)`)
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

// Добавить продукт
app.post("/api/products", authMiddleware, async (req, res) => {
  try {
    const owner_id = req.user.id;
    const { title, short_description, icon_url, category, product_type, tags, product_url, media } = req.body;

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

    const { data, error } = await supabase.from("products").insert([newProduct]).select();
    if (error) return res.status(500).json({ error: error.message });

    const productId = data[0].id;

    // Добавляем медиа
    if (media && Array.isArray(media) && media.length > 0) {
      for (const m of media) {
        await supabase.from('media').insert([{ product_id: productId, type: m.type, url: m.url }]);
      }
    }

    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// Загрузка медиа
app.post("/api/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Файл не передан" });

    console.log("Загружаем файл:", req.file.originalname, req.file.mimetype);

    // Безопасное имя файла
    const safeName = req.file.originalname
      .replace(/\s+/g, "_")       // пробелы → _
      .replace(/[^\w.-]/g, "");   // удаляем все кроме букв, цифр, _, . и -
    const fileName = `${Date.now()}_${safeName}`; // имя файла без папок

    // Загружаем файл в публичный бакет
    const { data, error } = await supabase
      .storage
      .from("media")             // имя бакета
      .upload(fileName, req.file.buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: req.file.mimetype
      });

    if (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Получаем публичный URL
    const { data: publicData, error: urlError } = supabase
      .storage
      .from("media")
      .getPublicUrl(fileName);

    if (urlError) {
      console.error("URL error:", urlError);
      return res.status(500).json({ error: urlError.message });
    }

    // Отправляем URL клиенту
    res.json({ url: publicData.publicUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



// Получить один продукт с медиа
app.get("/api/products/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("products")
      .select(`*, media(*), users:owner_id(full_name)`)
      .eq("id", id)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Редактировать продукт
app.put("/api/products/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    delete updateData.media; // медиа отдельно

    const { data, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Добавить медиа к продукту
app.post("/api/products/:id/media", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, url } = req.body;

    if (!type || !url) return res.status(400).json({ error: "Не передан type или url" });

    const { data, error } = await supabase
      .from("media")
      .insert([{ product_id: id, type, url }])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Удалить медиа
app.delete("/api/products/:productId/media/:mediaId", authMiddleware, async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { data, error } = await supabase
      .from("media")
      .delete()
      .eq("id", mediaId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Медиа удалено" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Удалить продукт
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("products").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- AUTH ----------------

// Регистрация
app.post("/api/register", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password)
      return res.status(400).json({ error: "Все поля обязательны" });

    const { data: exists } = await supabase.from("users").select("id").eq("email", email);
    if (exists.length > 0) return res.status(400).json({ error: "Email уже используется" });

    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from("users").insert([{ full_name, email, password_hash }]).select();
    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Регистрация успешна" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Вход
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: users } = await supabase.from("users").select("*").eq("email", email);
    if (users.length === 0) return res.status(400).json({ error: "Пользователь не найден" });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Неверный пароль" });

    const token = jwt.sign({ id: user.id, full_name: user.full_name }, JWT_SECRET, { expiresIn: "2h" });

    res.json({ token, full_name: user.full_name, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- Start Server ----------------
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
