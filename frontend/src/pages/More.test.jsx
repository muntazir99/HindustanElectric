import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null }));
vi.mock("../context/AuthContext.js", () => ({ useAuth: () => auth.value }));

import More from "./More.js";

function signIn(isOwner, switches = []) {
  auth.value = {
    user: { name: isOwner ? "Owner" : "Raju" },
    isOwner,
    can: (...codes) => isOwner || codes.some((code) => switches.includes(code)),
    logout: () => {},
  };
}

const show = () =>
  render(
    <MemoryRouter>
      <More />
    </MemoryRouter>
  );

describe("All options shows only what the person may use", () => {
  it("a counter helper sees bills and khata, nothing else", () => {
    signIn(false, ["billing", "payments", "view_bills"]);
    show();
    expect(screen.getByText("Old Bills")).toBeInTheDocument();
    expect(screen.getByText("Take Payment")).toBeInTheDocument();
    expect(screen.getByText("All Items")).toBeInTheDocument(); // finding items is for everyone
    for (const hidden of ["Return Goods", "Goods Arrived", "Fix Stock", "Upload from Excel", "Staff & Access", "Shop Details"]) {
      expect(screen.queryByText(hidden)).toBeNull();
    }
    expect(screen.queryByText("Buying from distributors")).toBeNull(); // empty sections disappear
  });

  it("the owner sees everything, including Staff & Access", () => {
    signIn(true);
    show();
    for (const name of ["Return Goods", "Goods Arrived", "Fix Stock", "Upload from Excel", "Staff & Access", "Shop Details"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});
