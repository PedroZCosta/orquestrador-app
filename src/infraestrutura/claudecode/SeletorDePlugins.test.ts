import { describe, expect, it, vi } from "vitest";

import type { Catalogo } from "./CatalogoDePlugins";
import {
  argumentosDoSeletor,
  citadosNoPedido,
  type EscolhaDePlugins,
  ehMensagemDeContinuacao,
  type ExecutorDoSeletor,
  lerRespostaDoModelo,
  PluginsPorSessao,
  SeletorDePlugins,
  settingsDaEscolha,
} from "./SeletorDePlugins";

const CATALOGO: Catalogo = {
  plugins: [
    {
      chave: "superpowers@oficial",
      nome: "superpowers",
      descricao: "Disciplinas de desenvolvimento.",
      skills: [
        { nome: "superpowers:brainstorming", descricao: "Antes de criar algo.", origem: "plugin", plugin: "superpowers@oficial" },
        { nome: "superpowers:test-driven-development", descricao: "TDD.", origem: "plugin", plugin: "superpowers@oficial" },
      ],
    },
    {
      chave: "logo-design@logos",
      nome: "logo-design",
      descricao: "Logos.",
      skills: [{ nome: "logo-design:logo-design", descricao: "Desenha logos.", origem: "plugin", plugin: "logo-design@logos" }],
    },
  ],
  skillsAvulsas: [
    { nome: "context7-mcp", descricao: "Docs de bibliotecas.", origem: "usuario", plugin: null },
    { nome: "anthropic-skills:docx", descricao: "Word.", origem: "sincronizada", plugin: null },
    { nome: "dataviz", descricao: "Gráficos.", origem: "embutida", plugin: null },
    { nome: "run", descricao: "Roda o app.", origem: "embutida", plugin: null },
  ],
};

const fonte = { ler: async () => CATALOGO };

function respostaDoCli(resultado: string): Awaited<ReturnType<ExecutorDoSeletor>> {
  return {
    codigoDeSaida: 0,
    erroPadrao: "",
    mensagens: [
      {
        type: "result",
        subtype: "success",
        is_error: false,
        result: resultado,
        duration_ms: 1500,
        total_cost_usd: 0.002,
        usage: { input_tokens: 10, cache_creation_input_tokens: 900, cache_read_input_tokens: 100, output_tokens: 20 },
      },
    ],
  };
}

/** Pedido com tarefa: longo o bastante para chamar o modelo mesmo com escolha anterior. */
const PEDIDO = "monte uma página que mostre a evolução das vendas do trimestre";

const ANTERIOR: EscolhaDePlugins = {
  plugins: ["logo-design@logos", "removido@x"],
  skillsAvulsas: ["dataviz"],
  skillsAvulsasLigadas: true,
  motivo: "x",
  origem: "modelo",
};

describe("citadosNoPedido", () => {
  it("acha plugin e skill pelo nome, com prefixo, com / e sem diferenciar maiúsculas", () => {
    expect(citadosNoPedido("use o Logo-Design aqui", CATALOGO).plugins).toEqual(["logo-design@logos"]);
    expect(citadosNoPedido("rode /superpowers:brainstorming", CATALOGO).plugins).toEqual(["superpowers@oficial"]);
    expect(citadosNoPedido("faça com test-driven-development", CATALOGO).plugins).toEqual(["superpowers@oficial"]);
    expect(citadosNoPedido("consulte o context7-mcp", CATALOGO).skillsAvulsas).toEqual(["context7-mcp"]);
    expect(citadosNoPedido("gere um DOCX", CATALOGO).skillsAvulsas).toEqual(["anthropic-skills:docx"]);
    expect(citadosNoPedido("use anthropic-skills:docx", CATALOGO).skillsAvulsas).toEqual(["anthropic-skills:docx"]);
  });

  it("nome que é palavra comum só conta com / de comando", () => {
    expect(citadosNoPedido("run the tests e veja o dataviz-antigo", CATALOGO)).toEqual({ plugins: [], skillsAvulsas: [] });
    expect(citadosNoPedido("use /run", CATALOGO).skillsAvulsas).toEqual(["run"]);
    expect(citadosNoPedido("abra src/run/app.ts", CATALOGO).skillsAvulsas).toEqual([]);
  });
});

