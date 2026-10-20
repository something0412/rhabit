import axios from "axios";

// Turns an error from a `catch` block into a readable message.
// Our API always sends errors as { "error": "message" }.
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.error) return error.response.data.error;
    if (!error.response) return "Can't reach the API. Is it running on port 4000?";
  }
  return "Something went wrong";
}
