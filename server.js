require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt'); // Se você decidir usar para senhas reais

const Licor = require('./models/Licor');
const Venda = require('./models/Venda');
const Gasto = require('./models/Gastos');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Para processar dados do formulário

// Configurar sessão
app.use(session({
    secret: 'seu_segredo_super_secreto',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Middleware para verificar se o usuário está logado
const requireLogin = (req, res, next) => {
    if (req.session.loggedIn) {
        next(); // Usuário logado, permite o acesso à próxima rota
    } else {
        res.redirect('/login'); // Usuário não logado, redireciona para a página de login
    }
};

// Rotas de login e logout
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const correctUsername = 'Nair Barbosa';
    const correctPassword = '10061996';

    if (username === correctUsername && password === correctPassword) {
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.send('Credenciais inválidas. <a href="/login">Tentar novamente</a>');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Erro ao fazer logout:', err);
        }
        res.redirect('/login');
    });
});

// Protege a rota principal
app.get('/', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servir arquivos estáticos PUBLICAMENTE (incluindo a página de login)
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB conectado'))
    .catch(err => console.error(err));

app.get('/api/licores', async (req, res) => {
    const licores = await Licor.find();
    res.json(licores);
});

app.put('/api/licores/:id', requireLogin, async (req, res) => {
    const { nome, preco, custo, estoque, vendidos } = req.body;
    try {
        const licorAtualizado = await Licor.findByIdAndUpdate(
            req.params.id,
            { nome, preco, custo, estoque, vendidos },
            { new: true } // Retorna o documento atualizado
        );
        if (licorAtualizado) {
            res.json(licorAtualizado);
        } else {
            res.status(404).send('Licor não encontrado');
        }
    } catch (error) {
        console.error('Erro ao atualizar licor:', error);
        res.status(500).send('Erro ao atualizar licor');
    }
});

app.post('/api/venda', async (req, res) => {
    const itensVendidos = req.body;

    if (itensVendidos.length === 0) {
        return res.status(400).send('Carrinho vazio.');
    }

    let totalVenda = 0;
    const itensComDesconto = [];
    
    // Variáveis para o cálculo total de licores (independente do sabor)
    let totalLicores = 0;

    try {
        const carrinhoAgrupado = {};
        for (const item of itensVendidos) {
            if (!carrinhoAgrupado[item._id]) {
                carrinhoAgrupado[item._id] = { ...item, quantidade: 0 };
            }
            carrinhoAgrupado[item._id].quantidade += item.quantidade;
            totalLicores += item.quantidade; // Soma total de licores
        }

        // Calculando o total geral com desconto com base na quantidade total de licores
        const precoFinalComDesconto = calcularPrecoComDesconto(totalLicores);

        // Agora vamos calcular o valor por item, aplicando o desconto proporcionalmente
        for (const id in carrinhoAgrupado) {
            const item = carrinhoAgrupado[id];
            const { nome, preco, quantidade } = item;
            const precoUnitarioComDesconto = precoFinalComDesconto / totalLicores * quantidade; // Aplica desconto proporcional

            totalVenda += precoUnitarioComDesconto; // Soma o preço do item com desconto
            itensComDesconto.push({
                _id: id,
                nome,
                quantidade,
                preco: precoUnitarioComDesconto / quantidade // Preço médio por unidade após o desconto
            });

            // Atualizar o estoque dos licores vendidos
            const licor = await Licor.findById(id);
            if (licor) {
                licor.estoque -= quantidade;
                licor.vendidos += quantidade;
                await licor.save();
            }
        }

        const novaVenda = new Venda({
            itens: itensComDesconto,
            total: totalVenda, // O total da venda
            data: new Date()
        });

        const vendaSalva = await novaVenda.save();

        res.status(200).json({ message: 'Venda registrada com sucesso', venda: vendaSalva });

    } catch (err) {
        console.error('Erro ao registrar venda:', err);
        res.status(500).send('Erro ao registrar venda');
    }
});

// Função para calcular o total com base no número total de licores
function calcularPrecoComDesconto(totalLicores) {
    const gruposDeTres = Math.floor(totalLicores / 3);
    const restante = totalLicores % 3;

    // Aplica R$50 por cada 3 licores, R$20 por cada licor restante
    return (gruposDeTres * 50) + (restante * 20);  
}



app.post('/api/estoque/:id', async (req, res) => {
    const licor = await Licor.findById(req.params.id);
    if (licor) {
        licor.estoque += 1;
        await licor.save();
        res.json(licor);
    } else {
        res.sendStatus(404);
    }
});

// Relatório de vendas
app.get('/api/vendas', async (req, res) => {
    const vendas = await Venda.find().sort({ data: -1 });
    res.json(vendas);
});

// Nova rota para zerar o relatório de vendas
app.delete('/api/vendas', requireLogin, async (req, res) => {
    try {
        await Venda.deleteMany({});
        res.status(200).json({ message: 'Relatório de vendas zerado com sucesso.' });
    } catch (error) {
        console.error('Erro ao zerar o relatório de vendas:', error);
        res.status(500).json({ message: 'Erro ao zerar o relatório de vendas.' });
    }
});

// Gastos
app.get('/api/gastos', async (req, res) => {
    const gastos = await Gasto.find();
    res.json(gastos);
});

app.post('/api/gastos/:categoria', async (req, res) => {
    const { valor } = req.body;
    const categoria = req.params.categoria;
    const gasto = await Gasto.findOneAndUpdate({ categoria }, { valor }, { new: true, upsert: true });
    res.json(gasto);
});

// Inicializar dados (apenas uma vez)
app.get('/init', async (req, res) => {
    await Licor.deleteMany();
    await Venda.deleteMany();
    await Gasto.deleteMany();

    await Licor.insertMany([
        { nome: "Licor de Tamarindo Verde", preco: 20, custo: 12, estoque: 48, vendidos: 0 },
        { nome: "Licor de Caja", preco: 20, custo: 12, estoque: 0, vendidos: 0 },
        { nome: "Licor de Jenipapo", preco: 20, custo: 12, estoque: 0, vendidos: 0 },
        { nome: "Licor de Tamarindo", preco: 20, custo: 12, estoque: 0, vendidos: 0 },
        { nome: "Licor de Maracujá", preco: 20, custo: 12, estoque: 0, vendidos: 0 }
    ]);

    await Gasto.insertMany([
        { categoria: "acucar", valor: 100 },
        { categoria: "garrafas", valor: 215 },
        { categoria: "cachaca", valor: 500 },
        { categoria: "gas", valor: 130 },
        { categoria: "frutas", valor: 30 },
        { categoria: "transporteCarro", valor: 80 },
        { categoria: "transporteMoto", valor: 8 }
    ]);

    res.send('Dados inseridos');
});

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});