describe("lerRespostaDoModelo", () => {
  it("traduz os nomes para plugins e skills, ignora os que não existem e aceita cerca de código", () => {
    const lida = lerRespostaDoModelo(
      '```json\n{"skills": ["dataviz", "inexistente", "superpowers:brainstorming", "docx", 3], "motivo": "gráfico"}\n```',
      CATALOGO,
    );
    expect(lida).toEqual({ plugins: ["superpowers@oficial"], skillsAvulsas: ["dataviz", "anthropic-skills:docx"], motivo: "gráfico" });
  });

  it("nulo quando não é o JSON pedido", () => {
    expect(lerRespostaDoModelo("não sei", CATALOGO)).toBeNull();
    expect(lerRespostaDoModelo('{"outra": 1}', CATALOGO)).toBeNull();
  });
});

describe("settingsDaEscolha e argumentosDoSeletor", () => {
  it("liga só os plugins escolhidos e esconde as avulsas não escolhidas", () => {
    expect(settingsDaEscolha(CATALOGO, { plugins: ["logo-design@logos"], skillsAvulsas: ["dataviz"] })).toEqual({
      enabledPlugins: { "superpowers@oficial": false, "logo-design@logos": true },
      skillOverrides: { "context7-mcp": "off", "anthropic-skills:docx": "off", run: "off" },
    });
  });

  it("a chamada do seletor vai sem ferramentas, skills, MCP, hooks nem plugins", () => {
    const argumentos = argumentosDoSeletor(CATALOGO, "haiku");
    expect(argumentos.slice(0, 3)).toEqual(["-p", "--model", "haiku"]);
    expect(argumentos[argumentos.indexOf("--tools") + 1]).toBe("");
    expect(argumentos).toEqual(expect.arrayContaining(["--disable-slash-commands", "--strict-mcp-config", "--no-session-persistence"]));
    const settings = JSON.parse(argumentos[argumentos.indexOf("--settings") + 1] ?? "{}");
    expect(settings.enabledPlugins).toEqual({ "superpowers@oficial": false, "logo-design@logos": false });
    expect(settings).toMatchObject({ syncClaudeAiPlugins: false, disableAllHooks: true });
  });
});

