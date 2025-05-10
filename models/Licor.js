const mongoose = require('mongoose');

const licorSchema = new mongoose.Schema({
  nome: String,
  preco: Number,
  custo: Number,
  estoque: Number,
  vendidos: Number
});

module.exports = mongoose.model('Licor', licorSchema);
