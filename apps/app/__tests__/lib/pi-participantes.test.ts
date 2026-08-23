// pi-participantes.test.ts — quem compõe o quórum de uma rodada de confidence
// vote. A regra existe porque `PIParticipant` não tem escritor no produto (só
// scripts de seed): sem recuo, toda rodada nasceria com quórum zero e nenhuma
// participação alcançaria os 50% exigidos para revelar o placar.
import { describe, expect, it, vi } from "vitest";
import {
  type ContagemDb,
  contarParticipantesDoPi,
} from "../../lib/pi/participantes";

// O contador toca só `count`; o resto do delegate do Prisma não participa, daí
// o cast — a mentira fica declarada aqui, e não afrouxando o tipo de produção.
const criarBanco = (registrados: number, membros: number) => {
  const pIParticipant = { count: vi.fn().mockResolvedValue(registrados) };
  const tenantMember = { count: vi.fn().mockResolvedValue(membros) };
  return {
    pIParticipant,
    tenantMember,
    db: { pIParticipant, tenantMember } as unknown as ContagemDb,
  };
};

const alvo = { piPlanId: "pi-1", tenantId: "t-1" };

describe("contarParticipantesDoPi", () => {
  it("usa a lista explícita do PI quando ela existe", async () => {
    const banco = criarBanco(7, 99);

    expect(await contarParticipantesDoPi(banco.db, alvo)).toBe(7);
    expect(banco.tenantMember.count).not.toHaveBeenCalled();
  });

  it("recua para os membros do workspace quando ninguém foi registrado", async () => {
    const banco = criarBanco(0, 4);

    expect(await contarParticipantesDoPi(banco.db, alvo)).toBe(4);
  });

  it("não conta observadores na lista explícita", async () => {
    const banco = criarBanco(3, 99);

    await contarParticipantesDoPi(banco.db, alvo);

    expect(banco.pIParticipant.count).toHaveBeenCalledWith({
      where: { ...alvo, role: { not: "OBSERVER" } },
    });
  });

  it("devolve zero quando não há ninguém em lugar nenhum", async () => {
    const banco = criarBanco(0, 0);

    expect(await contarParticipantesDoPi(banco.db, alvo)).toBe(0);
  });
});