describe("SeletorDePlugins.selecionar", () => {
  it("citado entra direto, sem chamar o modelo", async () => {
    const executar = vi.fn<ExecutorDoSeletor>();
    const escolha = await new SeletorDePlugins({ catalogo: fonte, executar }).selecionar("use o logo-design e o dataviz");

    expect(executar).not.toHaveBeenCalled();
    expect(escolha).toEqual({
      plugins: ["logo-design@logos"],
      skillsAvulsas: ["dataviz"],
      skillsAvulsasLigadas: true,
      motivo: "citado no pedido: logo-design, dataviz",
      origem: "citado",
    });
  });

  it("sem citação, usa a escolha do modelo com o pedido e o catálogo no stdin", async () => {
    const executar = vi.fn<ExecutorDoSeletor>(async () =>
      respostaDoCli('{"skills": ["dataviz"], "motivo": "pede um gráfico"}'),
    );
    const escolha = await new SeletorDePlugins({ catalogo: fonte, executar }).selecionar("crie um gráfico de barras");

    expect(escolha).toEqual({
      plugins: [],
      skillsAvulsas: ["dataviz"],
      skillsAvulsasLigadas: true,
      motivo: "pede um gráfico",
      origem: "modelo",
      consumo: { custoUsd: 0.002, tokensDeEntrada: 1010, tokensDeSaida: 20, duracaoMs: 1500 },
    });
    const entrada = executar.mock.calls[0]?.[1] ?? "";
    expect(entrada).toContain("- dataviz: Gráficos.");
    expect(entrada).toContain("- superpowers:brainstorming: Antes de criar algo.");
    expect(entrada).toContain("crie um gráfico de barras");
  });

  it("modelo sem skill útil: nada ligado, origem modelo", async () => {
    const executar = vi.fn<ExecutorDoSeletor>(async () => respostaDoCli('{"skills": [], "motivo": "bug simples"}'));
    const escolha = await new SeletorDePlugins({ catalogo: fonte, executar }).selecionar(PEDIDO);

    expect(escolha).toMatchObject({ plugins: [], skillsAvulsas: [], skillsAvulsasLigadas: false, origem: "modelo" });
  });

  it("cumulativa: o modelo soma à anterior, sem tirar nada, e o motivo separa o novo do mantido", async () => {
    const executar = vi.fn<ExecutorDoSeletor>(async () =>
      respostaDoCli('{"skills": ["superpowers:brainstorming", "dataviz"], "motivo": "ideias"}'),
    );
    const escolha = await new SeletorDePlugins({ catalogo: fonte, executar }).selecionar(PEDIDO, ANTERIOR);

    expect(escolha).toEqual({
      plugins: ["logo-design@logos", "superpowers@oficial"],
      skillsAvulsas: ["dataviz"],
      skillsAvulsasLigadas: true,
      motivo: "ideias; mantidas da sessão: logo-design, dataviz",
      origem: "modelo",
      consumo: { custoUsd: 0.002, tokensDeEntrada: 1010, tokensDeSaida: 20, duracaoMs: 1500 },
    });
  });

  it("cumulativa: modelo sem nada novo mantém a anterior que ainda existe", async () => {
    const executar = vi.fn<ExecutorDoSeletor>(async () => respostaDoCli('{"skills": [], "motivo": "bug simples"}'));
    const escolha = await new SeletorDePlugins({ catalogo: fonte, executar }).selecionar(PEDIDO, ANTERIOR);

    expect(escolha).toMatchObject({ plugins: ["logo-design@logos"], skillsAvulsas: ["dataviz"], origem: "modelo" });
    expect(escolha.motivo).toBe("bug simples; nada novo, mantidas da sessão: logo-design, dataviz");
  });

  it("cumulativa: citado soma à anterior, sem chamar o modelo", async () => {
    const executar = vi.fn<ExecutorDoSeletor>();
    const escolha = await new SeletorDePlugins({ catalogo: fonte, executar }).selecionar("ok, consulte o context7-mcp", ANTERIOR);

    expect(executar).not.toHaveBeenCalled();
    expect(escolha).toMatchObject({
      plugins: ["logo-design@logos"],
      skillsAvulsas: ["dataviz", "context7-mcp"],
      origem: "citado",
      motivo: "citado no pedido: context7-mcp; mantidas da sessão: logo-design, dataviz",
    });
  });

  it("mensagem de continuação com anterior: repete sem chamar o modelo", async () => {
    const executar = vi.fn<ExecutorDoSeletor>();
    const seletor = new SeletorDePlugins({ catalogo: fonte, executar });
    const aprovacao =
      "Plano aprovado. Execute agora o plano da sua resposta anterior, delegando as subtarefas como planejado.";

    for (const pedido of [aprovacao, "continue", "ok", "sim, pode seguir", "Continue de onde parou e termine todas as etapas"]) {
      const escolha = await seletor.selecionar(pedido, ANTERIOR);
      expect(escolha).toMatchObject({ plugins: ["logo-design@logos"], skillsAvulsas: ["dataviz"], origem: "anterior" });
      expect(escolha.motivo).toBe("mensagem sem tarefa nova; mantida a escolha do turno anterior");
      expect(escolha.consumo).toBeUndefined();
    }
    expect(executar).not.toHaveBeenCalled();
  });

  it("mensagem curta sem anterior ainda consulta o modelo (primeiro turno da sessão)", async () => {
    const executar = vi.fn<ExecutorDoSeletor>(async () => respostaDoCli('{"skills": ["dataviz"], "motivo": "gráfico"}'));
    const escolha = await new SeletorDePlugins({ catalogo: fonte, executar }).selecionar("crie um gráfico de barras");

    expect(executar).toHaveBeenCalledTimes(1);
    expect(escolha).toMatchObject({ skillsAvulsas: ["dataviz"], origem: "modelo" });
  });

  it("tempo esgotado aborta o processo e repete a escolha anterior que ainda existe", async () => {
    let sinalRecebido: AbortSignal | undefined;
    const executar: ExecutorDoSeletor = (_argumentos, _entrada, sinal) => {
      sinalRecebido = sinal;
      return new Promise(() => undefined);
    };
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const escolha = await new SeletorDePlugins({ catalogo: fonte, executar, tempoLimiteMs: 20 }).selecionar(PEDIDO, ANTERIOR);
    avisos.mockRestore();

    expect(sinalRecebido?.aborted).toBe(true);
    expect(escolha).toMatchObject({ plugins: ["logo-design@logos"], skillsAvulsas: ["dataviz"], origem: "anterior" });
    expect(escolha.motivo).toContain("tempo limite de 20 ms");
  });

  it("falha do CLI ou resposta inválida sem anterior: nenhum", async () => {
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const falhou = await new SeletorDePlugins({
      catalogo: fonte,
      executar: async () => ({ codigoDeSaida: 1, mensagens: [], erroPadrao: "Not logged in" }),
    }).selecionar("algo");
    const invalida = await new SeletorDePlugins({
      catalogo: fonte,
      executar: async () => respostaDoCli("talvez dataviz"),
    }).selecionar("algo");
    const erro = await new SeletorDePlugins({
      catalogo: fonte,
      executar: async () => {
        throw new Error("ENOENT");
      },
    }).selecionar(PEDIDO, ANTERIOR);
    avisos.mockRestore();

    expect(falhou).toMatchObject({ plugins: [], skillsAvulsas: [], origem: "nenhum" });
    expect(falhou.motivo).toContain("Not logged in");
    expect(invalida.origem).toBe("nenhum");
    expect(erro.origem).toBe("anterior");
  });

  it("catálogo vazio: nenhum, sem chamar o modelo", async () => {
    const executar = vi.fn<ExecutorDoSeletor>();
    const escolha = await new SeletorDePlugins({
      catalogo: { ler: async () => ({ plugins: [], skillsAvulsas: [] }) },
      executar,
    }).selecionar("qualquer coisa");

    expect(executar).not.toHaveBeenCalled();
    expect(escolha.origem).toBe("nenhum");
  });
});

