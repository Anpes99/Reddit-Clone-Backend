import type { QueryInterface, Transaction } from "sequelize";

export type { QueryInterface, Transaction };

// Shape of a sequelize-cli migration. Migrations stay .js because
// SequelizeMeta records them by filename, so renaming them would re-run them.
export type Migration = {
  up: (queryInterface: QueryInterface) => Promise<void>;
  down: (queryInterface: QueryInterface) => Promise<void>;
};

export type TableColumn = { table: string; column: string };

// What queryInterface.sequelize.query() resolves to without a query type
export type RawQueryResult<Row> = [Row[], unknown];
