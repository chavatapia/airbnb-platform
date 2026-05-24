import { redirect } from "next/navigation";

// Always redirect to dashboard — middleware handles auth protection
export default function Home() {
  redirect("/dashboard");
}
