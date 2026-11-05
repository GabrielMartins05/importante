(function () {
    'use strict';

    const STORAGE_KEY = 'painel_dados';
    const STORAGE_KEY_CONCLUIDOS = 'painel_mostrar_concluidos';

    const ICONE = {
        check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
        mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.500" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18.500" cy="12" r="2"/></svg>',
        x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    };

    const $ = (id) => document.getElementById(id);

    function estadoPadrao() {
        return { topicos: [], itens: [], proximoTopicoId: 1, proximoItemId: 1 };
    }

    function ler(chave) {
        try { return localStorage.getItem(chave); } catch (e) { return null; }
    }

    function carregarEstado() {
        try {
            const bruto = ler(STORAGE_KEY);
            if (bruto) return Object.assign(estadoPadrao(), JSON.parse(bruto));
        } catch (e) { /* dado ilegível: começa do que houver abaixo */ }
        return window.PAINEL_INICIAL ? JSON.parse(JSON.stringify(window.PAINEL_INICIAL)) : estadoPadrao();
    }

    let estado = carregarEstado();
    let mostrarConcluidos = ler(STORAGE_KEY_CONCLUIDOS) === '1';
    let avisouFalha = false;

    function salvarEstado() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
        } catch (e) {
            if (!avisouFalha) {
                avisouFalha = true;
                avisar('Não consegui salvar neste navegador. Libere espaço e tente de novo.');
            }
        }
    }

    function hojeISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    let timerAviso = null;
    let copiaDesfazer = null;

    function avisar(texto, podeDesfazer) {
        $('aviso-texto').textContent = texto;
        $('aviso-desfazer').hidden = !podeDesfazer;
        $('aviso').hidden = false;
        clearTimeout(timerAviso);
        timerAviso = setTimeout(() => { $('aviso').hidden = true; copiaDesfazer = null; }, podeDesfazer ? 6000 : 3500);
    }

    function guardarCopia() {
        copiaDesfazer = JSON.stringify(estado);
    }

    let animar = null; // { id, classe } do item que anima no próximo desenho da lista.

    function sairDaLista(item) {
        const texto = $(`item-${item.id}`), linha = texto && texto.closest('.item');
        if (!linha || matchMedia('(prefers-reduced-motion: reduce)').matches) { atualizarCartao(item.topico_id); return; }
        linha.classList.add('saindo');
        setTimeout(() => atualizarCartao(item.topico_id), 260);
    }

    function itensDoTopico(topicoId) {
        return estado.itens.filter((i) => i.topico_id === topicoId);
    }

    function itensVisiveis(topicoId) {
        return itensDoTopico(topicoId)
            .filter((i) => mostrarConcluidos || !i.concluido)
            .sort((a, b) => (a.concluido - b.concluido) || (b.id - a.id));
    }

    function criarItem(topicoId, titulo) {
        estado.itens.push({ id: estado.proximoItemId++, topico_id: topicoId, titulo, concluido: 0, criado_em: hojeISO() });
        animar = { id: estado.proximoItemId - 1, classe: 'entrando' };
        salvarEstado();
        atualizarCartao(topicoId);
    }

    function alternarItem(item) {
        guardarCopia();
        item.concluido = item.concluido ? 0 : 1;
        salvarEstado();
        if (item.concluido && !mostrarConcluidos) sairDaLista(item);
        else {
            animar = { id: item.id, classe: 'marcando' };
            atualizarCartao(item.topico_id);
        }
        if (item.concluido) avisar(`Concluído: ${item.titulo}`, true);
        else { copiaDesfazer = null; $('aviso').hidden = true; }
    }

    function apagarItem(item) {
        guardarCopia();
        estado.itens = estado.itens.filter((i) => i.id !== item.id);
        salvarEstado();
        sairDaLista(item);
        avisar(`Excluído: ${item.titulo}`, true);
    }

    function el(tag, props, filhos) {
        const elemento = document.createElement(tag);
        Object.entries(props || {}).forEach(([chave, valor]) => {
            if (chave === 'class') elemento.className = valor;
            else if (chave === 'text') elemento.textContent = valor;
            else if (chave === 'html') elemento.innerHTML = valor;
            else elemento.setAttribute(chave, valor);
        });
        (filhos || []).forEach((filho) => filho && elemento.appendChild(filho));
        return elemento;
    }

    function ajustarAltura(area) {
        area.style.height = 'auto';
        area.style.height = `${area.scrollHeight}px`;
    }

    function linhaItem(item) {
        const marcar = el('button', {
            type: 'button',
            class: 'marcar',
            role: 'checkbox',
            'aria-checked': String(!!item.concluido),
            'aria-label': `Concluir ${item.titulo}`,
        }, [el('span', { html: ICONE.check })]);
        marcar.addEventListener('click', () => alternarItem(item));

        const texto = el('textarea', { id: `item-${item.id}`, class: 'item-texto', rows: '1', 'aria-label': 'Texto do item' });
        texto.value = item.titulo;
        texto.addEventListener('input', () => ajustarAltura(texto));
        texto.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); texto.blur(); }
        });
        texto.addEventListener('blur', () => {
            const novo = texto.value.replace(/\s+/g, ' ').trim();
            if (novo && novo !== item.titulo) {
                item.titulo = novo;
                salvarEstado();
            }
            texto.value = item.titulo;
            ajustarAltura(texto);
        });

        const excluir = el('button', { type: 'button', class: 'btn-icone', 'aria-label': `Excluir ${item.titulo}`, html: ICONE.x });
        excluir.addEventListener('click', () => apagarItem(item));

        const extra = animar && animar.id === item.id ? ` ${animar.classe}` : '';
        return el('li', { class: `item${item.concluido ? ' feito' : ''}${extra}` }, [marcar, texto, excluir]);
    }

    function textoContagem(topicoId) {
        const todos = itensDoTopico(topicoId), feitos = todos.filter((i) => i.concluido).length, faltam = todos.length - feitos;
        if (!todos.length) return '0 a fazer';
        if (!feitos) return faltam === 1 ? '1 a fazer' : `${faltam} a fazer`;
        return `${feitos} de ${todos.length} ${todos.length === 1 ? 'feito' : 'feitos'}`;
    }

    function atualizarResumo() {
        const faltam = estado.itens.filter((i) => !i.concluido).length, cats = estado.topicos.length;
        const parte1 = faltam === 1 ? '1 coisa esperando' : `${faltam} coisas esperando`;
        $('resumo').textContent = cats ? `${parte1} em ${cats} ${cats === 1 ? 'categoria' : 'categorias'}` : 'Crie sua primeira categoria';
    }

    function atualizarCartao(topicoId) {
        const cartao = document.querySelector(`[data-topico="${topicoId}"]`);
        if (!cartao) return;
        const todos = itensDoTopico(topicoId), feitos = todos.filter((i) => i.concluido).length;
        cartao.querySelector('.contagem').textContent = textoContagem(topicoId);

        const barra = cartao.querySelector('.progresso');
        barra.hidden = !feitos;
        barra.firstChild.style.width = `${todos.length ? Math.round(feitos / todos.length * 100) : 0}%`;

        const lista = cartao.querySelector('.lista');
        lista.innerHTML = '';
        const visiveis = itensVisiveis(topicoId);
        if (visiveis.length) visiveis.forEach((item) => lista.appendChild(linhaItem(item)));
        else lista.appendChild(el('li', { class: 'vazio', text: todos.length ? 'Tudo feito por aqui.' : 'Nada aqui ainda.' }));
        lista.querySelectorAll('.item-texto').forEach(ajustarAltura);
        animar = null;
        atualizarResumo();
    }

    function cartaoTopico(topico) {
        const editar = el('button', { type: 'button', class: 'btn-icone', 'aria-label': `Editar ${topico.nome}`, html: ICONE.mais });
        editar.addEventListener('click', () => abrirCategoria(topico));

        const campo = el('input', { type: 'text', id: `novo-${topico.id}`, placeholder: 'Adicionar item', 'aria-label': `Adicionar item em ${topico.nome}`, autocomplete: 'off' });
        const form = el('form', { class: 'adicionar' }, [el('button', { type: 'submit', 'aria-label': 'Adicionar' }, [el('span', { text: '+' })]), campo]);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const titulo = campo.value.trim();
            if (titulo) criarItem(topico.id, titulo);
            campo.value = '';
            campo.focus(); // O campo fica pronto para o próximo item.
        });

        return el('section', { class: `cartao cor-${topico.id % 8}`, 'data-topico': topico.id, style: `--ordem: ${estado.topicos.indexOf(topico)}` }, [
            el('div', { class: 'cartao-topo' }, [
                el('div', { class: 'cartao-titulo' }, [el('h2', { text: topico.nome }), el('p', { class: 'contagem' })]),
                editar,
            ]),
            el('div', { class: 'progresso' }, [el('i')]),
            el('div', { class: 'caixa' }, [el('ul', { class: 'lista' }), form]),
        ]);
    }

    function renderizar() {
        const grid = $('grid-topicos');
        grid.innerHTML = '';
        if (!estado.topicos.length) grid.appendChild(el('p', { class: 'sem-categorias', text: 'Crie uma categoria, como Comprar ou Filmes, para começar.' }));
        estado.topicos.forEach((topico) => {
            grid.appendChild(cartaoTopico(topico));
            atualizarCartao(topico.id);
        });
        atualizarResumo();
        $('btn-toggle-concluidos').setAttribute('aria-checked', String(mostrarConcluidos));
    }

    let emEdicao = null;
    let excluirArmado = false;

    function desarmarExclusao() {
        excluirArmado = false;
        const b = $('btn-excluir-categoria');
        b.textContent = 'Excluir';
        b.classList.remove('armado');
    }

    function abrirCategoria(topico) {
        emEdicao = topico || null;
        desarmarExclusao();
        $('dlg-categoria-titulo').textContent = topico ? 'Editar categoria' : 'Nova categoria';
        $('input-nome-topico').value = topico ? topico.nome : '';
        $('btn-excluir-categoria').hidden = !topico;
        $('btn-organizar').hidden = !topico;
        $('erro-categoria').hidden = true;
        $('dlg-categoria').showModal();
    }

    function erroCategoria(texto) {
        $('erro-categoria').textContent = texto;
        $('erro-categoria').hidden = false;
    }

    $('form-categoria').addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = $('input-nome-topico').value.trim();
        if (!nome) { erroCategoria('Dê um nome para a categoria.'); return; }
        if (emEdicao) emEdicao.nome = nome;
        else estado.topicos.push({ id: estado.proximoTopicoId++, nome, data_inicio: hojeISO(), data_limite: null });
        salvarEstado();
        $('dlg-categoria').close();
        renderizar();
    });

    $('btn-cancelar-categoria').addEventListener('click', () => $('dlg-categoria').close());

    $('btn-excluir-categoria').addEventListener('click', () => {
        const qtd = itensDoTopico(emEdicao.id).length, b = $('btn-excluir-categoria');
        if (!excluirArmado) {
            excluirArmado = true;
            b.textContent = qtd === 0 ? 'Confirmar exclusão' : qtd === 1 ? 'Excluir com 1 item' : `Excluir com ${qtd} itens`;
            b.classList.add('armado');
            return;
        }
        guardarCopia();
        const nome = emEdicao.nome, id = emEdicao.id;
        estado.topicos = estado.topicos.filter((t) => t.id !== id);
        estado.itens = estado.itens.filter((i) => i.topico_id !== id);
        salvarEstado();
        $('dlg-categoria').close();
        renderizar();
        avisar(`Categoria excluída: ${nome}`, true);
    });

    $('btn-exportar').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ app: 'apenas-comece', estado })], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: `apenas-comece-${hojeISO()}.json` });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

    let backupLido = null;
    $('btn-importar').addEventListener('click', () => $('input-backup').click());
    $('input-backup').addEventListener('change', (e) => {
        const arquivo = e.target.files[0];
        e.target.value = '';
        if (!arquivo) return;
        const leitor = new FileReader();
        leitor.onload = () => {
            let dados = null;
            try { dados = JSON.parse(leitor.result); } catch (err) { /* tratado abaixo */ }
            const novo = dados && dados.app === 'apenas-comece' && dados.estado;
            if (!novo || !Array.isArray(novo.topicos) || !Array.isArray(novo.itens)) {
                avisar('Esse arquivo não é um backup deste painel.');
                return;
            }
            backupLido = novo;
            $('dlg-confirmar-texto').textContent = `Ele tem ${novo.topicos.length} categorias e ${novo.itens.length} itens, e substitui o que está neste navegador.`;
            $('dlg-confirmar').showModal();
        };
        leitor.readAsText(arquivo);
    });
    $('btn-confirmar-nao').addEventListener('click', () => $('dlg-confirmar').close());
    $('btn-confirmar-sim').addEventListener('click', () => {
        guardarCopia();
        estado = Object.assign(estadoPadrao(), backupLido);
        salvarEstado();
        $('dlg-confirmar').close();
        renderizar();
        avisar('Backup importado.', true);
    });

    $('btn-nova-categoria').addEventListener('click', () => abrirCategoria(null));

    $('btn-toggle-concluidos').addEventListener('click', () => {
        mostrarConcluidos = !mostrarConcluidos;
        try { localStorage.setItem(STORAGE_KEY_CONCLUIDOS, mostrarConcluidos ? '1' : '0'); } catch (e) { /* só uma preferência */ }
        renderizar();
    });

    $('aviso-desfazer').addEventListener('click', () => {
        if (!copiaDesfazer) return;
        estado = JSON.parse(copiaDesfazer);
        copiaDesfazer = null;
        salvarEstado();
        renderizar();
        $('aviso').hidden = true;
    });

    window.addEventListener('resize', () => document.querySelectorAll('.item-texto').forEach(ajustarAltura));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll('.item-texto').forEach(ajustarAltura));

    const celular = matchMedia('(max-width: 699px)');
    const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)');
    let organizando = false;
    let toque = null;   // Dedo na tela, ainda sem arrastar.
    let arraste = null; // Categoria sendo carregada pelo dedo.
    let timerSegurar = null;

    function entrarOrganizar() {
        organizando = true;
        document.body.classList.add('organizando');
        $('barra-organizar').hidden = false;
        if (navigator.vibrate) navigator.vibrate(15);
    }

    function sairOrganizar() {
        organizando = false;
        document.body.classList.remove('organizando');
        $('barra-organizar').hidden = true;
    }

    const cartoes = () => [...$('grid-topicos').querySelectorAll('.cartao')];

    function guardarOrdem() {
        const ids = cartoes().map((c) => Number(c.dataset.topico));
        estado.topicos.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        salvarEstado();
    }

    function posicionar() {
        const { el, y, pega } = arraste;
        el.style.transform = 'none';
        const base = el.getBoundingClientRect().top;
        el.style.transform = `translateY(${y - pega - base}px) scale(1.04)`;
    }

    function trocarLugar() {
        const { el, y } = arraste, outros = cartoes().filter((c) => c !== el);
        const proximo = outros.find((c) => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; }) || null;
        if ((proximo ? proximo.previousElementSibling : $('grid-topicos').lastElementChild) === el) return;
        const antes = new Map(outros.map((c) => [c, c.getBoundingClientRect().top]));
        $('grid-topicos').insertBefore(el, proximo);
        outros.forEach((c) => {
            const d = antes.get(c) - c.getBoundingClientRect().top;
            if (d && !movimentoReduzido.matches) c.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.32, .72, 0, 1)' });
        });
        if (navigator.vibrate) navigator.vibrate(8);
    }

    function acompanhar() {
        if (!arraste) return;
        if (arraste.y < 90) window.scrollBy(0, -7);
        else if (arraste.y > innerHeight - 130) window.scrollBy(0, 7);
        trocarLugar();
        posicionar();
        requestAnimationFrame(acompanhar);
    }

    function levantar(cartao, y) {
        if (!organizando) entrarOrganizar();
        const r = cartao.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight) cartao.scrollIntoView({ block: 'center' });
        arraste = { el: cartao, y, pega: cartao.offsetHeight / 2 };
        cartao.classList.add('levantado');
        acompanhar();
    }

    function soltar() {
        const { el } = arraste;
        arraste = null;
        el.classList.remove('levantado');
        el.style.transform = '';
        guardarOrdem();
    }

    function cancelarSegurar() {
        clearTimeout(timerSegurar);
        timerSegurar = null;
    }

    $('grid-topicos').addEventListener('touchstart', (e) => {
        if (!celular.matches || e.touches.length > 1) return;
        const t = e.touches[0], cartao = e.target.closest('.cartao');
        if (!cartao) return;
        if (organizando) { toque = { cartao, x: t.clientX, y: t.clientY }; return; }
        if (!e.target.closest('.cartao-topo') || e.target.closest('button')) return;
        toque = { cartao, x: t.clientX, y: t.clientY };
        cancelarSegurar();
        timerSegurar = setTimeout(() => { if (toque) levantar(toque.cartao, toque.y); }, 420);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!toque && !arraste) return;
        const t = e.touches[0];
        if (arraste) {
            e.preventDefault();
            arraste.y = t.clientY;
            return;
        }
        const andou = Math.hypot(t.clientX - toque.x, t.clientY - toque.y);
        if (organizando) {
            e.preventDefault();
            if (andou > 4) levantar(toque.cartao, t.clientY);
        } else if (andou > 8) {
            cancelarSegurar();
            toque = null;
        }
    }, { passive: false });

    function fimDoToque() {
        cancelarSegurar();
        toque = null;
        if (arraste) soltar();
    }
    document.addEventListener('touchend', fimDoToque);
    document.addEventListener('touchcancel', fimDoToque);
    $('grid-topicos').addEventListener('contextmenu', (e) => { if (celular.matches && e.target.closest('.cartao-topo')) e.preventDefault(); });

    $('btn-fim-organizar').addEventListener('click', sairOrganizar);
    $('btn-organizar').addEventListener('click', () => {
        $('dlg-categoria').close();
        entrarOrganizar();
    });
    celular.addEventListener('change', (e) => { if (!e.matches && organizando) sairOrganizar(); });

    function iniciarFundo() {
        const tela = $('fundo');
        const gl = tela.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
        if (!gl) return; // Sem WebGL, fica o gradiente definido no CSS.

        const vertice = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
        const fragmento = `
            precision highp float;
            uniform vec2 res;
            uniform float t;
            float acaso(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float ruido(vec2 p) {
                vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
                return mix(mix(acaso(i), acaso(i + vec2(1.0, 0.0)), u.x), mix(acaso(i + vec2(0.0, 1.0)), acaso(i + vec2(1.0, 1.0)), u.x), u.y);
            }
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5;
                mat2 g = mat2(0.8, 0.6, -0.6, 0.8);
                for (int i = 0; i < 5; i++) { v += a * ruido(p); p = g * p * 2.02; a *= 0.5; }
                return v;
            }
            float estrelas(vec2 px, float tam, float limite, float raio) {
                vec2 g = px / tam, id = floor(g), c = fract(g) - 0.5;
                float n = acaso(id);
                if (n < limite) return 0.0;
                vec2 lugar = vec2(acaso(id + 3.1), acaso(id + 7.7)) * 0.7 - 0.35;
                float brilho = 0.65 + 0.35 * sin(t * (0.6 + n * 2.2) + n * 40.0);
                return smoothstep(raio / tam, 0.0, length(c - lugar)) * brilho;
            }
            void main() {
                vec2 p = gl_FragCoord.xy / max(res.x, res.y) * 1.7;
                vec2 q = vec2(fbm(p + t * 0.012), fbm(p + vec2(5.2, 1.3) - t * 0.009));
                vec2 r = vec2(fbm(p + 3.4 * q + vec2(1.7, 9.2) + t * 0.007), fbm(p + 3.4 * q + vec2(8.3, 2.8)));
                float f = fbm(p + 3.4 * r);
                float nuvem = smoothstep(0.34, 0.86, f);
                vec3 cor = vec3(0.010, 0.007, 0.035);
                cor += nuvem * mix(vec3(0.05, 0.11, 0.72), vec3(0.42, 0.05, 0.68), clamp(q.x * 1.7 - 0.25, 0.0, 1.0));
                cor += pow(nuvem, 2.6) * mix(vec3(0.95, 0.12, 0.55), vec3(0.50, 0.68, 1.0), clamp(r.y * 1.7 - 0.35, 0.0, 1.0)) * 0.85;
                float fio = pow(1.0 - abs(sin(f * 13.0 + length(q) * 3.0)), 7.0);
                cor += fio * (0.05 + nuvem) * mix(vec3(0.72, 0.80, 1.0), vec3(1.0, 0.25, 0.70), clamp(r.x * 1.6 - 0.3, 0.0, 1.0)) * 0.75;
                cor *= 0.68; // Nebulosa mais escura; as estrelas entram depois e continuam acesas.
                vec2 px = gl_FragCoord.xy;
                float e = estrelas(px, 26.0, 0.72, 1.1) * 0.6 + estrelas(px + 11.0, 60.0, 0.74, 1.5) + estrelas(px + 37.0, 130.0, 0.80, 2.2) * 1.3;
                cor += e * vec3(0.92, 0.95, 1.0) * (1.0 - nuvem * 0.45);
                gl_FragColor = vec4(cor, 1.0);
            }`;

        const compilar = (tipo, codigo) => {
            const s = gl.createShader(tipo);
            gl.shaderSource(s, codigo);
            gl.compileShader(s);
            return s;
        };
        const prog = gl.createProgram();
        gl.attachShader(prog, compilar(gl.VERTEX_SHADER, vertice));
        gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, fragmento));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const local = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(local);
        gl.vertexAttribPointer(local, 2, gl.FLOAT, false, 0, 0);
        const uRes = gl.getUniformLocation(prog, 'res'), uT = gl.getUniformLocation(prog, 't');

        const desenhar = (t) => {
            gl.uniform1f(uT, t);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        let tempo = 40;
        const medir = () => {
            const k = Math.min(1, 1100 / Math.max(innerWidth, innerHeight));
            tela.width = Math.round(innerWidth * k);
            tela.height = Math.round(tela.offsetHeight * k);
            gl.viewport(0, 0, tela.width, tela.height);
            gl.uniform2f(uRes, tela.width, tela.height);
            desenhar(tempo);
        };
        medir();
        addEventListener('resize', medir);

        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let ultimo = 0;
        const quadro = (agora) => {
            requestAnimationFrame(quadro);
            if (document.hidden || agora - ultimo < 83) return;
            tempo += (agora - ultimo) / 1000;
            ultimo = agora;
            desenhar(tempo);
        };
        requestAnimationFrame((agora) => { ultimo = agora; quadro(agora); });
    }

    renderizar();
    iniciarFundo();
    $('grid-topicos').classList.add('abrindo');
    setTimeout(() => $('grid-topicos').classList.remove('abrindo'), 1500);
})();
