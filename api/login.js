const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Only POST allowed");

  try {
    const { email, password } = req.body;
    const { data: users } = await supabase.from("users").select("*").eq("email", email);

    if (users.length === 0) return res.status(400).json({ error: "Пользователь не найден" });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Неверный пароль" });

    const token = jwt.sign({ id: user.id, full_name: user.full_name }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ token, full_name: user.full_name });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
