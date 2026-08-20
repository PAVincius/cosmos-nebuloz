import { expect, it, vi } from "vitest";
import type { CorpusSeed } from "../regulacao-corpora";
import { upsertCorpus } from "../seed-regulacao.mts";

const corpus: CorpusSeed = {
  nome: "Regulação de Teste",
  origem: "REGULACAO",
  editor: "NEBULOZ",
  jurisdicao: "BR",
  licenca: "LIVRE",
  versao: "1",
  notas: "fixture de teste",
  requisitos: [{ codigo: "1.1", citacao: "Art. 1", resumo: "Resumo" }],
};

it("busca o conjunto existente só entre os globais — nunca sequestra um conjunto de tenant com (nome,versao) igual", async () => {
  // Regressão do Bloqueio 4 da review final: sem `tenantId: null` no filtro,
  // um conjunto privado de tenant que coincida em (nome, versao) seria achado
  // aqui e o update seguinte apagaria o dono — CharterRequirementSet não tem
  // RLS, então nada no banco impediria isso além deste filtro.
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "set-1" }),
    },
    charterRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  await upsertCorpus(db as never, corpus);

  expect(db.charterRequirementSet.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { nome: corpus.nome, versao: corpus.versao, tenantId: null },
    })
  );
});

it("atualiza o conjunto global encontrado em vez de criar um novo", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue({ id: "set-existente" }),
      update: vi.fn().mockResolvedValue({ id: "set-existente" }),
      create: vi.fn(),
    },
    charterRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  const count = await upsertCorpus(db as never, corpus);

  expect(db.charterRequirementSet.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "set-existente" } })
  );
  expect(db.charterRequirementSet.create).not.toHaveBeenCalled();
  expect(count).toBe(1);
});

it("recusa reescrever exigência cujo resumo mudou numa versão já publicada", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue({ id: "set-existente" }),
      update: vi.fn().mockResolvedValue({ id: "set-existente" }),
      create: vi.fn(),
    },
    charterRequirement: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { codigo: "1.1", resumo: "Resumo ANTIGO", texto: null },
        ]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  await expect(upsertCorpus(db as never, corpus)).rejects.toThrow(
    /1\.1 mudou de texto na versão "1"/
  );
  expect(db.charterRequirement.upsert).not.toHaveBeenCalled();
});

it("aceita citacao diferente sem exigir versão nova — não muda a obrigação", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue({ id: "set-existente" }),
      update: vi.fn().mockResolvedValue({ id: "set-existente" }),
      create: vi.fn(),
    },
    charterRequirement: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ codigo: "1.1", resumo: "Resumo", texto: null }]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  const count = await upsertCorpus(db as never, {
    ...corpus,
    requisitos: [
      { codigo: "1.1", citacao: "Art. 1º (redação nova)", resumo: "Resumo" },
    ],
  });

  expect(count).toBe(1);
  expect(db.charterRequirement.upsert).toHaveBeenCalledTimes(1);
});

it("exigência nova numa versão existente entra sem erro", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue({ id: "set-existente" }),
      update: vi.fn().mockResolvedValue({ id: "set-existente" }),
      create: vi.fn(),
    },
    charterRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  const count = await upsertCorpus(db as never, corpus);

  expect(count).toBe(1);
});
