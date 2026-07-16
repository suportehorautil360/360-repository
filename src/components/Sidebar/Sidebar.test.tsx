import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import type { SidebarGroup } from "./types";

const groups: SidebarGroup[] = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard", to: "/admin/dashboard", icon: "📊" },
      {
        label: "Abastecimentos",
        to: "/admin/abastecimentos",
        badge: 1,
        badgeTone: "danger",
      },
    ],
  },
  {
    label: "Manutenção",
    items: [{ label: "Revisões", to: "/admin/revisoes", badge: 6 }],
  },
];

function renderSidebar(extra?: Parameters<typeof Sidebar>[0]) {
  return render(
    <MemoryRouter>
      <Sidebar
        brand={{ title: "HORA ÚTIL 360" }}
        groups={groups}
        {...extra}
      />
    </MemoryRouter>,
  );
}

/**
 * Os grupos nascem fechados (`defaultValue={[]}` no Accordion) e o Radix
 * desmonta o conteúdo fechado — então os itens só existem no DOM depois de
 * expandir.
 */
function abrirGrupo(label: string) {
  return userEvent.setup().click(screen.getByRole("button", { name: label }));
}

describe("Sidebar", () => {
  it("renderiza a marca e os rótulos de grupo", () => {
    renderSidebar();
    expect(screen.getByText("HORA ÚTIL 360")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Manutenção")).toBeInTheDocument();
  });

  it("os itens do grupo só aparecem depois de expandir", async () => {
    renderSidebar();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).toBeNull();

    await abrirGrupo("Principal");
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
  });

  it("aponta os itens para a rota correta", async () => {
    renderSidebar();
    await abrirGrupo("Principal");
    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
      "href",
      "/admin/dashboard",
    );
  });

  it("mostra os badges de contagem", async () => {
    renderSidebar();
    await abrirGrupo("Principal");
    await abrirGrupo("Manutenção");
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("grupo bloqueado não abre e sinaliza o motivo", async () => {
    renderSidebar({
      brand: { title: "HORA ÚTIL 360" },
      groups: [{ ...groups[1], locked: true }],
    });
    const trigger = screen.getByRole("button", { name: "Manutenção" });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute(
      "title",
      "Seu cargo não tem acesso a esta área",
    );

    await abrirGrupo("Manutenção");
    expect(screen.queryByRole("link", { name: /Revisões/ })).toBeNull();
  });

  it("renderiza o rodapé de usuário (avatar, nome, papel) quando há user", () => {
    const onLogout = vi.fn();
    renderSidebar({
      brand: { title: "HORA ÚTIL 360" },
      groups,
      user: { name: "João Santos", role: "Administrador" },
      onLogout,
    });
    expect(screen.getByText("JS")).toBeInTheDocument();
    expect(screen.getByText("João Santos")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("renderiza botão simples de sair quando há onLogout sem user", () => {
    const onLogout = vi.fn();
    renderSidebar({ brand: { title: "HORA ÚTIL 360" }, groups, onLogout });
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("não renderiza rodapé quando não há ação de logout", () => {
    renderSidebar();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });
});
