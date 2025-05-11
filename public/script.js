let licores = [];
let carrinho = [];
let vendas = [];
const gastosFixos = {
    acucar: 100,
    garrafas: 215,
    cachaca: 500,
    gas: 130,
    frutas: 30,
    transporteCarro: 80,
    transporteMoto: 8
};

async function carregarLicores() {
    const res = await fetch('/api/licores');
    licores = await res.json();
    exibirLicores();
    atualizarCarrinho();
    carregarVendas(); // Chamada aqui
    atualizarRelatorio();
    calcularValores();
    renderGastos();
}

async function carregarVendas() {
    const res = await fetch('/api/vendas');
    vendas = await res.json();
    atualizarRelatorio();
    calcularValores(); // Pode precisar de ajustes dependendo de como você calcula os valores agora
}

function exibirLicores() {
    const div = document.getElementById('licores');
    div.innerHTML = '';
    licores.forEach(licor => {
        const item = document.createElement('div');
        item.className = 'licor';
        item.innerHTML = `
            <strong>${licor.nome}</strong> - R$${licor.preco}
            | Estoque: ${licor.estoque}
            | Vendidos: ${licor.vendidos}
            <br>
            <input type="number" id="qtd-${licor._id}" value="1" min="1">
            <button class="btn-carrinho-item" onclick='adicionarCarrinho("${licor._id}")'>+ Carrinho</button>
            <button class="btn-estoque-item" onclick='adicionarEstoque("${licor._id}")'>+ Estoque</button>
        `;
        div.appendChild(item);
    });
}

function adicionarCarrinho(id) {
    const licor = licores.find(l => l._id === id);
    if (!licor || licor.estoque <= 0) return alert("Sem estoque!");

    const qtdInput = document.getElementById(`qtd-${id}`);
    const qtd = parseInt(qtdInput.value) || 1;

    const preco = parseFloat(licor.preco);
    if (isNaN(preco)) return alert("Preço inválido para o produto!");

    const existente = carrinho.find(i => i._id === id);
    if (existente) {
        existente.quantidade += qtd;
    } else {
        carrinho.push({ ...licor, preco, quantidade: qtd });
    }

    qtdInput.value = '1'; // limpa o campo
    atualizarCarrinho();
}

function atualizarCarrinho() {
    const ul = document.getElementById('carrinho');
    const totalEl = document.getElementById('total');
    ul.innerHTML = '';
    let total = 0;

    carrinho.forEach(item => {
        const precoComDesconto = calcularPrecoComDesconto(item.preco, item.quantidade);
        ul.innerHTML += `<li>${item.nome} x ${item.quantidade} - R$ ${precoComDesconto.toFixed(2)}</li>`;
        total += precoComDesconto;
    });

    totalEl.textContent = `Total: R$ ${total.toFixed(2)}`;
}

function calcularPrecoComDesconto(precoUnitario, quantidade) {
    const numGruposDeTres = Math.floor(quantidade / 3);
    const quantidadeRestante = quantidade % 3;
    return (numGruposDeTres * 50) + (quantidadeRestante * precoUnitario);
}

function limparCarrinho() {
    if (confirm("Deseja limpar o carrinho?")) {
        carrinho = [];
        atualizarCarrinho();
    }
}

async function finalizarVenda() {
    if (carrinho.length === 0) return;

    if (!confirm("Tem certeza que deseja finalizar a venda?")) return;

    let carrinhoParaVenda = [...carrinho];
    let totalOriginal = carrinhoParaVenda.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

    if (carrinhoParaVenda.reduce((acc, item) => acc + item.quantidade, 0) >= 3) {
        const descontoPorItem = (totalOriginal - 50) / carrinhoParaVenda.reduce((acc, item) => acc + item.quantidade, 0);
        carrinhoParaVenda = carrinhoParaVenda.map(item => ({
            ...item,
            preco: Math.max(0.01, item.preco - descontoPorItem) // Garante que o preço não seja negativo ou zero
        }));
    }

    const res = await fetch('/api/venda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(carrinhoParaVenda)
    });

    if (res.ok) {
        carrinho = [];
        await carregarLicores();
    } else {
        alert("Erro ao finalizar a venda.");
    }
}

async function adicionarEstoque(id) {
    const qtdInput = document.getElementById(`qtd-${id}`);
    const qtd = parseInt(qtdInput.value) || 1;

    for (let i = 0; i < qtd; i++) {
        await fetch(`/api/estoque/${id}`, { method: 'POST' });
    }

    await carregarLicores();
}

function atualizarRelatorio() {
    const ul = document.getElementById('relatorio-vendas');
    if (!ul) return;
    ul.innerHTML = '';

    const ordenadas = [...vendas].sort((a, b) => new Date(b.data) - new Date(a.data));

    const formatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    ordenadas.forEach(venda => {
        const dataFormatada = new Date(venda.data).toLocaleString();
        const itensLista = venda.itens.map(item => `${item.quantidade}x ${item.nome} (${formatter.format(item.preco)})`).join(', ');
        const totalVendaFormatado = formatter.format(venda.total);

        const li = document.createElement('li');
        li.textContent = `${dataFormatada} - Itens: ${itensLista} - Total: ${totalVendaFormatado}`;
        ul.appendChild(li);
    });
}


