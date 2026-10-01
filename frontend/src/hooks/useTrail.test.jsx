import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { placeName } from "../lib/places.js";
import { BackLink } from "../ui/index.js";
import { TrailProvider } from "./useTrail.js";

function Screen({ name, back, links = [] }) {
  return (
    <div>
      <h1>{name}</h1>
      {back && <BackLink to={back[0]}>{back[1]}</BackLink>}
      {links.map(([to, label]) => (
        <Link key={to} to={to}>
          open {label}
        </Link>
      ))}
    </div>
  );
}

function App({ start }) {
  return (
    <MemoryRouter initialEntries={[start]}>
      <TrailProvider>
        <Routes>
          <Route path="/dashboard" element={<Screen name="Home" links={[["/purchases/new", "Goods Arrived"], ["/more", "More"]]} />} />
          <Route path="/more" element={<Screen name="All options" back={["/dashboard", "Home"]} links={[["/purchases", "Purchase Bills"]]} />} />
          <Route path="/purchases" element={<Screen name="Purchase Bills" back={["/more", "All options"]} links={[["/purchases/new", "Goods Arrived"]]} />} />
          <Route path="/purchases/new" element={<Screen name="Goods Arrived" back={["/purchases", "Purchase Bills"]} />} />
        </Routes>
      </TrailProvider>
    </MemoryRouter>
  );
}

const heading = () => screen.getByRole("heading").textContent;

describe("Back goes where you came from", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns to Home when a screen was opened from Home", () => {
    render(<App start="/dashboard" />);
    fireEvent.click(screen.getByText("open Goods Arrived"));
    expect(heading()).toBe("Goods Arrived");
    fireEvent.click(screen.getByText("Back to Home"));
    expect(heading()).toBe("Home");
  });

  it("walks back through each screen in turn", () => {
    render(<App start="/dashboard" />);
    fireEvent.click(screen.getByText("open More"));
    fireEvent.click(screen.getByText("open Purchase Bills"));
    fireEvent.click(screen.getByText("open Goods Arrived"));
    fireEvent.click(screen.getByText("Back to Purchase Bills"));
    expect(heading()).toBe("Purchase Bills");
    fireEvent.click(screen.getByText("Back to All options"));
    expect(heading()).toBe("All options");
    fireEvent.click(screen.getByText("Back to Home"));
    expect(heading()).toBe("Home");
  });

  it("uses the usual screen above when it doesn't know where you came from", () => {
    render(<App start="/purchases/new" />);
    fireEvent.click(screen.getByText("Back to Purchase Bills"));
    expect(heading()).toBe("Purchase Bills");
  });
});

describe("placeName", () => {
  it("names screens the way the All options page does", () => {
    expect(placeName("/dashboard")).toBe("Home");
    expect(placeName("/bills?status=held")).toBe("Kept for Later");
    expect(placeName("/items?status=low")).toBe("Running Low");
    expect(placeName("/customers?owing=1")).toBe("Khata");
    expect(placeName("/bills/12")).toBe("the bill");
    expect(placeName("/bills/12/print")).toBeNull();
  });
});
