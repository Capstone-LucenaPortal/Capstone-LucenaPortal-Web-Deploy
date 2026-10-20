import { render, screen } from "@testing-library/react";
import { DataTable } from "@/portals/admin/components/ui/data-table";

interface Row {
  id: string;
  name: string;
  age: number;
}

const rows: Row[] = [
  { id: "1", name: "Juan", age: 30 },
  { id: "2", name: "Maria", age: 25 },
];

describe("DataTable", () => {
  it("renders a header per column and a row per item", () => {
    render(
      <DataTable<Row>
        columns={[
          { header: "Name", render: (r) => r.name },
          { header: "Age", render: (r) => r.age },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getByText("Juan")).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
  });

  it("renders nothing but headers when rows is empty", () => {
    render(
      <DataTable<Row>
        columns={[{ header: "Name", render: (r) => r.name }]}
        rows={[]}
        rowKey={(r) => r.id}
      />
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Juan/ })).not.toBeInTheDocument();
  });
});
