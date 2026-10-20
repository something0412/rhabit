import axios from "axios";

// One axios "instance" with the settings every request needs:
//  - baseURL: so we can write "/days/today" instead of "http://localhost:4000/days/today"
//  - the demo user header (later this becomes "Authorization: Bearer <token>")
//
// Use it directly in your components:
//   const res = await api.get("/days/today");
//   const res = await api.post(`/tasks/${id}/complete`);
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  headers: { "x-user-id": "demo-user" },
});
