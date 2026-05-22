import type { ChangeEvent, FC } from "react";
import { importBook } from "../actions/import-book";

export const ImportBookButton: FC = () => {
  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importBook(file);
    } catch (error) {
      console.error(error);
    }
    e.target.value = "";
  };

  return <input type="file" accept=".epub" onChange={onImport} />;
};
