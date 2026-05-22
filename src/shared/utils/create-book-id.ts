import { v7 as uuidv7 } from "uuid";

export function createBookId() {
  return uuidv7();
}
