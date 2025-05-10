const mongoose = require('mongoose');

const GastoSchema = new mongoose.Schema({
  categoria: String,
  valor: Number
});

module.exports = mongoose.model('Gasto', GastoSchema);
