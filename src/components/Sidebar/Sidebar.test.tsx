import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("Sidebar", () => {
  it("renderiza a marca, os rótulos de grupo e os itens", () => {
    renderSidebar();
    expect(screen.getByText("HORA ÚTIL 360")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Manutenção")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Revisões/ })).toBeInTheDocument();
  });

  it("aponta os itens para a rota correta", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
      "href",
      "/admin/dashboard",
    );
  });

  it("mostra os badges de contagem", () => {
    renderSidebar();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renderiza botão simples de sair quando há onLogout", () => {
    const onLogout = vi.fn();
    renderSidebar({
      brand: { title: "HORA ÚTIL 360" },
      groups,
      user: { name: "João Santos", role: "Administrador" },
      onLogout,
    });
    expect(screen.queryByText("JS")).not.toBeInTheDocument();
    expect(screen.queryByText("João Santos")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("não renderiza rodapé quando não há ação de logout", () => {
    renderSidebar();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });
});
