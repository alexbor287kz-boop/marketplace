const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  title: String,
  description: String
});

module.exports = mongoose.model("Item", ItemSchema);