function calcularValores() {
    // Calcula o valor bruto somando o total de cada venda
    const bruto = vendas.reduce((acc, venda) => {
        return acc + (venda.total || 0); // Garante que se total for undefined, adicione 0
    }, 0);

    const gastos = Object.values(gastosFixos).reduce((acc, v) => {
        if (isNaN(v)) return acc;
        return acc + v;
    }, 0);

    const liquido = bruto - gastos;

    const formatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    document.getElementById('valor-bruto').textContent = formatter.format(bruto);
    document.getElementById('valor-liquido').textContent = formatter.format(liquido);
    document.getElementById('valor-total').textContent = formatter.format(liquido);
}

function renderGastos() {
    const ul = document.getElementById('gastos-list');
    if (!ul) return;
    ul.innerHTML = '';

    const nomesCorrigidos = {
        acucar: 'Açúcar:',
        garrafas: 'Garrafas:',
        cachaca: 'Cachaça:',
        gas: 'Gás:',
        frutas: 'Frutas:',
        transporteCarro: 'Transporte Carro:',
        transporteMoto: 'Transporte Moto:'
    };

    for (const [item, valor] of Object.entries(gastosFixos)) {
        const li = document.createElement('li');
        li.style.display = 'flex'; /* Ativa Flexbox */
        li.style.justifyContent = 'flex-start'; /* Alinha os itens no início */
        li.style.alignItems = 'center'; /* Alinha verticalmente */
        li.innerHTML = `
            ${nomesCorrigidos[item] || item}
            <div style="margin-left: auto;"> R$ ${valor.toFixed(2)}
                <button class="btn-editar-gasto" onclick="editarGasto('${item}')">Editar</button>
            </div>
        `;
        ul.appendChild(li);
    }
}