describe("ehMensagemDeContinuacao", () => {
  it("curta ou que só dá andamento; pedido com tarefa não", () => {
    expect(ehMensagemDeContinuacao("Plano aprovado. Execute agora o plano da sua resposta anterior.")).toBe(true);
    expect(ehMensagemDeContinuacao("  ok  ")).toBe(true);
    expect(ehMensagemDeContinuacao("corrija o typo em README")).toBe(true);
    expect(ehMensagemDeContinuacao("prossiga com a implementação de todas as etapas do plano")).toBe(true);
    expect(ehMensagemDeContinuacao(PEDIDO)).toBe(false);
    expect(ehMensagemDeContinuacao("okay, agora monte o painel de vendas com filtros por região")).toBe(false);
    expect(ehMensagemDeContinuacao("simule a carga do servidor com mil requisições por segundo")).toBe(false);
  });
});

describe("PluginsPorSessao", () => {
  it("acumula dentro da sessão, não chama o modelo na aprovação e isola sessões", async () => {
    const respostas = ['{"skills": ["dataviz"], "motivo": "pede um gráfico"}', '{"skills": [], "motivo": "nada"}'];
    const executar = vi.fn<ExecutorDoSeletor>(async () => respostaDoCli(respostas.shift() ?? "{}"));
    const porSessao = new PluginsPorSessao(new SeletorDePlugins({ catalogo: fonte, executar }), fonte, () => 0);

    const primeiro = await porSessao.escolher("s1", "crie um gráfico de barras em HTML com estes dados: jan 10, fev 14, mar 9");
    const aprovacao = await porSessao.escolher("s1", "Plano aprovado. continue");
    const citado = await porSessao.escolher("s1", "use o logo-design para esboçar um ícone");
    const outra = await porSessao.escolher("s2", PEDIDO);

    expect(primeiro.registro).toMatchObject({ skills: ["dataviz"], plugins: [], origem: "modelo", custoUsd: 0.002 });
    expect(aprovacao.registro).toMatchObject({ skills: ["dataviz"], plugins: [], origem: "anterior", custoUsd: 0 });
    expect(citado.registro).toMatchObject({ skills: ["dataviz"], plugins: ["logo-design@logos"], origem: "citado" });
    expect(citado.settings?.enabledPlugins).toEqual({ "superpowers@oficial": false, "logo-design@logos": true });
    expect(outra.registro).toMatchObject({ skills: [], plugins: [], origem: "modelo" });
    expect(executar).toHaveBeenCalledTimes(2);
  });
});
