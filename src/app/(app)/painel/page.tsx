import { redirect } from "next/navigation";

/** A antiga página Início foi substituída pelo Mural (página inicial do portal desde 27/11/2026). */
export default function Painel() {
  redirect("/mural");
}
