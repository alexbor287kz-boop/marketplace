const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res) {
  const header = req.headers.authorization;
  if (!header) return null;
  const token = header.split(" ")[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("products")
      .select("*, users:owner_id(full_name)")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const products = data.map(p => ({ ...p, owner_name: p.users?.full_name || "Неизвестен" }));
    return res.json(products);
  }

  if (req.method === "POST") {
    const user = authMiddleware(req, res);
    if (!user) return res.status(401).json({ error: "Нет токена" });

    const { title, short_description, icon_url, category, product_type, tags, product_url } = req.body;
    const newProduct = {
      owner_id: user.id,
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
    res.json(data[0]);
  }
};
