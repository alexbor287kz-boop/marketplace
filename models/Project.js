const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  title: String,
  description: String,
  author: String,
  language: String,    // на чем написан проект
  link: String         // ссылка на проект
});

module.exports = mongoose.model("Project", ProjectSchema);
