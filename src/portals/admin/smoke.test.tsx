import { render, screen } from "@testing-library/react";

function Hello() {
  return <p>hello admin portal</p>;
}

describe("test setup", () => {
  it("renders a component", () => {
    render(<Hello />);
    expect(screen.getByText("hello admin portal")).toBeInTheDocument();
  });
});
