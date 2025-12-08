const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
  const id = req.query.id;

  if (req.method === "PUT") {
    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("products").update(updateData).eq("id", id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }

  if (req.method === "DELETE") {
    const { data, error } = await supabase.from("products").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ message: "Deleted" });
  }

  res.status(405).send("Method Not Allowed");
};
