// Throw this from any route to send an error to the frontend, e.g.
//   throw new HttpError(400, "Add at least one task first");
// The error handler in index.ts turns it into: 400 { "error": "Add at least one task first" }
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// "/tasks/12" -> 12
export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
}
