import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CatalogoDePlugins, lerFrontmatter, SKILLS_EMBUTIDAS } from "./CatalogoDePlugins";

async function escrever(caminho: string, conteudo: string): Promise<void> {
  await mkdir(path.dirname(caminho), { recursive: true });
  await writeFile(caminho, conteudo);
}

function skillMd(nome: string, descricao: string): string {
  return `---\nname: ${nome}\ndescription: ${descricao}\n---\n\nCorpo da skill.\n`;
}

describe("lerFrontmatter", () => {
  it("lê nome e descrição na mesma linha, com ou sem aspas", () => {
    expect(lerFrontmatter(skillMd("um", '"Faz a coisa: com dois pontos"'))).toEqual({
      nome: "um",
      descricao: "Faz a coisa: com dois pontos",
    });
    expect(lerFrontmatter("---\nname: 'dois'\ndescription: simples\n---")).toEqual({ nome: "dois", descricao: "simples" });
  });

  it("junta bloco `>` e linhas recuadas e corta a descrição em 200 caracteres", () => {
    const longa = "palavra ".repeat(60);
    const lido = lerFrontmatter(`---\nname: tres\ndescription: >\n  ${longa}\n  fim\nlicense: MIT\n---\n`);
    expect(lido.nome).toBe("tres");
    expect(lido.descricao.length).toBeLessThanOrEqual(200);
    expect(lido.descricao.endsWith("…")).toBe(true);
  });

  it("sem frontmatter, devolve vazio", () => {
    expect(lerFrontmatter("# Título\n")).toEqual({ nome: "", descricao: "" });
  });
});

describe("CatalogoDePlugins.ler", () => {
  let pasta: string;
  let catalogo: CatalogoDePlugins;

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "catalogo-"));
    const cache = path.join(pasta, "plugins", "cache");
    await escrever(
      path.join(pasta, "plugins", "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: {
          "alfa@mkt": [
            { scope: "project", installPath: path.join(cache, "alfa", "0.9"), lastUpdated: "2026-12-01T00:00:00Z" },
            { scope: "user", installPath: path.join(cache, "alfa", "1.0"), lastUpdated: "2026-01-01T00:00:00Z" },
          ],
          "beta@mkt": [{ scope: "user", installPath: path.join(cache, "beta", "1.0") }],
          "gama@mkt": [{ scope: "user", installPath: path.join(cache, "gama", "sumiu") }],
        },
      }),
    );
    await escrever(
      path.join(pasta, "settings.json"),
      JSON.stringify({
        enabledPlugins: { "alfa@mkt": true, "beta@mkt": false, "gama@mkt": true },
        skillOverrides: { dataviz: "off", xlsx: "off" },
      }),
    );
    await escrever(
      path.join(cache, "alfa", "1.0", ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "alfa", description: "Plugin alfa." }),
    );
    await escrever(path.join(cache, "alfa", "1.0", "skills", "um", "SKILL.md"), skillMd("um", "Skill um."));
    await escrever(path.join(cache, "alfa", "0.9", "skills", "velha", "SKILL.md"), skillMd("velha", "Não deve aparecer."));
    await escrever(path.join(cache, "beta", "1.0", "skills", "b", "SKILL.md"), skillMd("b", "Plugin desligado."));
    await escrever(path.join(pasta, "skills", "minha", "SKILL.md"), skillMd("minha", "Skill do usuário."));
    await escrever(path.join(pasta, "skills", "synced", "lote", "docx", "SKILL.md"), skillMd("docx", "Word."));
    await escrever(path.join(pasta, "skills", "synced", "lote", "xlsx", "SKILL.md"), skillMd("xlsx", "Excel."));
    const sincronizado = path.join(pasta, "plugins", "synced", "lote", "pdf-viewer~g2");
    await escrever(path.join(sincronizado, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "pdf-viewer" }));
    await escrever(path.join(sincronizado, "skills", "view-pdf", "SKILL.md"), skillMd("view-pdf", "Ver PDF."));
    catalogo = new CatalogoDePlugins({ pastaDoClaude: pasta });
  });

  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it("lista só os plugins instalados e ligados, com as skills de cada um", async () => {
    const lido = await catalogo.ler();

    expect(lido.plugins.map((plugin) => plugin.chave)).toEqual(["alfa@mkt", "pdf-viewer@synced"]);
    expect(lido.plugins[0]).toEqual({
      chave: "alfa@mkt",
      nome: "alfa",
      descricao: "Plugin alfa.",
      skills: [{ nome: "alfa:um", descricao: "Skill um.", origem: "plugin", plugin: "alfa@mkt" }],
    });
    expect(lido.plugins[1]?.skills.map((skill) => skill.nome)).toEqual(["pdf-viewer:view-pdf"]);
  });

  it("lista as skills avulsas (usuário, sincronizadas e embutidas), sem as desligadas em skillOverrides", async () => {
    const nomes = (await catalogo.ler()).skillsAvulsas.map((skill) => skill.nome);

    expect(nomes.slice(0, 2)).toEqual(["minha", "anthropic-skills:docx"]);
    expect(nomes).not.toContain("anthropic-skills:xlsx");
    expect(nomes).not.toContain("dataviz");
    expect(nomes).toContain("code-review");
    expect(nomes).toHaveLength(2 + SKILLS_EMBUTIDAS.length - 1);
  });

  it("respeita syncClaudeAiPlugins, syncClaudeAiSkills e disableBundledSkills desligados", async () => {
    await writeFile(
      path.join(pasta, "settings.json"),
      JSON.stringify({
        enabledPlugins: { "alfa@mkt": true },
        syncClaudeAiPlugins: false,
        syncClaudeAiSkills: false,
        disableBundledSkills: true,
      }),
    );
    const lido = await new CatalogoDePlugins({ pastaDoClaude: pasta }).ler();

    expect(lido.plugins.map((plugin) => plugin.chave)).toEqual(["alfa@mkt"]);
    expect(lido.skillsAvulsas.map((skill) => skill.nome)).toEqual(["minha"]);
  });

  it("guarda em memória e relê quando o settings.json muda", async () => {
    const primeiro = await catalogo.ler();
    expect(await catalogo.ler()).toBe(primeiro);

    await writeFile(path.join(pasta, "settings.json"), JSON.stringify({ enabledPlugins: {} }));
    const depois = new Date(Date.now() + 5_000);
    await utimes(path.join(pasta, "settings.json"), depois, depois);
    const relido = await catalogo.ler();

    expect(relido).not.toBe(primeiro);
    expect(relido.plugins.map((plugin) => plugin.chave)).toEqual(["pdf-viewer@synced"]);
  });

  it("pasta do Claude vazia: catálogo só com as embutidas", async () => {
    const vazia = await mkdtemp(path.join(tmpdir(), "catalogo-vazio-"));
    try {
      const lido = await new CatalogoDePlugins({ pastaDoClaude: vazia, skillsEmbutidas: [] }).ler();
      expect(lido).toEqual({ plugins: [], skillsAvulsas: [] });
    } finally {
      await rm(vazia, { recursive: true, force: true });
    }
  });
});
