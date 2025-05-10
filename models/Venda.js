const mongoose = require('mongoose');

const ItemVendidoSchema = new mongoose.Schema({
    nome: String,
    quantidade: Number,
    preco: Number
});

const VendaSchema = new mongoose.Schema({
    itens: [ItemVendidoSchema],
    total: Number,
    data: Date
});

module.exports = mongoose.model('Venda', VendaSchema);