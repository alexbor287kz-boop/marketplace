const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Only POST allowed");

  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: "Все поля обязательны" });

    const { data: exists } = await supabase.from("users").select("id").eq("email", email);
    if (exists.length > 0) return res.status(400).json({ error: "Email уже используется" });

    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from("users").insert([{ full_name, email, password_hash }]).select();
    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Регистрация успешна" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