async function editarGasto(item) {
    const novoValor = prompt(`Novo valor para ${item} (atual: R$${gastosFixos[item]}):`);
    const valor = parseFloat(novoValor);
    if (!isNaN(valor)) {
        gastosFixos[item] = valor;
        renderGastos();
        calcularValores();
        await fetch(`/api/gastos/${item}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor })
        });
    }
}

async function carregarGastos() {
    const res = await fetch('/api/gastos');
    const gastosDoServidor = await res.json();
    let tempGastos = {};
    gastosDoServidor.forEach(gasto => {
        tempGastos[gasto.categoria] = gasto.valor;
    });
    Object.assign(gastosFixos, tempGastos);
    renderGastos();
    calcularValores();
}

async function carregarLicores() {
    const res = await fetch('/api/licores');
    licores = await res.json();
    exibirLicores();
    atualizarCarrinho();
    carregarVendas();
    await carregarGastos(); // Carregar gastos do servidor
    atualizarRelatorio();
    calcularValores();
}

carregarLicores();

async function gerarRelatorio() {
    const relatorioVendasElement = document.getElementById('relatorio-vendas');
    const valorBrutoElement = document.getElementById('valor-bruto');
    const valorLiquidoElement = document.getElementById('valor-liquido');
    const valorTotalElement = document.getElementById('valor-total');

    let historicoVendasHTML = '<h2>Histórico de Vendas</h2><ul>';
    if (vendas && vendas.length > 0) {
        vendas.forEach(venda => {
            const dataVenda = new Date(venda.data).toLocaleDateString() + ' ' + new Date(venda.data).toLocaleTimeString();
            let itensHTML = '<ul>';
            if (venda.itens) { // Adiciona verificação para venda.itens
                venda.itens.forEach(item => {
                    if (item && typeof item.preco === 'number') { // Adiciona verificações para item e item.preco
                        itensHTML += `<li>${item.nome} - Quantidade: ${item.quantidade} - Preço: R$ ${item.preco.toFixed(2)}</li>`;
                    } else {
                        itensHTML += `<li>${item.nome} - Quantidade: ${item.quantidade} - Preço: R$ Valor Inválido</li>`;
                    }
                    
                });
            }
            itensHTML += '</ul>';
            if (typeof venda.total === 'number') { // Adiciona verificação para venda.total
                historicoVendasHTML += `<li><strong>Data:</strong> ${dataVenda} - <strong>Total:</strong> R$ ${venda.total.toFixed(2)} - <strong>Itens:</strong> ${itensHTML}</li>`;
            } else {
                historicoVendasHTML += `<li><strong>Data:</strong> ${dataVenda} - <strong>Total:</strong> R$ Valor Inválido - <strong>Itens:</strong> ${itensHTML}</li>`;
            }
        });
    } else {
        historicoVendasHTML += '<li>Nenhuma venda registrada.</li>';
    }
    historicoVendasHTML += '</ul>';

    const resumoFinanceiroHTML = `
        <h2>Resumo Financeiro</h2>
        <p><strong>Valor Bruto:</strong> R$ ${valorBrutoElement.innerText}</p>
        <p><strong>Valor Líquido:</strong> R$ ${valorLiquidoElement.innerText}</p>
        <p><strong>Valor Total:</strong> R$ ${valorTotalElement.innerText}</p>
    `;

    const conteudoRelatorio = `
        <h1>Relatório de Vendas e Financeiro</h1>
        ${historicoVendasHTML}
        ${resumoFinanceiroHTML}
    `;

    const janelaImpressao = window.open('', '_blank');
    janelaImpressao.document.write(`
        <html>
        <head>
            <title>Relatório de Vendas e Financeiro</title>
            <style>
                body { font-family: Arial, sans-serif; }
                h1, h2 { color: #333; }
                ul { list-style: none; padding: 0; }
                li { margin-bottom: 10px; }
                strong { font-weight: bold; }
            </style>
        </head>
        <body>
            ${conteudoRelatorio}
        </body>
        </html>
    `);
    janelaImpressao.document.close();
    janelaImpressao.print();
}



document.addEventListener('DOMContentLoaded', () => {
    const botaoZerarRelatorio = document.getElementById('zerar-relatorio');
    if (botaoZerarRelatorio) {
        botaoZerarRelatorio.addEventListener('click', zerarRelatorioDeVendas);
    }

    const editarLicoresBtn = document.getElementById('editar-licores-btn');
    if (editarLicoresBtn) {
        editarLicoresBtn.addEventListener('click', carregarInterfaceEdicao);
    }
});

async function zerarRelatorioDeVendas() {
    if (confirm("Tem certeza que deseja zerar o relatório de vendas? Esta ação é irreversível!")) {
        const res = await fetch('/api/vendas', {
            method: 'DELETE',
        });

        if (res.ok) {
            alert("Relatório de vendas zerado com sucesso.");
            await carregarVendas(); // Recarrega as vendas para atualizar a tela
        } else {
            alert("Erro ao zerar o relatório de vendas.");
        }
    }
}









// ... seu código existente ...

async function carregarInterfaceEdicao() {
    const containerEdicao = document.getElementById('edicao-licores-container');
    const listaEdicao = document.getElementById('lista-edicao-licores');
    containerEdicao.style.display = 'block';
    listaEdicao.innerHTML = 'Carregando licores para edição...';

    const res = await fetch('/api/licores');
    const licoresParaEdicao = await res.json();
    renderizarLicoresParaEdicao(licoresParaEdicao);
}

function esconderInterfaceEdicao() {
    const containerEdicao = document.getElementById('edicao-licores-container');
    containerEdicao.style.display = 'none';
}

function renderizarLicoresParaEdicao(licores) {
    const listaEdicao = document.getElementById('lista-edicao-licores');
    listaEdicao.innerHTML = '';

    licores.forEach(licor => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'edit-licor-item';
        itemDiv.innerHTML = `
            <label>Nome:</label>
            <input type="text" id="nome-edit-${licor._id}" value="${licor.nome}">

            <label>Preço:</label>
            <input type="number" id="preco-edit-${licor._id}" value="${licor.preco}">

            <label>Custo:</label>
            <input type="number" id="custo-edit-${licor._id}" value="${licor.custo}">

            <label>Estoque:</label>
            <input type="number" id="estoque-edit-${licor._id}" value="${licor.estoque}">

            <label>Vendidos:</label>
            <input type="number" id="vendidos-edit-${licor._id}" value="${licor.vendidos}">

            <button class="btn-salvar-edicao" onclick="salvarEdicaoLicor('${licor._id}')">Salvar</button>
        `;
        listaEdicao.appendChild(itemDiv);
    });
}

async function salvarEdicaoLicor(id) {
    const nome = document.getElementById(`nome-edit-${id}`).value;
    const preco = parseFloat(document.getElementById(`preco-edit-${id}`).value);
    const custo = parseFloat(document.getElementById(`custo-edit-${id}`).value);
    const estoque = parseInt(document.getElementById(`estoque-edit-${id}`).value);
    const vendidos = parseInt(document.getElementById(`vendidos-edit-${id}`).value);

    const dadosEdicao = { nome, preco, custo, estoque, vendidos };

    const res = await fetch(`/api/licores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosEdicao)
    });

    if (res.ok) {
        alert(`Licor "${nome}" editado com sucesso!`);
        await carregarLicores(); // Recarrega a lista principal de licores
        await carregarInterfaceEdicao(); // Recarrega a lista de edição para mostrar as mudanças
    } else {
        alert(`Erro ao editar o licor "${nome}".`);
    }
}

// ... o resto do seu código ...

