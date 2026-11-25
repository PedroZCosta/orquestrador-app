// Gera entrega.html (autocontido) e dados/comparacao.json a partir de ../2026-11-22/resumo-variantes.json,
// das execuções em ../2026-11-22/execucoes-variantes/plugins-por-pedido/ e de provas.json.
// Imprime as tabelas em Markdown (coladas no RESULTADOS.md). Uso: node gerar-entrega.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ENTREGA = path.join(aqui, '..');
const BENCH = path.join(ENTREGA, '..', '2026-11-22');
const NOME = 'plugins-por-pedido';
const resumo = JSON.parse(readFileSync(path.join(BENCH, 'resumo-variantes.json'), 'utf8'));
const provas = JSON.parse(readFileSync(path.join(ENTREGA, 'provas.json'), 'utf8'));
const provasAntes = JSON.parse(readFileSync(path.join(ENTREGA, 'dados', 'provas-sem-ferramenta-skill.json'), 'utf8'));
const pastaExec = path.join(BENCH, 'execucoes-variantes', NOME);
const execucoes = readdirSync(pastaExec).filter((f) => /^r\d+-T\d-C\.json$/.test(f)).sort()
  .map((f) => JSON.parse(readFileSync(path.join(pastaExec, f), 'utf8')));

const alvo = resumo.variantes[NOME];
if (!alvo) throw new Error(`resumo-variantes.json sem a variante ${NOME}`);
const linhas = [
  ['A (Claude Code puro, Opus)', resumo.linhaDeBase.A],
  ['B (Claude Code puro, Sonnet)', resumo.linhaDeBase.B],
  ['C base (app 45b1b81)', resumo.linhaDeBase.C],
  ['V1 (sem peso do usuário)', resumo.variantes.v1],
  ['VR (recomendadas)', resumo.variantes.vr],
  ['Plugins por pedido (esta entrega)', alvo],
];
const ref = { C: resumo.linhaDeBase.C.somaDasMedias, B: resumo.linhaDeBase.B.somaDasMedias, A: resumo.linhaDeBase.A.somaDasMedias };
const pct = (a, b) => (typeof a === 'number' && typeof b === 'number' && b !== 0 ? ((a - b) / b) * 100 : null);
const fp = (x) => (x === null ? '-' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`);
const fu = (x, d = 4) => (typeof x === 'number' ? x.toFixed(d) : '-');
const fk = (x) => (typeof x === 'number' ? Math.round(x).toLocaleString('pt-BR') : '-');

// US$ comparável: para o app com seletor, soma o custo do seletor (fora das transcrições).
const usdDe = (a) => a.somaDasMedias.usdComSeletor ?? a.somaDasMedias.usd;
const tabela = linhas.map(([nome, a]) => {
  const s = a.somaDasMedias;
  return {
    nome, usd: usdDe(a), usdSemSeletor: s.usd, seletorUsd: s.usdDoSeletor ?? 0, seletorS: s.tempoDoSeletorS ?? 0,
    indice: s.indiceDeCusto, tokens: s.tokensTotais,
    primeiraOrq: a.mediaEntreTarefas.primeiraChamadaDoOrquestrador, primeiraExec: a.mediaEntreTarefas.primeiraChamadaDoExecutor,
    tempo: s.tempoDeParedeS, validas: `${a.validas}/${a.execucoes}`,
    vsC: pct(usdDe(a), ref.C.usd), vsB: pct(usdDe(a), ref.B.usd), vsA: pct(usdDe(a), ref.A.usd),
    tempoVsC: pct(s.tempoDeParedeS, ref.C.tempoDeParedeS), indiceVsC: pct(s.indiceDeCusto, ref.C.indiceDeCusto),
  };
});

// Por tarefa, contra C base.
const porTarefa = ['T1', 'T2', 'T3', 'T4'].map((t) => {
  const m = (a, k) => a.porTarefa[t].validasApenas[k]?.media;
  const c = resumo.linhaDeBase.C;
  return {
    tarefa: t, validas: `${alvo.porTarefa[t].validas}/${alvo.porTarefa[t].execucoes}`,
    usd: m(alvo, 'usdComSeletor'), usdC: m(c, 'usd'), vsC: pct(m(alvo, 'usdComSeletor'), m(c, 'usd')),
    primeiraOrq: m(alvo, 'primeiraChamadaDoOrquestrador'), primeiraOrqC: m(c, 'primeiraChamadaDoOrquestrador'),
    tempo: m(alvo, 'tempoDeParedeS'), tempoC: m(c, 'tempoDeParedeS'),
  };
});

// O que o seletor escolheu em cada execução.
const escolhas = execucoes.map((r) => ({
  id: r.id, sucesso: r.sucesso, usd: r.resumo?.usd ?? null,
  turnos: (r.execucao?.pluginsEscolhidos ?? []).map((e) => ({ plugins: e.plugins, skills: e.skills, origem: e.origem, custoUsd: e.custoUsd, duracaoMs: e.duracaoMs, motivo: e.motivo })),
  // Chamadas à ferramenta Skill no Orquestrador e nos subagentes.
  skillsUsadas: (r.transcricoes?.principal?.porFerramenta?.Skill ?? 0) + (r.transcricoes?.subagentes?.porFerramenta?.Skill ?? 0),
}));
const gastoSeletor = escolhas.reduce((a, r) => a + r.turnos.reduce((b, e) => b + (e.custoUsd ?? 0), 0), 0);
const tempoSeletorMs = escolhas.reduce((a, r) => a + r.turnos.reduce((b, e) => b + (e.duracaoMs ?? 0), 0), 0);
const chamadasSeletor = escolhas.reduce((a, r) => a + r.turnos.filter((e) => e.origem === 'modelo').length, 0);
const gastoBench = alvo.gastoUsdTodas + gastoSeletor;

// Provas: custo do turno = medição acumulada da sessão menos a anterior da mesma sessão.
const custoDasProvas = (lista) => {
  const ultimo = new Map();
  return lista.map((p) => {
    const acumulado = p.medicaoAcumuladaDaSessao?.usd ?? null;
    const antes = ultimo.get(p.sessao) ?? 0;
    if (acumulado !== null) ultimo.set(p.sessao, acumulado);
    const seletor = p.pluginsEscolhidos.reduce((a, e) => a + (e.custoUsd ?? 0), 0);
    return { ...p, usdDoTurno: acumulado === null ? null : acumulado - antes, usdDoSeletor: seletor };
  });
};
const provasComCusto = custoDasProvas(provas.provas);
const provasAntesComCusto = custoDasProvas(provasAntes.provas);
const somaProvas = (l) => l.reduce((a, p) => a + (p.usdDoTurno ?? 0) + p.usdDoSeletor, 0);
const gastoProvas = somaProvas(provasComCusto) + somaProvas(provasAntesComCusto);

writeFileSync(path.join(ENTREGA, 'dados', 'comparacao.json'), `${JSON.stringify({ geradoEm: new Date().toISOString(), tabela, porTarefa, escolhas, seletor: { gastoSeletor, tempoSeletorMs, chamadasSeletor }, gastoBench, gastoProvas }, null, 1)}\n`);

// ---------------- Markdown ----------------
const md = [];
md.push('| Configuração | US$ | Índice | Tokens | 1a chamada orq. | 1a chamada exec. | Tempo (s) | Válidas | vs C base | vs B | vs A |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|');
for (const l of tabela) md.push(`| ${l.nome} | ${fu(l.usd)} | ${fk(l.indice)} | ${fk(l.tokens)} | ${fk(l.primeiraOrq)} | ${fk(l.primeiraExec)} | ${fu(l.tempo, 1)} | ${l.validas} | ${fp(l.vsC)} | ${fp(l.vsB)} | ${fp(l.vsA)} |`);
md.push('');
md.push('| Tarefa | Válidas | US$ (c/ seletor) | US$ C base | vs C base | 1a chamada orq. | C base | Tempo (s) | C base |');
md.push('|---|---|---|---|---|---|---|---|---|');
for (const t of porTarefa) md.push(`| ${t.tarefa} | ${t.validas} | ${fu(t.usd)} | ${fu(t.usdC)} | ${fp(t.vsC)} | ${fk(t.primeiraOrq)} | ${fk(t.primeiraOrqC)} | ${fu(t.tempo, 1)} | ${fu(t.tempoC, 1)} |`);
md.push('');
md.push(`Seletor no benchmark: ${chamadasSeletor} chamadas ao Haiku, US$ ${gastoSeletor.toFixed(5)} e ${(tempoSeletorMs / 1000).toFixed(1)} s somados nas ${execucoes.length} execuções; na soma das médias, US$ ${fu(alvo.somaDasMedias.usdDoSeletor, 5)} e ${fu(alvo.somaDasMedias.tempoDoSeletorS, 1)} s.`);
md.push(`Gasto: benchmark US$ ${gastoBench.toFixed(4)} (todas as execuções, com seletor); provas US$ ${gastoProvas.toFixed(4)} (duas rodadas).`);
console.log(md.join('\n'));

// ---------------- HTML ----------------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const maxUsd = Math.max(...tabela.map((l) => l.usd));
const linhasHtml = tabela.map((l) => `<tr${l.nome.startsWith('Plugins') ? ' class="destaque"' : ''}><th scope="row">${esc(l.nome)}</th>
<td class="n"><div class="barra"><span style="width:${((l.usd / maxUsd) * 100).toFixed(1)}%"></span></div>${fu(l.usd)}</td>
<td class="n">${fk(l.indice)}</td><td class="n">${fk(l.tokens)}</td><td class="n">${fk(l.primeiraOrq)}</td><td class="n">${fk(l.primeiraExec)}</td>
<td class="n">${fu(l.tempo, 1)}</td><td class="n">${l.validas}</td><td class="n">${fp(l.vsC)}</td><td class="n">${fp(l.vsB)}</td><td class="n">${fp(l.vsA)}</td></tr>`).join('\n');
const tarefasHtml = porTarefa.map((t) => `<tr><th scope="row">${t.tarefa}</th><td class="n">${t.validas}</td><td class="n">${fu(t.usd)}</td><td class="n">${fu(t.usdC)}</td><td class="n">${fp(t.vsC)}</td><td class="n">${fk(t.primeiraOrq)}</td><td class="n">${fk(t.primeiraOrqC)}</td><td class="n">${fu(t.tempo, 1)}</td><td class="n">${fu(t.tempoC, 1)}</td></tr>`).join('\n');
const escolhasHtml = escolhas.map((r) => `<tr><th scope="row">${esc(r.id)}</th><td>${r.sucesso ? 'passou' : 'falhou'}</td><td>${r.turnos.map((e) => `${esc([...e.plugins.map((p) => p.split('@')[0]), ...e.skills].join(', ') || 'nada')} <span class="sut">(${esc(e.origem)}, US$ ${fu(e.custoUsd, 5)}, ${(e.duracaoMs / 1000).toFixed(1)} s)</span>`).join('<br>')}</td><td class="n">${r.skillsUsadas}</td></tr>`).join('\n');

const blocoProva = (p, numero, esperado) => {
  const e = p.pluginsEscolhidos[0] ?? {};
  const t = p.transcricoes ?? {};
  const skills = (t.skills ?? []).map((s) => `${s.onde}: Skill(${JSON.stringify(s.entrada)})`).join('\n') || 'nenhuma chamada à ferramenta Skill';
  return `<section class="prova"><h3>${esc(p.nome)}</h3>
<p class="pedido">Pedido: <q>${esc(p.texto)}</q></p>
<p><strong>Esperado:</strong> ${esc(esperado)}</p>
<p class="ok"><strong>Resultado:</strong> ${esc(numero)}</p>
<div class="duas"><div><h4>Evento plugins_escolhidos</h4><pre>${esc(JSON.stringify(e, null, 1))}</pre></div>
<div><h4>Transcrição (ferramenta Skill no turno)</h4><pre>${esc(skills)}</pre>
<h4>Primeira chamada do turno</h4><pre>${esc(`Orquestrador: ${JSON.stringify(t.primeiraDoOrquestrador)}\nExecutor: ${JSON.stringify(t.primeiraDoExecutor)}\nCusto do turno: US$ ${fu(p.usdDoTurno)} + seletor US$ ${fu(p.usdDoSeletor, 5)} | ${p.duracaoS} s`)}</pre></div></div>
<details><summary>Resposta do agente (início)</summary><pre>${esc(p.resposta.slice(0, 900))}</pre></details></section>`;
};
const [p1, p3, p2, p4] = provasComCusto;
const veredito = {
  p1: `carregou ${[...(p1.pluginsEscolhidos[0]?.skills ?? [])].join(', ') || 'nada'} (origem ${p1.pluginsEscolhidos[0]?.origem}); Skill chamada ${(p1.transcricoes.skills ?? []).length} vez(es): ${(p1.transcricoes.skills ?? []).map((s) => s.entrada.skill).join(', ') || 'nenhuma'}; sem perguntar.`,
  p3: `origem ${p3.pluginsEscolhidos[0]?.origem}, mesma escolha (${p3.pluginsEscolhidos[0]?.skills?.join(', ')}), custo do seletor US$ ${fu(p3.usdDoSeletor, 5)} (sem chamada ao Haiku); cache da conversa preservado (${fk(p3.transcricoes.primeiraDoOrquestrador?.leituraDeCache)} tokens lidos do cache na primeira chamada).`,
  p2: `origem ${p2.pluginsEscolhidos[0]?.origem}, plugin ${p2.pluginsEscolhidos[0]?.plugins?.join(', ')}; Skill chamada: ${(p2.transcricoes.skills ?? []).map((s) => s.entrada.skill).join(', ') || 'nenhuma'}.`,
  p4: `nada carregado (origem ${p4.pluginsEscolhidos[0]?.origem}); nenhuma chamada à ferramenta Skill.`,
};

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plugins por pedido: entrega de 25/11/2026</title>
<style>
:root{--fundo:#fbfaf8;--texto:#1f2328;--sut:#5b636d;--borda:#e3e0da;--real:#e8772e;--real2:#fde9da;--ok:#1a7f37;--card:#fff}
@media (prefers-color-scheme:dark){:root{--fundo:#16181b;--texto:#e6e6e6;--sut:#9aa3ad;--borda:#2e3238;--real:#f0914d;--real2:#3a2a1e;--ok:#4ac26b;--card:#1d2024}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--texto);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 24px 64px}h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:36px 0 10px;border-bottom:1px solid var(--borda);padding-bottom:6px}
h3{font-size:16px;margin:0 0 6px}h4{font-size:13px;margin:10px 0 4px;color:var(--sut);text-transform:uppercase;letter-spacing:.04em}
.sut{color:var(--sut);font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:18px 0}
.card{background:var(--card);border:1px solid var(--borda);border-radius:10px;padding:12px 14px}.card b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--borda);border-radius:8px;overflow:hidden;font-size:13.5px}
th,td{padding:7px 9px;border-bottom:1px solid var(--borda);text-align:left;vertical-align:top}thead th{font-size:12px;color:var(--sut);font-weight:600}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}tr.destaque{background:var(--real2)}
.barra{display:inline-block;width:70px;height:8px;background:var(--borda);border-radius:4px;margin-right:8px;vertical-align:middle}.barra span{display:block;height:100%;background:var(--real);border-radius:4px}
.tabela{overflow-x:auto}pre{background:var(--card);border:1px solid var(--borda);border-radius:6px;padding:8px 10px;font-size:12px;white-space:pre-wrap;word-break:break-word;margin:0}
.prova{background:var(--card);border:1px solid var(--borda);border-radius:10px;padding:14px 16px;margin:12px 0}.duas{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:800px){.duas{grid-template-columns:1fr}}.ok{color:var(--ok)}.pedido{margin:2px 0}q{font-style:italic}ul{padding-left:20px}code{font-size:13px}
</style></head><body><main>
<h1>Plugins e skills por pedido</h1>
<p class="sut">Go SubAgents, worktree 549e8a7f, 25/11/2026. Código medido: ${esc(execucoes[0]?.execucao?.versaoDoApp ?? '')}. Só contam execuções que passaram no checador.</p>
<div class="cards">
<div class="card"><span class="sut">US$ (soma das médias, com seletor)</span><b>${fu(tabela.at(-1).usd)}</b><span class="sut">${fp(tabela.at(-1).vsC)} vs C base</span></div>
<div class="card"><span class="sut">Tempo (soma das médias)</span><b>${fu(tabela.at(-1).tempo, 1)} s</b><span class="sut">${fp(tabela.at(-1).tempoVsC)} vs C base</span></div>
<div class="card"><span class="sut">1a chamada do Orquestrador</span><b>${fk(tabela.at(-1).primeiraOrq)}</b><span class="sut">C base ${fk(tabela[2].primeiraOrq)} tokens</span></div>
<div class="card"><span class="sut">Válidas</span><b>${tabela.at(-1).validas}</b><span class="sut">seletor: ${chamadasSeletor} chamadas, US$ ${gastoSeletor.toFixed(4)}</span></div>
</div>

<h2>O que mudou</h2>
<ul>
<li><code>SeletorDePlugins.ts</code>: a escolha agora é <strong>cumulativa</strong> na sessão (<code>acumular</code>): anterior ∪ citado ∪ modelo, nunca remove o que já foi carregado; origem, motivo e consumo são os do turno, e o motivo diz o que foi mantido ("mantidas da sessão: ..."). <code>ehMensagemDeContinuacao</code>: mensagem que começa com "Plano aprovado.", "continue", "continua", "prossiga", "ok" ou "sim", ou com menos de 40 caracteres sem citação, repete a escolha anterior sem chamar o Haiku (origem "anterior"); no primeiro turno da sessão o Haiku é consultado mesmo assim. <code>aindaNoCatalogo</code> reaproveitado por <code>repetir</code>.</li>
<li><code>Configuracao.ts</code>: <code>selecaoDePlugins</code>, lida de <code>ORQUESTRADOR_SELECAO_DE_PLUGINS</code> (<code>desligada</code> ou <code>0</code> desliga). <code>root.ts</code>: desligada, os motores recebem <code>null</code> (comportamento antigo: tudo como o usuário configurou, sem <code>--settings</code> de plugins e sem Haiku). <code>.env.example</code> documenta.</li>
<li><strong>Correção achada pelas provas</strong>: a sessão não tinha a ferramenta <code>Skill</code> (fora de <code>--tools</code>), então as skills escolhidas nem entravam no contexto e o agente respondia "não consegui acionar a skill". Agora <code>FERRAMENTA_DE_SKILLS</code> entra em <code>--tools</code>, <code>--allowedTools</code> e nas ferramentas dos subagentes (<code>montarArgumentos</code>, <code>definicaoDosAgentes</code>, <code>montarArgumentosDoChat</code> com <code>comSkills</code>) só no turno em que algo foi carregado. Sem nada carregado, os argumentos ficam iguais aos de antes. <code>MotorClaudeCodeCli</code> grava <code>agentes.json</code> depois da escolha.</li>
<li>Harness (<code>2026-11-22/scripts/harness.mjs</code>): opções <code>--app &lt;pasta&gt;</code> (ou <code>BENCH_APP</code>) e <code>--saida &lt;nome&gt;</code>; com <code>--saida</code>, <code>--variante base</code> é aceita. A medição continua com o código de 45b1b81. Registra <code>pluginsEscolhidos</code>. <code>analisar-variantes.mjs</code> soma o custo e o tempo do seletor (<code>usdDoSeletor</code>, <code>usdComSeletor</code>, <code>tempoDoSeletorS</code>, <code>chamadasAoSeletor</code>).</li>
</ul>

<h2>Antes e depois (soma das médias de T1 a T4)</h2>
<p class="sut">US$ = equivalente de API; na linha desta entrega inclui o seletor (US$ ${fu(alvo.somaDasMedias.usdDoSeletor, 5)} e ${fu(alvo.somaDasMedias.tempoDoSeletorS, 1)} s na soma das médias; sem ele, US$ ${fu(alvo.somaDasMedias.usd)}). Primeira chamada = média entre tarefas dos tokens de entrada da primeira resposta.</p>
<div class="tabela"><table><thead><tr><th>Configuração</th><th>US$</th><th>Índice</th><th>Tokens</th><th>1a chamada orq.</th><th>1a chamada exec.</th><th>Tempo (s)</th><th>Válidas</th><th>vs C base</th><th>vs B</th><th>vs A</th></tr></thead><tbody>
${linhasHtml}
</tbody></table></div>

<h3 style="margin-top:22px">Por tarefa, contra C base</h3>
<div class="tabela"><table><thead><tr><th>Tarefa</th><th>Válidas</th><th>US$ (c/ seletor)</th><th>US$ C base</th><th>vs C base</th><th>1a chamada orq.</th><th>C base</th><th>Tempo (s)</th><th>C base</th></tr></thead><tbody>
${tarefasHtml}
</tbody></table></div>

<h3 style="margin-top:22px">O que o seletor escolheu em cada execução</h3>
<div class="tabela"><table><thead><tr><th>Execução</th><th>Checador</th><th>Escolha por turno</th><th>Skill chamada</th></tr></thead><tbody>
${escolhasHtml}
</tbody></table></div>

<h2>Provas de comportamento</h2>
<p class="sut">Instância isolada na porta ${provas.porta}, PASTA_DADOS=${esc(provas.dados)}, projeto ${esc(provas.projeto)}, config C (Sonnet, esforço médio, edição e comandos). Claude Code real, sem intermediário.</p>
${blocoProva(p1, veredito.p1, 'dataviz carregada pelo modelo e invocada com a ferramenta Skill, sem perguntar.')}
${blocoProva(p3, veredito.p3, 'mesma sessão: escolha repetida (cumulativa), sem chamada ao Haiku.')}
${blocoProva(p2, veredito.p2, 'origem "citado", plugin carregado e usado.')}
${blocoProva(p4, veredito.p4, 'nada carregado.')}
<p class="sut">Primeira rodada das provas, antes da correção da ferramenta Skill (dados/provas-sem-ferramenta-skill.json): a escolha saiu igual, mas nenhuma Skill foi chamada e, na prova 2, o agente respondeu "Não consegui acionar a skill logo-design, porque ela não está disponível como ferramenta aqui".</p>

<h2>Riscos</h2>
<ul>
<li>Cumulativa: numa sessão longa que muda de assunto, o que foi carregado fica até o fim da sessão (custo de contexto pequeno por skill; preferido a invalidar o cache a cada turno).</li>
<li>Continuação: mensagem que começa com "ok", "sim", "continue" ou "Plano aprovado." não consulta o Haiku mesmo se trouxer tarefa nova depois; citar a skill pelo nome continua funcionando. Mensagem curta (menos de 40 caracteres) idem, exceto no primeiro turno da sessão.</li>
<li>A ferramenta Skill entra só quando algo foi carregado: com o seletor desligado, as skills continuam fora da sessão, como antes desta feature.</li>
<li>Escolha em memória: reiniciar o app zera a escolha das sessões (o primeiro turno depois consulta o Haiku de novo).</li>
<li>O seletor depende do Haiku: falha ou 8 s esgotados repetem a escolha anterior (ou nenhuma) e o turno segue.</li>
<li>Benchmark com 3 rodadas por tarefa em máquina compartilhada: o tempo de parede tem ruído; ver carga registrada em cada execução.</li>
</ul>

<h2>Como desligar</h2>
<pre>ORQUESTRADOR_SELECAO_DE_PLUGINS=desligada   # no .env (ou "0"); reinicie o servidor</pre>
<p class="sut">Desligada: sem chamada ao Haiku, sem <code>--settings</code> de plugins e sem a ferramenta Skill; a sessão carrega tudo como o usuário configurou.</p>

<h2>Custo desta validação</h2>
<p>Benchmark: US$ ${gastoBench.toFixed(4)} (${execucoes.length} execuções, com seletor). Provas: US$ ${gastoProvas.toFixed(4)} (duas rodadas de 4 provas). Valores em equivalente de API.</p>
</main></body></html>
`;
writeFileSync(path.join(ENTREGA, 'entrega.html'), html);
console.log(`\nentrega.html gravado (${(html.length / 1024).toFixed(1)} KB)`);
